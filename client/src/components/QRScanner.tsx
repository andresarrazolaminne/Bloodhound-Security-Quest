import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  // State for manual input
  const [segmentId, setSegmentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
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
    
    onSuccess(id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desbloquear Segmento</DialogTitle>
          <DialogDescription>
            Ingresa el número del segmento que deseas desbloquear
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4">
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
