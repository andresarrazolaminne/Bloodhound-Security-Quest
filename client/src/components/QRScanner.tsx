import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { unlockSegment } from "@/lib/api";

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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: "Error",
        description: "Tu navegador no soporta acceso a la cámara.",
        variant: "destructive"
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanQRCode();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Error",
        description: "No se pudo acceder a la cámara. Por favor, dale permisos a la aplicación.",
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear Código QR</DialogTitle>
        </DialogHeader>
        
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
