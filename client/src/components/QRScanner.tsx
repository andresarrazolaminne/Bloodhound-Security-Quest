import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, RefreshCcw } from "lucide-react";
import jsQR from "jsqr";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number, securityCode?: string) => void;
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
        
        // En lugar de usar la primera cámara, intentamos usar directamente la cámara trasera
        // La función startCamera ya tiene la lógica para buscar la cámara trasera
        await startCamera("");
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
      
      // Primero intentamos con la estrategia más agresiva para cámara trasera
      if (!cameraId) {
        try {
          console.log("Intentando obtener la cámara trasera con facingMode exact environment...");
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: "environment" }, // Forzar cámara trasera con 'exact'
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);
            scanQRCode();
            return;
          }
        } catch (environmentError) {
          console.log("No se pudo usar facingMode exact environment, intentando detectar cámara trasera por etiqueta...");
        }
        
        // Si no funcionó, intentamos identificar la cámara trasera por su etiqueta
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter(device => device.kind === 'videoinput');
          console.log("Cámaras disponibles:", cameras.map(c => c.label));
          
          // Actualizar la lista de cámaras disponibles
          setAvailableCameras(cameras);
          
          // Buscar cámara que tenga "back", "trasera", "rear", etc. en su etiqueta
          // Intentamos varias estrategias para identificar cámaras traseras
          
          // 1. Buscar términos explícitos de cámara trasera
          let backCamera = cameras.find(camera => {
            const label = camera.label.toLowerCase();
            return label.includes('back') || 
                   label.includes('trasera') || 
                   label.includes('rear') ||
                   label.includes('trás') ||
                   label.includes('posterior') ||
                   label.includes('atrás');
          });
          
          // 2. Si no encontramos por términos, buscamos cámaras que NO sean frontales
          if (!backCamera) {
            backCamera = cameras.find(camera => {
              const label = camera.label.toLowerCase();
              return !label.includes('front') && 
                     !label.includes('frontal') && 
                     !label.includes('selfie') &&
                     !label.includes('user');
            });
          }
          
          // 3. Si hay exactamente 2 cámaras, asumimos que la segunda es la trasera
          // (muchos dispositivos móviles tienen la cámara frontal como índice 0 y la trasera como índice 1)
          if (!backCamera && cameras.length === 2) {
            backCamera = cameras[1];
          }
          
          // 4. Si no hemos encontrado una cámara trasera y tenemos múltiples cámaras,
          // usamos la última (a menudo la trasera en dispositivos Android)
          if (!backCamera && cameras.length > 1) {
            backCamera = cameras[cameras.length - 1];
          }
          
          if (backCamera) {
            console.log("Cámara trasera encontrada por etiqueta:", backCamera.label);
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: backCamera.deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            });
            
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
              setDeviceId(backCamera.deviceId);
              setScanning(true);
              scanQRCode();
              return;
            }
          }
        } catch (labelError) {
          console.log("Error al buscar cámara por etiqueta:", labelError);
        }
        
        // Si aún no funciona, intentamos con facingMode sin exact
        try {
          console.log("Intentando con facingMode environment (sin exact)...");
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment", // Preferir cámara trasera sin forzar
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);
            scanQRCode();
            return;
          }
        } catch (fallbackError) {
          console.log("Error al intentar facingMode environment:", fallbackError);
        }
      } else {
        // Usar la cámara específica seleccionada por el usuario
        try {
          console.log("Usando cámara seleccionada con ID:", cameraId);
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: cameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);
            scanQRCode();
            return;
          }
        } catch (deviceError) {
          console.log("Error al usar deviceId específico:", deviceError);
        }
      }
      
      // Último intento: usar cualquier cámara disponible
      console.log("Último intento: cualquier cámara disponible...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        scanQRCode();
      }
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
        let securityCode: string | undefined;
        
        try {
          // Primero intentar como JSON
          const data = JSON.parse(code.data);
          
          // Formato nuevo con ID y código de seguridad
          if (data && typeof data.segmentId === 'number') {
            segmentId = data.segmentId;
            // Si hay código de seguridad, lo guardamos
            if (data.securityCode && typeof data.securityCode === 'string') {
              securityCode = data.securityCode;
            }
          } else {
            throw new Error("Formato JSON inválido");
          }
        } catch (jsonError) {
          // Formato alternativo que combina segmentId y securityCode 
          // en un formato como "3:ABC12" (segmento 3, código ABC12)
          if (code.data.includes(':')) {
            const parts = code.data.split(':');
            if (parts.length === 2) {
              segmentId = parseInt(parts[0]);
              securityCode = parts[1];
              
              // Verificar que tenemos valores válidos
              if (isNaN(segmentId) || !securityCode) {
                throw new Error("Formato de código QR inválido");
              }
            } else {
              throw new Error("Formato de código QR inválido");
            }
          } else {
            // Formato más antiguo (solo número de segmento)
            segmentId = parseInt(code.data);
            
            if (isNaN(segmentId)) {
              throw new Error("El código QR no contiene un número válido");
            }
          }
        }
        
        // Verificar que el segmentId está en el rango correcto (1-9)
        if (segmentId >= 1 && segmentId <= 9) {
          // Detener el escáner y notificar éxito
          stopCamera();
          onSuccess(segmentId, securityCode);
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
    
    // Primero intentamos usar la cámara trasera
    if (deviceId) {
      // Si ya hay un deviceId seleccionado, usamos ese
      startCamera(deviceId);
    } else {
      // Si no hay deviceId, intentamos encontrar la cámara trasera primero
      const backCamera = availableCameras.find(camera => {
        const label = camera.label.toLowerCase();
        return label.includes('back') || 
              label.includes('trasera') || 
              label.includes('rear') ||
              label.includes('trás') ||
              label.includes('posterior') ||
              label.includes('environment');
      });
      
      if (backCamera) {
        // Si encontramos una cámara trasera, la usamos
        startCamera(backCamera.deviceId);
      } else if (availableCameras.length > 1) {
        // Si hay más de una cámara, usamos la segunda (suele ser la trasera)
        startCamera(availableCameras[1].deviceId);
      } else if (availableCameras.length > 0) {
        // Como último recurso, usamos la primera cámara disponible
        startCamera(availableCameras[0].deviceId);
      } else {
        // Si no hay cámaras, usamos "" para que la función startCamera 
        // intente con facingMode: "environment"
        startCamera("");
      }
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
        
        {/* Selector de cámara - siempre mostrar si hay cámaras disponibles */}
        {availableCameras.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Camera className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Seleccionar cámara:</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {availableCameras.map((device, index) => {
                // Determinar si parece ser cámara trasera o frontal
                const label = device.label || `Cámara ${index + 1}`;
                const labelLower = label.toLowerCase();
                
                // Mejorar la detección de cámaras traseras con más términos
                const isBackCamera = 
                  labelLower.includes('back') || 
                  labelLower.includes('trasera') || 
                  labelLower.includes('rear') ||
                  labelLower.includes('trás') ||
                  labelLower.includes('posterior') ||
                  labelLower.includes('atrás') ||
                  labelLower.includes('environment') || 
                  (labelLower.includes('camera') && labelLower.includes('0')) || // Camera 0 a menudo es trasera
                  (labelLower.includes('camera') && index === 1) || // Segunda cámara en muchos dispositivos
                  (device.deviceId === deviceId && !deviceId.includes("front")); // Si es la cámara seleccionada
                
                // Mejorar la detección de cámaras frontales
                const isFrontCamera = 
                  labelLower.includes('front') || 
                  labelLower.includes('frontal') ||
                  labelLower.includes('selfie') ||
                  labelLower.includes('user') ||
                  labelLower.includes('face');
                
                // Crear etiqueta amigable
                let friendlyLabel = label;
                if (isBackCamera) {
                  friendlyLabel = "📷 Cámara Trasera";
                } else if (isFrontCamera) {
                  friendlyLabel = "🤳 Cámara Frontal";
                } else if (index === 0) {
                  friendlyLabel = "📷 Cámara Principal";
                } else {
                  friendlyLabel = `📷 Cámara ${index + 1}`;
                }
                
                return (
                  <button
                    key={device.deviceId}
                    className={`text-xs px-3 py-2 rounded-full flex-shrink-0 
                               ${device.deviceId === deviceId 
                                 ? 'bg-primary text-white font-medium' 
                                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => {
                      setDeviceId(device.deviceId);
                      startCamera(device.deviceId);
                    }}
                  >
                    {friendlyLabel}
                  </button>
                );
              })}
            </div>
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
              
              {/* Botón para cambiar rápidamente de cámara */}
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    // Encontrar la cámara que no está actualmente activa
                    const currentIndex = availableCameras.findIndex(cam => cam.deviceId === deviceId);
                    if (currentIndex === -1 || availableCameras.length <= 1) return;
                    
                    // Alternar a la siguiente cámara (o volver a la primera si estamos en la última)
                    const nextIndex = (currentIndex + 1) % availableCameras.length;
                    const nextCamera = availableCameras[nextIndex];
                    
                    setDeviceId(nextCamera.deviceId);
                    startCamera(nextCamera.deviceId);
                  }}
                  className="bg-black/70 text-white p-2 rounded-full hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Cambiar cámara"
                  title="Cambiar cámara"
                >
                  <RefreshCcw className="h-5 w-5" />
                </button>
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