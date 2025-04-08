import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Camera, InfoIcon } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

/**
 * Componente para escanear códigos QR o ingresar manualmente códigos de segmento.
 */
const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [activeTab, setActiveTab] = useState<string>("manual");
  const [manualSegmentId, setManualSegmentId] = useState<string>("");
  const [scanner, setScanner] = useState<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Inicializar el escáner QR
  useEffect(() => {
    if (isOpen && activeTab === "scanner" && scannerContainerRef.current) {
      // Crear el contenedor para el escáner si no existe
      if (!document.getElementById('qr-reader')) {
        const container = document.createElement('div');
        container.id = 'qr-reader';
        scannerContainerRef.current.innerHTML = '';
        scannerContainerRef.current.appendChild(container);
      }

      // Configurar el escáner con opciones específicas para mayor compatibilidad
      const qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          // Para Replit es importante mostrar estos botones
          showZoomSliderIfSupported: true,
          supportedScanTypes: [0], // Solo escanear QR
        },
        true // render inmediato
      );

      // Función de éxito para procesar el código QR
      const onScanSuccess = (decodedText: string) => {
        console.log("QR escaneado:", decodedText);
        try {
          // Intentar procesar el contenido como JSON
          let segmentId: number;
          try {
            const data = JSON.parse(decodedText);
            if (data && typeof data.segmentId === 'number') {
              segmentId = data.segmentId;
            } else {
              throw new Error("Formato JSON inválido");
            }
          } catch (error) {
            // Si no es JSON, intentar directamente como número
            segmentId = parseInt(decodedText);
            if (isNaN(segmentId)) {
              throw new Error("No es un número válido");
            }
          }

          // Verificar el rango válido
          if (segmentId >= 1 && segmentId <= 9) {
            // Detener el escáner y notificar éxito
            if (qrScanner) {
              qrScanner.clear();
            }
            onSuccess(segmentId);
          } else {
            throw new Error("Segmento fuera de rango (1-9)");
          }
        } catch (error) {
          console.error("Error procesando QR:", error);
          toast({
            title: "Código QR no válido",
            description: "El código escaneado no corresponde a un segmento del mapa",
            variant: "destructive"
          });
        }
      };

      // Registrar el escáner
      qrScanner.render(onScanSuccess, (error: any) => {
        // Ignorar errores comunes del escáner que no afectan el funcionamiento
        if (!error.includes("No MultiFormat Readers") && !error.includes("No barcode found")) {
          console.warn("Error del escáner:", error);
        }
      });

      setScanner(qrScanner);

      return () => {
        if (qrScanner) {
          qrScanner.clear();
        }
      };
    }
  }, [isOpen, activeTab, onSuccess, toast]);

  // Manejar cambio de tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Limpiar el escáner si se cambia a manual
    if (value === "manual" && scanner) {
      scanner.clear();
    }
  };

  // Manejar envío manual
  const handleManualSubmit = () => {
    const id = parseInt(manualSegmentId);
    if (!isNaN(id) && id >= 1 && id <= 9) {
      onSuccess(id);
      setManualSegmentId("");
    } else {
      toast({
        title: "Error",
        description: "Por favor ingresa un número válido entre 1 y 9",
        variant: "destructive"
      });
    }
  };

  // Limpiar el escáner cuando se cierra el diálogo
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      if (scanner) {
        scanner.clear();
      }
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            <span>Desbloquear Segmento del Mapa</span>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="manual" value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="manual" className="flex items-center gap-1">
              <InfoIcon className="h-4 w-4" />
              <span>Manual</span>
            </TabsTrigger>
            <TabsTrigger value="scanner" className="flex items-center gap-1">
              <Camera className="h-4 w-4" />
              <span>Escáner QR</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="mt-0">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3 items-start">
                <InfoIcon className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-medium mb-1">
                    Ingreso Manual de Código
                  </p>
                  <p className="text-amber-700 text-sm">
                    Ingresa el número de segmento (1-9) que deseas desbloquear. 
                    Puedes obtener estos códigos escaneando los QR en la exposición o en el generador de QR.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <Label htmlFor="segment-id-manual" className="text-base">Número de Segmento</Label>
              <Input
                id="segment-id-manual"
                type="number"
                min={1}
                max={9}
                placeholder="Ingresa un número del 1 al 9"
                value={manualSegmentId}
                onChange={(e) => setManualSegmentId(e.target.value)}
                className="text-lg py-6"
              />
              <Button 
                className="w-full mt-2 py-6 text-base" 
                onClick={handleManualSubmit}
                size="lg"
              >
                Desbloquear Segmento
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="scanner" className="mt-0">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex gap-3 items-start">
                <Camera className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-blue-800 font-medium mb-1">
                    Escaneo de Código QR
                  </p>
                  <p className="text-blue-700 text-sm">
                    Apunta con la cámara al código QR para escanear automáticamente.
                    Si hay problemas, usa la opción de ingreso manual.
                  </p>
                </div>
              </div>
            </div>
            
            <div 
              ref={scannerContainerRef} 
              className="qr-scanner-container"
              style={{
                minHeight: "300px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
              }}
            >
              {/* El scanner se renderizará aquí */}
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