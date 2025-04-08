import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, QrCode } from "lucide-react";
import jsQR from "jsqr";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  // Tabs & State
  const [activeTab, setActiveTab] = useState<string>("camera");
  const [segmentId, setSegmentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  
  // Hooks
  const { toast } = useToast();
  
  // Start camera when dialog opens & active tab is camera
  useEffect(() => {
    if (isOpen && activeTab === "camera") {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);
  
  // Start the camera
  const startCamera = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador no soporta acceso a la cámara");
      }
      
      // Stop any existing stream
      stopCamera();
      
      // Try to get camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      // Save stream reference for cleanup
      streamRef.current = stream;
      
      // Connect stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play();
            setIsLoading(false);
            startScanning();
          }
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("No se pudo acceder a la cámara. Verifica los permisos.");
      setIsLoading(false);
    }
  };
  
  // Stop the camera
  const stopCamera = () => {
    // Clear scanning interval
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
  };
  
  // Start scanning for QR codes
  const startScanning = () => {
    // Clear any existing interval
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
    }
    
    // Set up scanning interval
    scanIntervalRef.current = window.setInterval(() => {
      scanQRCode();
    }, 200); // Check every 200ms
  };
  
  // Process video frame to find QR codes
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA || !video.videoWidth) {
      return;
    }
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for QR scanning
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Try to find QR code in the image
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert", // QR codes are typically black on white
    });
    
    // If QR code is found, process it
    if (qrCode) {
      handleQRDetected(qrCode.data);
    }
  };
  
  // Handle QR code detection
  const handleQRDetected = (data: string) => {
    // Stop scanning while we process
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    try {
      // Try to parse as JSON first (from our generator)
      let id;
      try {
        const parsedData = JSON.parse(data);
        id = parsedData.segmentId;
      } catch {
        // If not valid JSON, try direct parsing as number
        id = parseInt(data);
      }
      
      if (!isNaN(id) && id >= 1 && id <= 9) {
        toast({
          title: "¡Código detectado!",
          description: `Desbloqueando segmento ${id}...`,
        });
        
        stopCamera();
        onSuccess(id);
      } else {
        toast({
          title: "Código inválido",
          description: "El código QR no contiene un ID de segmento válido",
          variant: "destructive"
        });
        
        // Resume scanning
        startScanning();
      }
    } catch (err) {
      console.error("Error processing QR code:", err);
      toast({
        title: "Error",
        description: "El código QR no tiene el formato esperado",
        variant: "destructive"
      });
      
      // Resume scanning
      startScanning();
    }
  };
  
  // Handle manual input submission
  const handleManualSubmit = () => {
    const id = parseInt(segmentId);
    if (isNaN(id) || id < 1 || id > 9) {
      setError("Por favor ingresa un número válido entre 1 y 9");
      return;
    }
    
    toast({
      title: "Procesando",
      description: `Desbloqueando segmento ${id}...`,
    });
    
    onSuccess(id);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desbloquear Segmento</DialogTitle>
          <DialogDescription>
            Escanea un código QR o ingresa manualmente el número de segmento
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera">Cámara</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="camera" className="p-4">
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-xs h-64 bg-gray-900 rounded-lg overflow-hidden">
                {isLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-sm text-gray-600">Activando cámara...</p>
                  </div>
                ) : error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 p-4">
                    <Camera className="h-10 w-10 text-gray-400 mb-4" />
                    <p className="text-sm text-red-500 font-medium mb-2">Error de cámara</p>
                    <p className="text-xs text-gray-600 mb-4">{error}</p>
                    <Button onClick={startCamera} size="sm">
                      Reintentar
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Video element for camera display */}
                    <video 
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />
                    
                    {/* QR code target indicator */}
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
              
              <p className="text-sm text-gray-600 mt-4">
                Posiciona el código QR dentro del recuadro para escanearlo
              </p>
              
              <div className="flex items-center justify-center text-sm text-gray-500 mt-2">
                <QrCode className="h-4 w-4 mr-1" />
                <span>Los QR se encuentran en las ubicaciones físicas</span>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="manual" className="p-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="segment-id">Número de Segmento (1-9)</Label>
                <Input
                  id="segment-id"
                  type="number"
                  min={1}
                  max={9}
                  placeholder="Ingresa un número"
                  value={segmentId}
                  onChange={(e) => setSegmentId(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <Button 
                onClick={handleManualSubmit}
                className="w-full"
              >
                Desbloquear Segmento
              </Button>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
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
