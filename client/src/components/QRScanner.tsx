import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { QrCode, Camera } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

/**
 * Componente para escanear códigos QR.
 */
const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [scanner, setScanner] = useState<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Inicializar el escáner QR cuando se abre el diálogo
  useEffect(() => {
    let qrScanner: any = null;
    
    if (isOpen && scannerContainerRef.current) {
      // Eliminar escáner anterior si existe
      const oldElement = document.getElementById('qr-reader');
      if (oldElement) {
        oldElement.remove();
      }
      
      // Crear nuevo contenedor para el escáner
      if (!document.getElementById('qr-reader')) {
        const container = document.createElement('div');
        container.id = 'qr-reader';
        scannerContainerRef.current.innerHTML = '';
        scannerContainerRef.current.appendChild(container);
      }

      // Configurar el escáner
      qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
          formatsToSupport: [0] // Solo formato QR
        },
        true
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

      // Iniciar el escáner
      setScanner(qrScanner);
    }

    // Limpiar cuando se desmonta el componente
    return () => {
      if (qrScanner) {
        try {
          qrScanner.clear();
        } catch (error) {
          console.error("Error al limpiar el escáner:", error);
        }
      }
    };
  }, [isOpen, onSuccess, toast]);

  // Limpiar el escáner cuando se cierra el diálogo
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      if (scanner) {
        try {
          scanner.clear();
        } catch (error) {
          console.error("Error al limpiar el escáner:", error);
        }
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
            <span>Escanear Código QR</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex gap-3 items-start">
            <Camera className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-blue-800 font-medium mb-1">
                Escaneo de Código QR
              </p>
              <p className="text-blue-700 text-sm">
                Apunta con la cámara al código QR para escanearlo automáticamente.
                Permite el acceso a la cámara cuando se te solicite.
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