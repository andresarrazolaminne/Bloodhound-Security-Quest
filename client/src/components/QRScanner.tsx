import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { QrCode, Camera, Loader2 } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

/**
 * Componente para escanear códigos QR. Implementación simplificada para Replit.
 */
const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [scanner, setScanner] = useState<any>(null);
  const { toast } = useToast();
  const scannerRef = useRef<HTMLDivElement>(null);
  const scannerInitializedRef = useRef<boolean>(false);

  // Procesar el resultado del escaneo
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
        if (scanner) {
          scanner.clear();
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

  // Inicializar el escáner cuando el diálogo está abierto
  useEffect(() => {
    if (isOpen && scannerRef.current && !scannerInitializedRef.current) {
      const qrScannerId = "qr-reader";
      
      // Limpiar cualquier instancia anterior si existe
      const oldElement = document.getElementById(qrScannerId);
      if (oldElement) {
        oldElement.remove();
      }
      
      // Asegurarse de que el contenedor esté vacío
      while (scannerRef.current.firstChild) {
        scannerRef.current.removeChild(scannerRef.current.firstChild);
      }
      
      // Crear un nuevo div para el scanner
      const qrScannerDiv = document.createElement("div");
      qrScannerDiv.id = qrScannerId;
      scannerRef.current.appendChild(qrScannerDiv);
      
      try {
        // Inicializar el escáner con opciones para máxima compatibilidad
        const qrScanner = new Html5QrcodeScanner(
          qrScannerId,
          { 
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
            formatsToSupport: [0] // Solo QR
          },
          false // No renderizar automáticamente
        );
        
        qrScanner.render(onScanSuccess, (error: string) => {
          // No mostrar errores comunes que no afectan la funcionalidad
          if (!error.includes("No MultiFormat Readers") && 
              !error.includes("No barcode found")) {
            console.log("Error del escáner:", error);
          }
        });
        
        setScanner(qrScanner);
        scannerInitializedRef.current = true;
        
        // Limpiar al desmontar
        return () => {
          if (qrScanner) {
            try {
              qrScanner.clear();
            } catch (e) {
              console.error("Error al limpiar el escáner:", e);
            }
          }
        };
      } catch (error) {
        console.error("Error al inicializar el escáner QR:", error);
        toast({
          title: "Error de cámara",
          description: "No se pudo inicializar la cámara. Por favor, asegúrate de dar los permisos necesarios.",
          variant: "destructive"
        });
      }
    }
    
    // Limpiar cuando se cierra el diálogo
    return () => {
      if (scanner) {
        try {
          scanner.clear();
        } catch (e) {
          console.error("Error al limpiar el escáner:", e);
        }
      }
    };
  }, [isOpen, toast]);

  // Manejar el cierre del diálogo
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      // Limpiar scanner al cerrar
      if (scanner) {
        try {
          scanner.clear();
        } catch (e) {
          console.error("Error al limpiar el escáner:", e);
        }
      }
      scannerInitializedRef.current = false;
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            <span>Escanea un código QR</span>
          </DialogTitle>
          <DialogDescription>
            Apunta con la cámara a un código QR para desbloquear un segmento del mapa
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex gap-3 items-start">
            <Camera className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-blue-800 font-medium mb-1">
                Escaneo de Código QR
              </p>
              <p className="text-blue-700 text-sm">
                Cuando veas un código QR, mantén la cámara sobre él para escanearlo automáticamente.
                Permite el acceso a la cámara cuando se te solicite.
              </p>
            </div>
          </div>
        </div>
        
        <div 
          ref={scannerRef}
          className="qr-scanner-container rounded-lg overflow-hidden"
          style={{
            minHeight: "300px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center"
          }}
        >
          {/* El escáner se renderizará aquí */}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;