import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { unlockSegment } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Use dynamic import for QR scanner library
let jsQR: any = null;

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [manualSegmentId, setManualSegmentId] = useState<string>("");
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Load jsQR dynamically
  useEffect(() => {
    if (isOpen && !jsQR) {
      import('jsqr').then(module => {
        jsQR = module.default;
        startScanner();
      }).catch(error => {
        console.error("Error loading jsQR:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar el escáner de QR.",
          variant: "destructive"
        });
      });
    }
  }, [isOpen]);

  // Start camera when modal is opened
  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    // Reset state
    setCameraError(false);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: "Error",
        description: "Tu navegador no soporta acceso a la cámara.",
        variant: "destructive"
      });
      setCameraError(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Use try-catch for play() to handle interrupted play requests
        try {
          await videoRef.current.play();
          setScanning(true);
          scanQRCode();
        } catch (playError) {
          console.error("Error playing video:", playError);
          setCameraError(true);
          
          // Stop tracks since play failed
          stream.getTracks().forEach(track => track.stop());
          
          toast({
            title: "Error",
            description: "No se pudo iniciar la cámara. Ingresa el código manualmente.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setCameraError(true);
      toast({
        title: "Error",
        description: "No se pudo acceder a la cámara. Ingresa el código manualmente.",
        variant: "destructive"
      });
    }
  };

  const stopScanner = () => {
    setScanning(false);
    
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const scanQRCode = () => {
    if (!scanning || !jsQR) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        try {
          // We expect QR content to be a number (segment ID)
          const segmentId = parseInt(code.data);
          
          if (!isNaN(segmentId) && segmentId >= 1 && segmentId <= 9) {
            // Stop scanning and close modal
            stopScanner();
            onSuccess(segmentId);
          } else {
            // Continue scanning for valid QR codes
            requestAnimationFrame(scanQRCode);
          }
        } catch (error) {
          // If parsing fails, just continue scanning
          requestAnimationFrame(scanQRCode);
        }
      } else {
        // No QR code found, continue scanning
        requestAnimationFrame(scanQRCode);
      }
    } else {
      // Video not ready yet, keep trying
      requestAnimationFrame(scanQRCode);
    }
  };

  // Handle manual submission
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
            <div className="aspect-square mb-4 bg-gray-200 rounded relative overflow-hidden">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              
              <canvas 
                ref={canvasRef} 
                className="hidden"
              />
              
              {/* Scanner visual indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-primary w-2/3 h-2/3 rounded flex items-center justify-center">
                  <div className="w-full h-px bg-primary/60 absolute"></div>
                  <div className="h-full w-px bg-primary/60 absolute"></div>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600 text-center text-sm mb-4">
              Posiciona el código QR dentro del recuadro para escanearlo
            </p>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center mb-4">
              <p className="text-amber-600 font-medium mb-2">
                No se pudo acceder a la cámara
              </p>
              <p className="text-gray-600 text-sm mb-6">
                Ingresa manualmente el número de segmento que deseas desbloquear (1-9)
              </p>
              
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
              
              <p className="text-sm text-gray-500 mt-4">
                Nota: También puedes generar los códigos QR yendo a la sección "/qr-generator"
              </p>
            </div>
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
