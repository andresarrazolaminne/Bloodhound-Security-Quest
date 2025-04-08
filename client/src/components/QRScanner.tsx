import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { Loader2, Camera, Upload, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segmentId: number) => void;
}

const QRScanner = ({ isOpen, onClose, onSuccess }: QRScannerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segmentId, setSegmentId] = useState<string>("");
  const [tab, setTab] = useState<string>("file"); // "file" | "input"
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { currentUser } = useUser();

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSegmentId("");
      setSelectedFile(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Por favor selecciona una imagen válida");
        return;
      }
      
      setSelectedFile(file);
      setError(null);
      processQRCodeFromImage(file);
    }
  };

  // Process QR code from image file
  const processQRCodeFromImage = async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Convert file to image
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = async () => {
        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error("No se pudo crear el contexto del canvas");
        }
        
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Process with jsQR
        const jsQR = (await import('jsqr')).default;
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        
        if (code) {
          handleQRCodeDetected(code.data);
        } else {
          setError("No se detectó ningún código QR en la imagen");
          setIsLoading(false);
        }
        
        // Clean up
        URL.revokeObjectURL(imageUrl);
      };
      
      img.onerror = () => {
        setError("No se pudo cargar la imagen");
        setIsLoading(false);
        URL.revokeObjectURL(imageUrl);
      };
      
      img.src = imageUrl;
    } catch (err) {
      console.error("Error processing QR code:", err);
      setError("Error al procesar la imagen. Por favor intenta con otra.");
      setIsLoading(false);
    }
  };

  // Handle manual input submission
  const handleManualSubmit = () => {
    const id = parseInt(segmentId);
    if (isNaN(id) || id < 1 || id > 9) {
      setError("Por favor ingresa un número válido entre 1 y 9");
      return;
    }
    
    handleSegmentId(id);
  };

  // Handle detected QR code
  const handleQRCodeDetected = (decodedText: string) => {
    try {
      // Try to parse as JSON first (from our generator)
      let id;
      try {
        const data = JSON.parse(decodedText);
        id = data.segmentId;
      } catch {
        // If not valid JSON, try direct parsing
        id = parseInt(decodedText);
      }
      
      if (!isNaN(id) && id >= 1 && id <= 9) {
        handleSegmentId(id);
      } else {
        setError("El código QR no contiene un ID de segmento válido (1-9)");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error processing QR code:", err);
      setError("El código QR no tiene el formato esperado");
      setIsLoading(false);
    }
  };

  // Process valid segment ID
  const handleSegmentId = (id: number) => {
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
            Escanea un código QR o sube una imagen que contenga el QR para desbloquear un segmento
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="file" value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">Subir QR</TabsTrigger>
            <TabsTrigger value="input">Entrada Manual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="file" className="p-4">
            <div className="text-center space-y-4">
              <div className="w-full max-w-xs mx-auto bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-32">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-sm text-gray-600">Procesando imagen...</p>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center">
                      <img 
                        src={URL.createObjectURL(selectedFile)} 
                        alt="Vista previa" 
                        className="max-h-32 max-w-full rounded"
                      />
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {selectedFile.name}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setError(null);
                      }}
                    >
                      Cambiar imagen
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32">
                    <Upload className="h-10 w-10 text-gray-400 mb-2" />
                    <Label 
                      htmlFor="qr-file" 
                      className="text-sm text-gray-600 cursor-pointer hover:text-primary"
                    >
                      Haz clic para seleccionar una imagen
                    </Label>
                    <Input
                      id="qr-file"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Soporta JPG, PNG, etc.
                    </p>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <div className="flex items-center justify-center text-sm text-gray-500 mt-2">
                <QrCode className="h-4 w-4 mr-1" />
                <span>Fotografía los códigos QR de las ubicaciones físicas</span>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="input" className="p-4">
            <div className="text-center space-y-4">
              <div className="w-full max-w-xs mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : "Verificar Segmento"}
                  </Button>
                </div>
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <div className="flex items-center justify-center text-sm text-gray-500 mt-2">
                <Camera className="h-4 w-4 mr-1" />
                <span>Sólo los organizadores tienen acceso a los códigos</span>
              </div>
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
