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
  const startCamera = async (cameraId: string = "") => {
    try {
      if (!videoRef.current) return;
      
      // Detener cualquier stream anterior
      stopCamera();
      
      // Buscar cámara trasera si no se especificó un id
      let constraints: MediaStreamConstraints;
      
      if (!cameraId) {
        // Intentar detectar una cámara trasera
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter(device => device.kind === 'videoinput');
          
          // Buscar cámara que tenga "back" o "trasera" en su etiqueta
          const backCamera = cameras.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('trasera') ||
            camera.label.toLowerCase().includes('rear')
          );
          
          if (backCamera) {
            console.log("Cámara trasera detectada:", backCamera.label);
            constraints = {
              video: {
                deviceId: { exact: backCamera.deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            };
          } else {
            // Si no se encuentra una cámara trasera específica, usar facingMode
            constraints = {
              video: {
                facingMode: { exact: "environment" }, // Forzar cámara trasera
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            };
          }
        } catch (e) {
          // Si hay error al buscar cámaras, usar valores por defecto
          constraints = {
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          };
        }
      } else {
        // Usar la cámara especificada
        constraints = {
          video: {
            deviceId: { exact: cameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
      }
      
      // Obtener stream
      console.log("Solicitando cámara con constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Asignar stream al elemento de video
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(err => console.error("Error al reproducir video:", err));
      
      // Iniciar el escaneo
      setScanning(true);
      scanQRCode();
    } catch (error) {
      console.error("Error al iniciar la cámara:", error);
      
      // Intento secundario con restricciones más simples si falló
      try {
        if (cameraId) {
          // Si falló con una cámara específica, intentar sin restricciones de device
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true 
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(err => console.error("Error al reproducir video en segundo intento:", err));
            setScanning(true);
            scanQRCode();
            return;
          }
        }
      } catch (secondError) {
        console.error("Error en segundo intento:", secondError);
      }
      
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
      <DialogContent className="max-w-[95vw] w-full sm:max-w-md p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 space-y-1">
          <DialogTitle className="flex items-center text-base sm:text-lg gap-2">
            <QrCode className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">Escanear Código QR</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Apunta la cámara al código QR del segmento
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs sm:text-sm">
          <div className="flex gap-2 items-start">
            <Camera className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-blue-800 font-medium mb-0.5 text-sm">Escanear Código</p>
              <p className="text-blue-700 text-xs">
                Apunta con la cámara al código QR para escanearlo automáticamente.
              </p>
            </div>
          </div>
        </div>
        
        {/* Selector de cámara (solo mostrar si hay más de una) */}
        {availableCameras.length > 1 && (
          <div className="mb-3">
            <select 
              className="w-full p-2 text-sm border rounded-md" 
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
        <div className="relative bg-black rounded-lg overflow-hidden mb-2" style={{ 
          minHeight: "250px", 
          height: "50vh",
          maxHeight: "400px" 
        }}>
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
                <div className="border-2 border-primary w-48 h-48 sm:w-64 sm:h-64 rounded-lg opacity-60"></div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 sm:p-8 h-full">
              <div className="text-center text-white">
                <p className="mb-2 text-sm">{cameraError || "No se pudo acceder a la cámara"}</p>
                <Button onClick={handleRestartCamera} variant="secondary" size="sm" className="mt-2">
                  <RefreshCcw className="mr-2 h-3 w-3" />
                  Reintentar
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-end mt-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;