import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Loader2, Camera, QrCode } from "lucide-react";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { currentUser } = useUser();
  
  // Scanner interval ref to clear it later
  const scanIntervalRef = useRef<number | null>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Start camera and QR scanner
  const startCamera = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador no soporta acceso a la cámara");
      }
      
      // Stop any existing stream
      if (stream) {
        stopCamera();
      }
      
      console.log("Solicitando acceso a la cámara...");
      
      // Try to get the back camera first on mobile devices
      let mediaStream;
      
      try {
        // First try with environment camera (back camera)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: {exact: 'environment'}, 
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        console.log("Usando cámara trasera");
      } catch (err) {
        console.log("No se pudo acceder a la cámara trasera, intentando con cualquier cámara disponible");
        
        // If that fails, try any camera
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        console.log("Usando cámara predeterminada");
      }
      
      console.log("Cámara accedida correctamente");
      setStream(mediaStream);
      
      // Set video source
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log("Video fuente configurado");
        
        // Configurar evento de carga
        videoRef.current.onloadeddata = () => {
          console.log("Video listo para reproducir");
          
          if (videoRef.current) {
            // Establecer dimensiones del video
            console.log(`Dimensiones del video: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
            
            // Iniciar el escaneo
            setIsInitializing(false);
            
            // Dar un poco de tiempo para que se estabilice el flujo de video
            setTimeout(() => {
              startQrScanner();
            }, 1000);
          }
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("No se pudo acceder a la cámara. Verifica que has dado permiso al navegador.");
      setIsInitializing(false);
    }
  };

  // Stop camera and clear scanner
  const stopCamera = () => {
    // Clear scanning interval
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Stop media stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Start QR scanner by checking video frames periodically
  const startQrScanner = () => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
    }
    
    scanIntervalRef.current = window.setInterval(() => {
      scanQRCode();
    }, 200); // Check for QR codes every 200ms
  };
  
  // Process video frame to detect QR code
  const scanQRCode = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.paused || video.ended || !video.videoWidth) {
      return;
    }
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for processing
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Process with jsQR (dynamically imported)
      import('jsqr').then(module => {
        const jsQR = module.default;
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        
        if (code) {
          handleQRCodeDetected(code.data);
        }
      }).catch(err => {
        console.error("Error loading jsQR:", err);
      });
    } catch (err) {
      console.error("Error processing image data:", err);
    }
  };
  
  // Handle successful QR code scanning
  const handleQRCodeDetected = (decodedText: string) => {
    console.log("QR code detected:", decodedText);
    
    // Stop scanning while processing
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    try {
      // Try to parse as JSON first (from our generator)
      let segmentId;
      try {
        const data = JSON.parse(decodedText);
        segmentId = data.segmentId;
      } catch {
        // If not valid JSON, try direct parsing
        segmentId = parseInt(decodedText);
      }
      
      if (!isNaN(segmentId) && segmentId >= 1 && segmentId <= 9) {
        toast({
          title: "¡Código detectado!",
          description: `Desbloqueando segmento ${segmentId}...`,
        });
        
        stopCamera();
        onSuccess(segmentId);
      } else {
        toast({
          title: "Código inválido",
          description: "El código QR escaneado no corresponde a un segmento del mapa",
          variant: "destructive"
        });
        
        // Resume scanning
        startQrScanner();
      }
    } catch (error) {
      console.error("Error processing QR code:", error);
      toast({
        title: "Error",
        description: "El código QR no tiene el formato esperado",
        variant: "destructive"
      });
      
      // Resume scanning
      startQrScanner();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear Código QR</DialogTitle>
          <DialogDescription>
            Escanea el código QR ubicado en las locaciones de la búsqueda
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4">
          <div className="text-center mb-4">
            <div className="relative w-full max-w-xs mx-auto rounded-lg overflow-hidden bg-gray-900" style={{ height: "300px" }}>
              {isInitializing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-sm text-gray-600">Iniciando cámara...</p>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 p-4">
                  <Camera className="h-10 w-10 text-gray-400 mb-4" />
                  <p className="text-sm text-red-500 font-medium mb-2">Error de cámara</p>
                  <p className="text-xs text-gray-600 mb-4">{error}</p>
                  <Button onClick={startCamera} size="sm">
                    Reintentar con cámara
                  </Button>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover z-10"
                    playsInline
                    muted
                    autoPlay
                    style={{ 
                      transform: 'scaleX(1)',  // Flip horizontally if needed
                      backgroundColor: 'black'
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-white w-2/3 h-2/3 rounded flex items-center justify-center">
                      <div className="w-full h-px bg-white/60 absolute"></div>
                      <div className="h-full w-px bg-white/60 absolute"></div>
                    </div>
                  </div>
                </>
              )}
              
              {/* Hidden canvas for image processing */}
              <canvas 
                ref={canvasRef}
                className="hidden"
              />
            </div>
            
            {!isInitializing && !error && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Posiciona el código QR dentro del recuadro para escanearlo
                </p>
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <QrCode className="h-4 w-4 mr-1" />
                  <span>Los QR se encuentran en las ubicaciones físicas</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;
