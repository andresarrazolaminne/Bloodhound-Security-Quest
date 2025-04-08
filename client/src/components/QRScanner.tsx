import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, RefreshCcw } from "lucide-react";
import jsQR from "jsqr";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

/**
 * Componente para escanear códigos QR usando jsQR.
 * Implementación directa con Canvas y Video para máxima compatibilidad.
 */
const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // Inicializar el stream de video al montar el componente
  useEffect(() => {
    const setupScanner = async () => {
      if (!isOpen) return;
      
      try {
        // Obtener lista de cámaras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        // Si no hay cámaras disponibles
        if (videoDevices.length === 0) {
          setHasCamera(false);
          setCameraError("No se detectaron cámaras en este dispositivo");
          return;
        }
        
        // Usar la primera cámara por defecto
        const defaultDeviceId = videoDevices[0].deviceId;
        setDeviceId(defaultDeviceId);
        await startCamera(defaultDeviceId);
      } catch (error) {
        console.error("Error al configurar el escáner:", error);
        setCameraError("No se pudo acceder a la cámara. Por favor, permite el acceso a la cámara en tu navegador.");
        setHasCamera(false);
      }
    };
    
    setupScanner();
    
    // Limpieza al desmontar el componente
    return () => {
      stopCamera();
    };
  }, [isOpen]);
  
  // Iniciar la transmisión de la cámara
  const startCamera = async (cameraId: string) => {
    try {
      if (!videoRef.current) return;
      
      // Detener cualquier stream anterior
      stopCamera();
      
      // Configurar la transmisión de video
      const constraints = {
        video: {
          deviceId: cameraId ? { exact: cameraId } : undefined,
          facingMode: "environment", // Usar cámara trasera si está disponible
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };
      
      // Obtener stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Asignar stream al elemento de video
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      
      // Iniciar el escaneo
      setScanning(true);
      scanQRCode();
    } catch (error) {
      console.error("Error al iniciar la cámara:", error);
      setCameraError("No se pudo iniciar la cámara. Asegúrate de dar permisos en tu navegador.");
      setHasCamera(false);
    }
  };
  
  // Detener la transmisión de la cámara
  const stopCamera = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    const tracks = stream.getTracks();
    
    tracks.forEach(track => track.stop());
    videoRef.current.srcObject = null;
    setScanning(false);
  };
  
  // Escanear continuamente códigos QR
  const scanQRCode = () => {
    if (!scanning) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      // Si el video no está listo, intentar de nuevo en el próximo frame
      requestAnimationFrame(scanQRCode);
      return;
    }
    
    // Configurar el canvas para capturar el frame actual
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Obtener los datos de la imagen
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Analizar la imagen en busca de un código QR
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    
    if (code) {
      console.log("¡Código QR encontrado!", code.data);
      
      try {
        // Intentar procesar el contenido
        let segmentId: number;
        
        try {
          // Primero intentar como JSON
          const data = JSON.parse(code.data);
          if (data && typeof data.segmentId === 'number') {
            segmentId = data.segmentId;
          } else {
            throw new Error("Formato JSON inválido");
          }
        } catch (jsonError) {
          // Si no es JSON, intentar como número directamente
          segmentId = parseInt(code.data);
          
          if (isNaN(segmentId)) {
            throw new Error("El código QR no contiene un número válido");
          }
        }
        
        // Verificar que el segmentId está en el rango correcto (1-9)
        if (segmentId >= 1 && segmentId <= 9) {
          // Detener el escáner y notificar éxito
          stopCamera();
          onSuccess(segmentId);
        } else {
          throw new Error(`Segmento ${segmentId} fuera de rango (1-9)`);
        }
      } catch (error) {
        console.error("Error procesando QR:", error);
        toast({
          title: "Código QR no válido",
          description: "El código escaneado no corresponde a un segmento del mapa. Debe ser un número del 1 al 9.",
          variant: "destructive"
        });
        
        // Continuar escaneando después de un error
        requestAnimationFrame(scanQRCode);
      }
    } else {
      // No se encontró código, seguir escaneando
      requestAnimationFrame(scanQRCode);
    }
  };
  
  // Manejar cambio de cámara
  const handleCameraChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = event.target.value;
    setDeviceId(newDeviceId);
    startCamera(newDeviceId);
  };
  
  // Reiniciar la cámara
  const handleRestartCamera = () => {
    setHasCamera(true);
    setCameraError(null);
    if (deviceId) {
      startCamera(deviceId);
    } else if (availableCameras.length > 0) {
      startCamera(availableCameras[0].deviceId);
    }
  };
  
  // Cerrar el diálogo
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      stopCamera();
      onClose();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            <span>Escanear Código QR</span>
          </DialogTitle>
          <DialogDescription>
            Apunta con la cámara a un código QR para desbloquear un segmento del mapa
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex gap-3 items-start">
            <Camera className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-blue-800 font-medium mb-1">Escanear Código</p>
              <p className="text-blue-700 text-sm">
                Apunta con la cámara al código QR para escanearlo automáticamente.
                Permite el acceso a la cámara cuando se te solicite.
              </p>
            </div>
          </div>
        </div>
        
        {/* Selector de cámara (solo mostrar si hay más de una) */}
        {availableCameras.length > 1 && (
          <div className="mb-4">
            <select 
              className="w-full p-2 border rounded-md" 
              value={deviceId} 
              onChange={handleCameraChange}
            >
              {availableCameras.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Cámara ${availableCameras.indexOf(device) + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Área de visualización de la cámara */}
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: "300px" }}>
          {hasCamera ? (
            <>
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover"
                muted
                playsInline
                style={{ display: "block" }}
              ></video>
              
              {/* Canvas oculto para procesar los frames */}
              <canvas 
                ref={canvasRef} 
                style={{ display: "none" }}
              ></canvas>
              
              {/* Superposición para indicar el área de escaneo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-primary w-64 h-64 rounded-lg opacity-60"></div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 h-full">
              <div className="text-center text-white mb-4">
                <p className="mb-2">{cameraError || "No se pudo acceder a la cámara"}</p>
                <Button onClick={handleRestartCamera} variant="secondary" className="mt-2">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reintentar
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;