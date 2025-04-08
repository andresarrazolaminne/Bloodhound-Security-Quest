import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Loader2, Camera, RotateCcw, QrCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  // State
  const [tab, setTab] = useState<"camera" | "manual">("camera");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segmentId, setSegmentId] = useState<string>("");
  
  // Refs
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  
  // Hooks
  const { toast } = useToast();

  // Initialize/cleanup QR scanner when dialog opens/closes
  useEffect(() => {
    if (isOpen && tab === "camera") {
      startScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [isOpen, tab]);

  // Start HTML5 QR scanner
  const startScanner = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!scannerContainerRef.current) {
        throw new Error("Elemento de escaneo no encontrado");
      }
      
      console.log("Iniciando escáner HTML5 QR...");
      
      // Create scanner instance if it doesn't exist
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      }
      
      const qrCodeSuccessCallback = (decodedText: string) => {
        console.log("QR code detected:", decodedText);
        handleQRCodeDetected(decodedText);
      };
      
      const config = { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [0] // QR_CODE only
      };
      
      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        (errorMessage) => {
          // This is a verbose callback - we don't need to show every frame error
          console.debug("QR scan error:", errorMessage);
        }
      );
      
      setIsLoading(false);
      console.log("Escáner QR iniciado correctamente");
    } catch (err) {
      console.error("Error al iniciar el escáner:", err);
      setError("No se pudo iniciar el escáner de QR. Verifica los permisos de cámara.");
      setIsLoading(false);
    }
  };

  // Stop HTML5 QR scanner
  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        console.log("Escáner detenido");
      } catch (error) {
        console.error("Error al detener el escáner:", error);
      }
    }
  };

  // Handle manual input
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
    
    stopScanner();
    onSuccess(id);
  };

  // Process detected QR code
  const handleQRCodeDetected = (decodedText: string) => {
    try {
      // Try to parse as JSON first (from our generator)
      let id;
      try {
        const data = JSON.parse(decodedText);
        id = data.segmentId;
      } catch {
        // If not valid JSON, try direct parsing
        id = parseInt(decodedText);
      }
      
      if (!isNaN(id) && id >= 1 && id <= 9) {
        toast({
          title: "¡Código detectado!",
          description: `Desbloqueando segmento ${id}...`,
        });
        
        stopScanner();
        onSuccess(id);
      } else {
        toast({
          title: "Código inválido",
          description: "El código QR no contiene un ID de segmento válido",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error processing QR code:", err);
      toast({
        title: "Error",
        description: "El código QR no tiene el formato esperado",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear Código QR</DialogTitle>
          <DialogDescription>
            Escanea el código QR ubicado en las locaciones físicas
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="camera" value={tab} onValueChange={(value) => setTab(value as "camera" | "manual")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera">Cámara</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="camera" className="p-4">
            <div className="flex flex-col items-center">
              <div className="w-full max-w-xs rounded-lg overflow-hidden">
                {isLoading ? (
                  <div className="h-64 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-sm text-gray-600">Activando cámara...</p>
                  </div>
                ) : error ? (
                  <div className="h-64 flex flex-col items-center justify-center bg-gray-100 p-4 rounded-lg">
                    <Camera className="h-10 w-10 text-gray-400 mb-4" />
                    <p className="text-sm text-red-500 font-medium mb-2 text-center">Error de cámara</p>
                    <p className="text-xs text-gray-600 mb-4 text-center">{error}</p>
                    <Button onClick={startScanner} size="sm" variant="outline" className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Reintentar
                    </Button>
                  </div>
                ) : (
                  <div id="qr-reader" ref={scannerContainerRef} className="w-full"></div>
                )}
              </div>
              
              {!isLoading && !error && (
                <p className="text-sm text-gray-600 mt-4 text-center">
                  Posiciona el código QR dentro del recuadro para escanearlo
                </p>
              )}
              
              <div className="flex items-center justify-center mt-2 text-sm text-gray-500">
                <QrCode className="h-4 w-4 mr-1" />
                <span>Los QR se encuentran en las ubicaciones físicas</span>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="manual" className="p-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-full max-w-xs p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                </div>
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md w-full max-w-xs">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <p className="text-sm text-gray-500 mt-2 text-center">
                Solo utiliza este método si el escáner de QR no funciona correctamente
              </p>
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
