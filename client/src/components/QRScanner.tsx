import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  // Iniciamos directamente en modo manual para evitar problemas con la cámara
  const [useManualMode, setUseManualMode] = useState(true);
  const [manualSegmentId, setManualSegmentId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const scannerInstanceRef = useRef<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Initialize QR Scanner when modal is opened
  useEffect(() => {
    if (isOpen && !useManualMode) {
      initializeScanner();
    }

    return () => {
      cleanupScanner();
    };
  }, [isOpen, useManualMode]);

  // Initialize the HTML5 QR Scanner
  const initializeScanner = () => {
    if (!scannerContainerRef.current) return;
    
    try {
      // Clean up previous instance if exists
      cleanupScanner();
      
      // Clear the container
      scannerContainerRef.current.innerHTML = '';
      
      // Create a new scanner instance
      const scannerId = 'html5-qr-scanner';
      const scannerElement = document.createElement('div');
      scannerElement.id = scannerId;
      scannerContainerRef.current.appendChild(scannerElement);

      // Configure scanner options
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        aspectRatio: 1,
        showTorchButtonIfSupported: true,
      };

      // Create scanner instance
      scannerInstanceRef.current = new Html5QrcodeScanner(
        scannerId,
        config,
        /* verbose= */ false
      );

      // Initialize scanner with success/error callbacks
      scannerInstanceRef.current.render(onScanSuccess, onScanFailure);
      setIsScanning(true);

      console.log("QR Scanner initialized successfully");
    } catch (error) {
      console.error("Error initializing QR scanner:", error);
      setUseManualMode(true);
      toast({
        title: "Error",
        description: "No se pudo iniciar el escáner de QR. Ingresa el código manualmente.",
        variant: "destructive"
      });
    }
  };

  // Clean up QR scanner resources
  const cleanupScanner = () => {
    if (scannerInstanceRef.current && isScanning) {
      try {
        scannerInstanceRef.current.clear();
        console.log("QR Scanner stopped and cleaned up");
      } catch (error) {
        console.error("Error cleaning up scanner:", error);
      }
      scannerInstanceRef.current = null;
      setIsScanning(false);
    }
  };

  // Handle successful QR scan
  const onScanSuccess = (decodedText: string) => {
    console.log("QR Code detected:", decodedText);
    
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
      
      console.log("Parsed segmentId:", segmentId);
      
      if (!isNaN(segmentId) && segmentId >= 1 && segmentId <= 9) {
        // Show success feedback
        toast({
          title: "¡Código detectado!",
          description: `Desbloqueando segmento ${segmentId}...`,
        });
        
        // Stop scanner and process success
        cleanupScanner();
        onSuccess(segmentId);
      } else {
        toast({
          title: "Código inválido",
          description: "El código escaneado no corresponde a un segmento válido (1-9)",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error processing QR code data:", error);
      toast({
        title: "Error",
        description: "El código QR no tiene el formato esperado",
        variant: "destructive"
      });
    }
  };

  // Handle scan failures/errors
  const onScanFailure = (error: string) => {
    // We don't need to show errors for each frame that doesn't contain a QR code
    // Only log for debugging purposes
    console.debug("QR scan error:", error);
  };

  // Handle manual submission
  const handleManualSubmit = () => {
    const id = parseInt(manualSegmentId);
    if (!isNaN(id) && id >= 1 && id <= 9) {
      toast({
        title: "Procesando",
        description: `Desbloqueando segmento ${id}...`,
      });
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
          <DialogTitle>Desbloquear Segmento de Mapa</DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          <div className="text-center mb-4">
            <p className="text-amber-600 font-medium mb-2">
              Ingreso manual de segmento
            </p>
            <p className="text-gray-600 text-sm mb-6">
              Ingresa el número del segmento que deseas desbloquear (1-9)
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
              Puedes encontrar los códigos de segmentos en la sección <strong>"/qr-generator"</strong>
            </p>
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
