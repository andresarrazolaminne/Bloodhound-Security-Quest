import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Camera, InfoIcon } from "lucide-react";

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
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Manejar entrada manual directamente
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

  // Manejar cambio de tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Limpiar cuando se cierra el diálogo y resetear el estado
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      // Reset al estado inicial cuando se cierra
      setActiveTab("manual");
      setManualSegmentId("");
      
      // Notificar al componente padre
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
                    Debido a restricciones técnicas en Replit, el escáner QR no está disponible en este momento.
                    Por favor utiliza la opción manual en su lugar.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="border border-blue-200 rounded-lg p-8 text-center">
              <Camera className="h-16 w-16 mx-auto mb-4 text-blue-400" />
              <h3 className="text-lg font-medium text-blue-800 mb-2">Función no disponible</h3>
              <p className="text-sm text-blue-700 mb-6">
                El escáner de QR no está disponible en este entorno.
                Por favor, usa la entrada manual en la pestaña anterior.
              </p>
              <Button 
                onClick={() => setActiveTab("manual")}
                className="mx-auto"
              >
                Ir a entrada manual
              </Button>
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