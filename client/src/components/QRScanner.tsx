import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, RefreshCcw, Play } from "lucide-react";
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
  
  // Referencia para controlar si el escaneo está inicializado
  const scanInitializedRef = useRef<boolean>(false);
  
  // Inicializar el stream de video al montar el componente
  useEffect(() => {
    const setupScanner = async () => {
      if (!isOpen) return;
      
      try {
        console.log("Inicializando escáner...");
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
        
        // Restablecer estado de escáner cada vez que se abre
        scanInitializedRef.current = false;
        
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
      
      // Limpiamos cualquier timeout pendiente para evitar memory leaks
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      
      scanInitializedRef.current = false;
    };
  }, [isOpen]);
  
  // Iniciar la transmisión de la cámara
  const startCamera = async (cameraId: string = "") => {
    try {
      if (!videoRef.current) return;
      
      // Reiniciar el estado de escaneo
      scanInitializedRef.current = false;
      
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
    // Cancelar cualquier frame request pendiente
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }
    
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    const tracks = stream.getTracks();
    
    tracks.forEach(track => track.stop());
    videoRef.current.srcObject = null;
    setScanning(false);
  };
  
  // Referencia para control de tiempo entre escaneos
  const lastScanRef = useRef<number>(0);
  const scanIntervalRef = useRef<number>(50); // optimizado para mejor balance rendimiento/detección
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const frameRequestRef = useRef<number | null>(null);

  // Escanear continuamente códigos QR con optimización de rendimiento
  const scanQRCode = () => {
    if (!scanning) {
      console.log("Escaneo detenido, se ignora solicitud de escaneo");
      return;
    }
    
    // Para depuración
    if (!scanInitializedRef.current) {
      console.log("¡Iniciando escaneo de QR por primera vez!");
      scanInitializedRef.current = true;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      // Si el video no está listo, intentar de nuevo en el próximo frame
      frameRequestRef.current = requestAnimationFrame(scanQRCode);
      return;
    }
    
    // Control de frecuencia de escaneo para reducir carga de CPU
    const now = Date.now();
    if (now - lastScanRef.current < scanIntervalRef.current) {
      frameRequestRef.current = requestAnimationFrame(scanQRCode);
      return;
    }
    lastScanRef.current = now;
    
    // Configurar el canvas para capturar el frame actual
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // Usar dimensiones más grandes para mejor detección, incluso si es un poco más lento
    const scaleFactor = 0.9; // Escalar al 90% para mejor reconocimiento
    const captureWidth = video.videoWidth * scaleFactor;
    const captureHeight = video.videoHeight * scaleFactor;
    
    canvas.width = captureWidth;
    canvas.height = captureHeight;
    
    // Dibujar el video en un canvas más pequeño para procesamiento más rápido
    ctx.drawImage(video, 0, 0, captureWidth, captureHeight);
    
    // Obtener los datos de la imagen
    const imageData = ctx.getImageData(0, 0, captureWidth, captureHeight);
    
    // Analizar la imagen en busca de un código QR con configuración optimizada
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth", // Probar tanto normal como invertido para mayor compatibilidad
    });
    
    if (code) {
      console.log("¡Código QR encontrado!", code.data);
      
      try {
        // Intentar procesar el contenido
        let segmentId: number;
        let securityCode: string | undefined;
        
        // Nuevo: Detectar y procesar URLs completas
        if (code.data.startsWith('http://') || code.data.startsWith('https://')) {
          console.log("Detectado código QR con URL:", code.data);
          
          try {
            const url = new URL(code.data);
            
            // Verificar si es una URL de unlock de nuestra aplicación
            if (url.pathname === '/unlock') {
              const urlSegmentId = url.searchParams.get('segment');
              const urlSecurityCode = url.searchParams.get('code');
              
              if (urlSegmentId && urlSecurityCode) {
                segmentId = parseInt(urlSegmentId);
                securityCode = urlSecurityCode;
                
                if (isNaN(segmentId)) {
                  throw new Error("ID de segmento inválido en URL");
                }
                
                console.log("URL de unlock procesada exitosamente:", { segmentId, securityCode });
              } else {
                throw new Error("URL de unlock incompleta - faltan parámetros segment o code");
              }
            } else {
              throw new Error(`URL no reconocida: ${url.pathname}. Se esperaba /unlock`);
            }
          } catch (urlError) {
            console.error("Error procesando URL:", urlError);
            throw new Error("URL de código QR inválida");
          }
        } else {
          // Procesar formatos tradicionales (JSON, texto, etc.)
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
        }
        
        // Verificar que el segmentId está en el rango correcto (1-16 para soportar diferentes tamaños de cuadrícula)
        if (segmentId >= 1 && segmentId <= 16) {
          // Detener repetición en caso de encontrar un código válido
          if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
          }
          
          // Notificar éxito después de una pequeña pausa para evitar escaneos duplicados
          setScanning(false); // Detenemos el escaneo inmediatamente
          
          successTimeoutRef.current = setTimeout(() => {
            // Detener el escáner y notificar éxito
            stopCamera();
            
            // Añadir un pequeño retraso antes de la notificación para asegurar 
            // que todas las interfaces se actualizan correctamente
            onSuccess(segmentId, securityCode);
            
            // Emitir un evento personalizado para notificar a otros componentes
            // que deberían actualizar su estado de mapa
            window.dispatchEvent(new CustomEvent('mapSegmentUnlocked', { 
              detail: { segmentId, timestamp: Date.now() } 
            }));
          }, 300);
        } else {
          throw new Error(`Segmento ${segmentId} fuera de rango (1-16)`);
        }
      } catch (error) {
        console.error("Error procesando QR:", error);
        toast({
          title: "Código QR no válido",
          description: "El código escaneado no corresponde a un segmento del mapa. Debe ser un número del 1 al 16.",
          variant: "destructive"
        });
        
        // Continuar escaneando después de un error
        frameRequestRef.current = requestAnimationFrame(scanQRCode);
      }
    } else {
      // No se encontró código, seguir escaneando
      frameRequestRef.current = requestAnimationFrame(scanQRCode);
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
      // Detener la cámara
      stopCamera();
      
      // Limpiar timeout si existe
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      
      onClose();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-md p-3 sm:p-4 overflow-hidden">
        <DialogHeader className="pb-1 sm:pb-2">
          <DialogTitle className="flex items-center text-base sm:text-lg gap-2">
            <QrCode className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">Escanear Código QR</span>
          </DialogTitle>
          <DialogDescription className="flex items-center text-xs sm:text-sm text-blue-700 mt-1 gap-1.5">
            <Camera className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <span>Apunta al código QR para escanearlo automáticamente</span>
          </DialogDescription>
        </DialogHeader>
        
        {/* Selector de cámara - siempre mostrar si hay cámaras disponibles */}
        {availableCameras.length > 1 && (
          <div className="mb-3 p-2 bg-slate-50 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Selecciona una cámara:</span>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
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
                let icon = "📷";
                
                if (isBackCamera) {
                  friendlyLabel = "Cámara Trasera";
                  icon = "📷";
                } else if (isFrontCamera) {
                  friendlyLabel = "Cámara Frontal";
                  icon = "🤳";
                } else if (index === 0) {
                  friendlyLabel = "Cámara Principal";
                  icon = "📷";
                } else {
                  friendlyLabel = `Cámara ${index + 1}`;
                  icon = "📷";
                }
                
                return (
                  <button
                    key={device.deviceId}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg flex-1 min-w-[120px] justify-center transition-all 
                               ${device.deviceId === deviceId 
                                 ? 'bg-blue-600 text-white font-medium shadow-md scale-105' 
                                 : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}
                    onClick={() => {
                      setDeviceId(device.deviceId);
                      startCamera(device.deviceId);
                    }}
                  >
                    <span>{icon}</span>
                    <span className="text-sm truncate">{friendlyLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Área de visualización de la cámara */}
        <div className="relative bg-black rounded-lg overflow-hidden mb-2" style={{ 
          minHeight: "220px", 
          height: "45vh",
          maxHeight: "350px" 
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
                <div className="border-3 border-green-500 w-56 h-56 sm:w-72 sm:h-72 rounded-lg shadow-lg" 
                     style={{boxShadow: "0 0 0 2000px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(95, 211, 95, 0.5)"}}>
                  {/* Esquinas para resaltar el área de escaneo */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg"></div>
                </div>
              </div>
              
              {/* Botón principal centrado */}
              <div className="absolute bottom-0 left-0 right-0 p-3 flex justify-center items-center">
                {/* Botón principal de escaneo con etiqueta */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    // Reiniciar el escaneo sin cambiar de cámara
                    scanInitializedRef.current = false;
                    if (!scanning) {
                      setScanning(true);
                    }
                    scanQRCode();
                  }}
                  className="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-primary shadow-lg flex items-center justify-center gap-2 font-medium text-base"
                  aria-label="Escanear código"
                  title="Escanear QR"
                >
                  <Play className="h-5 w-5" />
                  <span>Escanear</span>
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
        
        <DialogFooter className="flex justify-end mt-1 pt-1 border-t">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto text-xs">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;