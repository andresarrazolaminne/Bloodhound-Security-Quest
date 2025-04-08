import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

// Importamos la librería 
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);
  const [manualSegmentId, setManualSegmentId] = useState<string>("");
  const [cameraError, setCameraError] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Función para iniciar el escáner
  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const startScanner = () => {
      setCameraError(false);
      setLoading(true);
      console.log("Iniciando escáner de QR...");

      // Esperamos a que el componente esté montado
      timeoutId = setTimeout(async () => {
        try {
          // Verificamos que el elemento exista
          const qrElement = document.getElementById("qr-reader");
          if (!qrElement) {
            throw new Error("Elemento qr-reader no encontrado");
          }

          // Inicializamos el escáner
          scanner = new Html5Qrcode("qr-reader");
          setQrScanner(scanner);

          // Obtenemos las cámaras disponibles
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const cameraId = devices[0].id;
            console.log("Solicitando acceso a la cámara...");

            const config = {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1,
            };

            await scanner.start(
              cameraId,
              config,
              (decodedText) => {
                console.log("QR Code detectado:", decodedText);
                processQRCode(decodedText, scanner);
              },
              () => {} // Error callback silencioso
            );

            console.log("Cámara accedida correctamente");
            setScanning(true);
            setLoading(false);
          } else {
            throw new Error("No se detectaron cámaras");
          }
        } catch (error) {
          console.error("Error inicializando el escáner:", error);
          setCameraError(true);
          setLoading(false);
          toast({
            title: "Error de cámara",
            description: "No se pudo acceder a la cámara. Permite el acceso o ingresa el código manualmente.",
            variant: "destructive"
          });
        }
      }, 500); // Pequeño delay para asegurar que el DOM esté listo
    };

    // Procesar el código QR detectado
    const processQRCode = async (decodedText: string, scanner: Html5Qrcode | null) => {
      try {
        let segmentId: number;
        
        try {
          // Intenta parsear como JSON
          const data = JSON.parse(decodedText);
          if (data && typeof data.segmentId === 'number') {
            segmentId = data.segmentId;
          } else {
            throw new Error("JSON no válido");
          }
        } catch (jsonError) {
          // Si no es JSON, intenta como número directo
          segmentId = parseInt(decodedText);
          if (isNaN(segmentId)) {
            throw new Error("No es un número válido");
          }
        }
        
        // Verificar rango válido
        if (segmentId >= 1 && segmentId <= 9) {
          // Detener el escáner antes de continuar
          if (scanner) {
            await scanner.stop();
            setQrScanner(null);
          }
          onSuccess(segmentId);
        } else {
          throw new Error("Segmento fuera de rango (1-9)");
        }
      } catch (error) {
        console.error("Error procesando QR:", error);
        toast({
          title: "QR no válido",
          description: "El código escaneado no corresponde a un segmento del mapa",
          variant: "destructive"
        });
      }
    };

    // Gestión del ciclo de vida del componente
    if (isOpen) {
      startScanner();
    } else if (qrScanner) {
      qrScanner.stop()
        .then(() => {
          console.log("Escáner detenido correctamente");
          setQrScanner(null);
          setScanning(false);
        })
        .catch((error: any) => {
          console.error("Error al detener el escáner:", error);
        });
    }

    // Limpiar al desmontar
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (qrScanner) {
        qrScanner.stop().catch((error: any) => {
          console.error("Error al limpiar el escáner:", error);
        });
      }
    };
  }, [isOpen, onSuccess, toast]);

  // Manejar envío manual
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
                  id="qr-reader" 
                  style={{ 
                    width: '100%', 
                    maxWidth: '400px',
                    margin: '0 auto'
                  }}
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