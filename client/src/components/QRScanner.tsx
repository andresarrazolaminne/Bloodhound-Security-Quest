import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, QrCode, Lock, Key } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualSegmentId, setManualSegmentId] = useState<string>("");
  const [secretKey, setSecretKey] = useState<string>("");
  const [showSecretInput, setShowSecretInput] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Constants for validation
  const VALID_SECRET_KEY = "hunter2023"; // Una clave simple que solo el organizador conocería

  // Initialize scanner when dialog opens
  useEffect(() => {
    if (isOpen && mode === "scan") {
      startScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [isOpen, mode]);

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
      setError(`No se pudo acceder a la cámara. Si no puedes dar permisos, usa el modo de emergencia.`);
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

  // Handle manual entry with secret key verification
  const handleManualSubmit = () => {
    const id = parseInt(manualSegmentId);
    
    if (!showSecretInput) {
      setShowSecretInput(true);
      return;
    }
    
    if (secretKey !== VALID_SECRET_KEY) {
      toast({
        title: "Clave inválida",
        description: "La clave de seguridad ingresada no es correcta",
        variant: "destructive"
      });
      return;
    }
    
    if (!isNaN(id) && id >= 1 && id <= 9) {
      toast({
        title: "Procesando",
        description: `Desbloqueando segmento ${id}...`,
      });
      setShowSecretInput(false);
      setSecretKey("");
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
          <DialogTitle>
            {mode === "scan" ? "Escanear Código QR" : "Modo de Emergencia"}
          </DialogTitle>
          <DialogDescription>
            {mode === "scan" 
              ? "Escanea el código QR ubicado en las locaciones de la búsqueda"
              : "Este modo requiere autorización del organizador"
            }
          </DialogDescription>
        </DialogHeader>
        
        {mode === "scan" ? (
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
                    <div className="space-x-2">
                      <Button onClick={startScanner} size="sm" variant="outline">
                        Reintentar
                      </Button>
                      <Button onClick={() => setMode("manual")} size="sm">
                        Modo emergencia
                      </Button>
                    </div>
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
                    <span>Los QR se encuentran en las ubicaciones físicas</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center mb-4">
              <div className="max-w-xs mx-auto rounded-lg bg-amber-50 p-4 mb-4">
                <Lock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-amber-800">
                  Este modo está protegido y requiere una clave que solo conoce el organizador de la búsqueda.
                </p>
              </div>
              
              <div className="max-w-xs mx-auto space-y-4">
                <div className="space-y-2">
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
                </div>
                
                {showSecretInput && (
                  <div className="space-y-2">
                    <Label htmlFor="secret-key">Clave de Seguridad</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="secret-key"
                        type="password"
                        placeholder="Ingresa la clave de seguridad"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                      />
                      <Key className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                )}
                
                <Button 
                  className="w-full" 
                  onClick={handleManualSubmit}
                >
                  {showSecretInput ? "Verificar y Desbloquear" : "Continuar"}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter className="flex justify-between items-center">
          {mode === "scan" ? (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                stopScanner();
                setMode("manual");
              }}
              className="text-xs"
            >
              Modo emergencia
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setMode("scan");
                setShowSecretInput(false);
                setSecretKey("");
              }}
              className="text-xs"
            >
              Volver al escáner
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
