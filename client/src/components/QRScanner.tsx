import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Loader2, Camera, QrCode } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Initialize scanner when dialog opens
  useEffect(() => {
    if (isOpen) {
      startScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  // Start QR Scanner
  const startScanner = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      // Esperar un momento para asegurar que el elemento DOM esté listo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Usar la referencia para asegurar que el elemento existe
      if (!qrReaderRef.current) {
        throw new Error("Elemento QR no encontrado en el DOM");
      }
      
      // Si ya hay un escáner existente, deténgalo primero
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (e) {
          console.log("Error al detener el escáner anterior:", e);
        }
        scannerRef.current = null;
      }
      
      // Crear una nueva instancia
      scannerRef.current = new Html5Qrcode("qr-reader");
      
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        const cameraId = devices[0].id;
        
        await scannerRef.current.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          handleScanSuccess,
          handleScanFailure
        );
        
        setIsScanning(true);
        console.log("QR scanner started successfully");
      } else {
        throw new Error("No se detectaron cámaras disponibles");
      }
    } catch (err) {
      console.error("Error starting QR scanner:", err);
      setError(`No se pudo acceder a la cámara. Por favor verifica que has dado permiso al navegador para usar la cámara.`);
    } finally {
      setIsInitializing(false);
    }
  };

  // Stop QR Scanner
  const stopScanner = () => {
    if (scannerRef.current && isScanning) {
      try {
        scannerRef.current.stop();
        console.log("QR scanner stopped");
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      setIsScanning(false);
    }
  };

  // Handle successful QR scan
  const handleScanSuccess = (decodedText: string) => {
    console.log("QR code detected:", decodedText);
    
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
        
        stopScanner();
        onSuccess(segmentId);
      } else {
        toast({
          title: "Código inválido",
          description: "El código QR escaneado no corresponde a un segmento del mapa",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error processing QR code:", error);
      toast({
        title: "Error",
        description: "El código QR no tiene el formato esperado",
        variant: "destructive"
      });
    }
  };

  // Handle QR scan failures (silent for most cases)
  const handleScanFailure = (errorMessage: string) => {
    // Solo registramos para depuración, no mostramos errores al usuario por cada frame sin QR
    console.debug("QR scan error:", errorMessage);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear Código QR</DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          <div className="text-center mb-4">
            {isInitializing ? (
              <div className="w-full max-w-xs mx-auto rounded-lg overflow-hidden bg-gray-100" style={{ height: "300px" }}>
                <div className="h-full flex flex-col items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-sm text-gray-600">Iniciando cámara...</p>
                </div>
              </div>
            ) : error ? (
              <div className="w-full max-w-xs mx-auto rounded-lg overflow-hidden bg-gray-100" style={{ height: "300px" }}>
                <div className="h-full flex flex-col items-center justify-center p-4">
                  <Camera className="h-10 w-10 text-gray-400 mb-4" />
                  <p className="text-sm text-red-500 font-medium mb-2">Error de cámara</p>
                  <p className="text-xs text-gray-600 mb-4">{error}</p>
                  <Button onClick={startScanner} size="sm">
                    Reintentar
                  </Button>
                </div>
              </div>
            ) : (
              <div id="qr-reader" ref={qrReaderRef} className="w-full max-w-xs mx-auto rounded-lg overflow-hidden" style={{ height: "300px" }}></div>
            )}
            
            {isScanning && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Posiciona el código QR dentro del recuadro para escanearlo
                </p>
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <QrCode className="h-4 w-4 mr-1" />
                  <span>Los QR se generan en ubicaciones físicas de la búsqueda del tesoro</span>
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
