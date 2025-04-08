import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, InfoIcon } from "lucide-react";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

/**
 * Componente simplificado para ingresar códigos de segmento.
 * Debido a las limitaciones de acceso a la cámara en entornos como Replit,
 * este componente ofrece una interfaz simple para ingresar códigos manualmente.
 */
const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [manualSegmentId, setManualSegmentId] = useState<string>("");
  const { toast } = useToast();
  const { currentUser } = useUser();

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            <span>Desbloquear Segmento del Mapa</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
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
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Nota: También puedes generar los códigos QR yendo a la sección "/qr-generator"
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