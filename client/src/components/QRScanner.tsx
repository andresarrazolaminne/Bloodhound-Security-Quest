import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { unlockSegment } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

// Importamos la librería de manera dinámica
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrScanner, setQrScanner] = useState<any>(null);
  const [manualSegmentId, setManualSegmentId] = useState<string>("");
  const [cameraError, setCameraError] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useUser();

  useEffect(() => {
    let scanner: any = null;

    const startScanner = async () => {
      if (!qrContainerRef.current) return;
      
      setLoading(true);
      
      // Limpiamos el contenedor antes de inicializar
      qrContainerRef.current.innerHTML = "";

      try {
        const qrScannerId = "qr-scanner-container";
        // Creamos un div para el scanner dentro del contenedor
        const scannerDiv = document.createElement("div");
        scannerDiv.id = qrScannerId;
        qrContainerRef.current.appendChild(scannerDiv);

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          aspectRatio: 1,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
        };

        // Inicializa el escáner
        scanner = new Html5QrcodeScanner(qrScannerId, config, false);
        setQrScanner(scanner);

        scanner.render(
          // Success callback
          (decodedText: string) => {
            console.log("QR Code detectado:", decodedText);
            try {
              // Intenta parsear el contenido
              let data: any;
              try {
                data = JSON.parse(decodedText);
              } catch {
                // Si no es JSON, intenta directamente como número
                const segmentId = parseInt(decodedText);
                if (!isNaN(segmentId) && segmentId >= 1 && segmentId <= 9) {
                  scanner.pause();
                  onSuccess(segmentId);
                  return;
                }
                throw new Error("Formato de QR no válido");
              }
              
              // Si es JSON, extrae el segmentId
              if (data && typeof data.segmentId === 'number') {
                const segmentId = data.segmentId;
                if (segmentId >= 1 && segmentId <= 9) {
                  scanner.pause();
                  onSuccess(segmentId);
                  return;
                }
              }
              
              toast({
                title: "QR no válido",
                description: "El código escaneado no corresponde a un segmento del mapa",
                variant: "destructive"
              });
            } catch (error) {
              console.error("Error procesando QR:", error);
              toast({
                title: "Error de formato",
                description: "El código QR no tiene el formato esperado",
                variant: "destructive"
              });
            }
          },
          // Error callback
          (errorMessage: string) => {
            // Ignoramos errores comunes durante el escaneo
            if (errorMessage.includes("No MultiFormat Readers")) return;
            if (errorMessage.includes("No barcode found")) return;
            
            console.error("Error en el escáner QR:", errorMessage);
          }
        );
        
        setScanning(true);
        setLoading(false);
        
      } catch (error) {
        console.error("Error inicializando el escáner:", error);
        setLoading(false);
        toast({
          title: "Error",
          description: "No se pudo inicializar el escáner de QR",
          variant: "destructive"
        });
      }
    };

    // Inicia o detiene el escáner según el estado de isOpen
    if (isOpen) {
      startScanner();
    } else if (qrScanner) {
      try {
        qrScanner.clear();
      } catch (error) {
        console.error("Error al detener el escáner:", error);
      }
      setQrScanner(null);
      setScanning(false);
    }

    // Limpieza cuando el componente se desmonte
    return () => {
      if (scanner) {
        try {
          scanner.clear();
        } catch (error) {
          console.error("Error al limpiar el escáner:", error);
        }
      }
    };
  }, [isOpen, onSuccess, toast]);

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
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-gray-600">Inicializando cámara...</p>
              </div>
            ) : (
              <>
                <div 
                  ref={qrContainerRef} 
                  className="qr-scanner-container"
                  style={{ maxWidth: '100%' }}
                ></div>
                
                <p className="text-gray-600 text-center text-sm mt-4">
                  Posiciona el código QR dentro del recuadro para escanearlo
                </p>
              </>
            )}
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
