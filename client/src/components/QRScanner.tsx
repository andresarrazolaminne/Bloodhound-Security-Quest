import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, AlertTriangle } from "lucide-react";
import jsQR from "jsqr";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualSegmentId, setManualSegmentId] = useState<string>("");
  const [cameraError, setCameraError] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useUser();
  const requestRef = useRef<number>();
  const requestPermissionAttempted = useRef(false);

  // Iniciar la cámara
  useEffect(() => {
    async function startCamera() {
      if (!isOpen) return;
      
      setCameraError(false);
      setLoading(true);
      console.log("Iniciando cámara...");
      
      if (requestPermissionAttempted.current) return;
      requestPermissionAttempted.current = true;

      try {
        // Solicitar permisos de cámara explícitamente
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Preferir cámara trasera
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        
        // Configurar video
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          
          try {
            // Intentar reproducir el video inmediatamente
            videoRef.current.play()
              .then(() => {
                console.log("Video iniciado correctamente");
                setLoading(false);
                setScanning(true);
                setStream(mediaStream);
              })
              .catch(err => {
                console.error("Error al iniciar el video:", err);
                setCameraError(true);
                setLoading(false);
                toast({
                  title: "Error de reproducción",
                  description: "No se pudo iniciar la cámara. Intenta dar permisos en la configuración del navegador.",
                  variant: "destructive"
                });
              });
          } catch (e) {
            console.error("Error al intentar reproducir video:", e);
            setCameraError(true);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error al acceder a la cámara:", error);
        setCameraError(true);
        setLoading(false);
        
        toast({
          title: "Error de cámara",
          description: "No se pudo acceder a la cámara. Permite el acceso o ingresa el código manualmente.",
          variant: "destructive"
        });
      }
    }

    if (isOpen) {
      startCamera();
    }

    // Limpiar al cerrar
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      requestPermissionAttempted.current = false;
    };
  }, [isOpen, toast]);

  // Proceso de escaneo de QR
  useEffect(() => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Configurar canvas al tamaño del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Función para escanear fotogramas
    const scanQRCode = () => {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestRef.current = requestAnimationFrame(scanQRCode);
        return;
      }
      
      // Dibujar fotograma actual en el canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Obtener datos de imagen
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Buscar código QR
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      // Si se encontró un código QR
      if (code) {
        console.log("QR Code detectado:", code.data);
        processQRCode(code.data);
        return; // Detener el escaneo
      }
      
      // Continuar escaneando
      requestRef.current = requestAnimationFrame(scanQRCode);
    };
    
    // Iniciar escaneo
    requestRef.current = requestAnimationFrame(scanQRCode);
    
    // Limpiar al desmontar
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [scanning, onSuccess]);

  // Procesar el código QR detectado
  const processQRCode = (decodedText: string) => {
    try {
      let segmentId: number;
      
      try {
        // Intenta parsear como JSON
        const data = JSON.parse(decodedText);
        if (data && typeof data.segmentId === 'number') {
          segmentId = data.segmentId;
        } else {
          throw new Error("JSON no válido");
        }
      } catch (jsonError) {
        // Si no es JSON, intenta como número directo
        segmentId = parseInt(decodedText);
        if (isNaN(segmentId)) {
          throw new Error("No es un número válido");
        }
      }
      
      // Verificar rango válido
      if (segmentId >= 1 && segmentId <= 9) {
        // Detener el escaneo
        setScanning(false);
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        onSuccess(segmentId);
      } else {
        throw new Error("Segmento fuera de rango (1-9)");
      }
    } catch (error) {
      console.error("Error procesando QR:", error);
      toast({
        title: "QR no válido",
        description: "El código escaneado no corresponde a un segmento del mapa",
        variant: "destructive"
      });
      
      // Continuar escaneando después de un error
      if (requestRef.current) {
        requestRef.current = requestAnimationFrame(() => {
          if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
              context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }
        });
      }
    }
  };

  // Manejar envío manual
  const handleManualSubmit = () => {
    const id = parseInt(manualSegmentId);
    if (!isNaN(id) && id >= 1 && id <= 9) {
      onSuccess(id);
    } else {
      toast({
        title: "Error",
        description: "Por favor ingresa un número válido entre 1 y 9",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear Código QR</DialogTitle>
        </DialogHeader>
        
        {!cameraError ? (
          <div className="p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-gray-600">Solicitando acceso a la cámara...</p>
                <p className="text-xs text-gray-500 mt-2">
                  Por favor permite el acceso cuando el navegador lo solicite
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm mb-4">
                  <video 
                    ref={videoRef} 
                    className="w-full max-w-md mx-auto"
                    playsInline 
                    muted
                    autoPlay
                    style={{ 
                      height: "300px", 
                      objectFit: "cover",
                      background: "#000"
                    }}
                  ></video>
                  <div className="absolute inset-0 pointer-events-none border-4 border-primary/50 rounded m-8"></div>
                </div>
                
                <canvas 
                  ref={canvasRef} 
                  className="hidden"
                ></canvas>
                
                <div className="flex items-center gap-2 text-sm text-gray-500 my-3">
                  <Camera className="h-4 w-4" />
                  <p>Posiciona el código QR dentro del recuadro para escanearlo</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="flex flex-col items-center gap-3 mb-6">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <div className="text-center">
                <p className="text-amber-600 font-medium mb-2">
                  No se pudo acceder a la cámara
                </p>
                <p className="text-gray-600 text-sm">
                  Ingresa manualmente el número de segmento que deseas desbloquear (1-9)
                </p>
              </div>
            </div>
            
            <div className="max-w-xs mx-auto space-y-2">
              <Label htmlFor="segment-id-manual">Número de Segmento</Label>
              <Input
                id="segment-id-manual"
                type="number"
                min={1}
                max={9}
                placeholder="Ingresa un número del 1 al 9"
                value={manualSegmentId}
                onChange={(e) => setManualSegmentId(e.target.value)}
              />
              <Button 
                className="w-full mt-4" 
                onClick={handleManualSubmit}
              >
                Desbloquear Segmento
              </Button>
            </div>
            
            <p className="text-sm text-gray-500 mt-4 text-center">
              Nota: También puedes generar los códigos QR yendo a la sección "/qr-generator"
            </p>
          </div>
        )}
        
        <DialogFooter>
          {!cameraError && (
            <Button 
              variant="secondary" 
              onClick={() => setCameraError(true)}
              className="mr-auto"
            >
              Ingresar código manualmente
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;