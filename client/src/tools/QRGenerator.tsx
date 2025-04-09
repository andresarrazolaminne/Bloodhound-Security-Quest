import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest } from '@/lib/queryClient';
import QRCode from 'qrcode';

// Function to generate QR code as data URL
const generateQRCode = async (data: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(data, {
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
};

// Function to generate a random security code
const generateSecurityCode = (length: number = 5): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

interface QRCodeData {
  id: number;
  securityCode: string;
  url: string;
  format: string;
}

const QRGenerator = () => {
  const [segmentId, setSegmentId] = useState<number>(1);
  const [securityCode, setSecurityCode] = useState<string>("");
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(false);
  const [qrFormat, setQrFormat] = useState<string>("json");
  const [mapAssets, setMapAssets] = useState<any[]>([]);

  // Cargar assets del mapa al inicio para obtener códigos de seguridad existentes
  useEffect(() => {
    const fetchMapAssets = async () => {
      try {
        setIsLoadingAssets(true);
        const response = await apiRequest("GET", "/api/admin/map-assets");
        const data = await response.json();
        setMapAssets(data.assets || []);
      } catch (error) {
        console.error("Error cargando segmentos del mapa:", error);
      } finally {
        setIsLoadingAssets(false);
      }
    };
    
    fetchMapAssets();
  }, []);
  
  useEffect(() => {
    // Obtener el código de seguridad del asset seleccionado
    const selectedAsset = mapAssets.find(asset => asset.segmentId === segmentId);
    if (selectedAsset && selectedAsset.securityCode) {
      setSecurityCode(selectedAsset.securityCode);
    } else {
      // Si no existe un código para este segmento, generar uno aleatorio
      setSecurityCode(generateSecurityCode());
    }
  }, [segmentId, mapAssets]);

  const handleGenerateQR = async () => {
    setIsLoading(true);
    
    try {
      let qrData: string;
      let format: string;
      
      // Generar el contenido QR según el formato seleccionado
      switch (qrFormat) {
        case "json":
          // Formato como objeto JSON
          qrData = JSON.stringify({ 
            segmentId, 
            securityCode
          });
          format = "JSON";
          break;
        case "text":
          // Formato como texto simple: "ID:CODIGO"
          qrData = `${segmentId}:${securityCode}`;
          format = "Texto";
          break;
        default:
          qrData = JSON.stringify({ segmentId });
          format = "JSON Simple";
      }
      
      const qrUrl = await generateQRCode(qrData);
      
      // Add to the list, avoid duplicates
      if (!qrCodes.some(code => code.id === segmentId)) {
        setQrCodes([...qrCodes, { id: segmentId, securityCode, url: qrUrl, format }]);
      } else {
        // Update existing QR code
        setQrCodes(qrCodes.map(code => 
          code.id === segmentId ? { id: segmentId, securityCode, url: qrUrl, format } : code
        ));
      }
    } catch (error) {
      console.error("Error generating QR code:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    setIsLoading(true);
    try {
      // Generate QR codes for all 9 segments
      const newCodesPromises = Array.from({ length: 9 }, async (_, i) => {
        const id = i + 1;
        
        // Obtener el código de seguridad de los assets o generar uno nuevo
        const asset = mapAssets.find(a => a.segmentId === id);
        const code = asset?.securityCode || generateSecurityCode();
        
        // Generar el contenido QR según el formato seleccionado
        let qrData: string;
        let format: string;
        
        switch (qrFormat) {
          case "json":
            qrData = JSON.stringify({ segmentId: id, securityCode: code });
            format = "JSON";
            break;
          case "text":
            qrData = `${id}:${code}`;
            format = "Texto";
            break;
          default:
            qrData = JSON.stringify({ segmentId: id });
            format = "JSON Simple";
        }
        
        const url = await generateQRCode(qrData);
        return { id, securityCode: code, url, format };
      });
      
      const newCodes = await Promise.all(newCodesPromises);
      setQrCodes(newCodes);
    } catch (error) {
      console.error("Error generating all QR codes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generador de Códigos QR</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="segment-id" className="mb-2 block">ID del Segmento (1-9)</Label>
                <Input
                  id="segment-id"
                  type="number"
                  min={1}
                  max={9}
                  value={segmentId}
                  onChange={(e) => setSegmentId(parseInt(e.target.value) || 1)}
                  className="mb-1"
                />
                <p className="text-xs text-gray-500">ID del segmento del mapa a desbloquear</p>
              </div>
              
              <div>
                <Label htmlFor="security-code" className="mb-2 block">Código de Seguridad</Label>
                <div className="flex gap-2">
                  <Input
                    id="security-code"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value.toUpperCase())}
                    className="mb-1 font-mono uppercase"
                    maxLength={5}
                    placeholder="ABC12"
                  />
                  <Button 
                    variant="outline"
                    onClick={() => setSecurityCode(generateSecurityCode())}
                    type="button"
                    className="shrink-0"
                  >
                    Nuevo
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {isLoadingAssets ? "Cargando códigos..." : mapAssets.find(a => a.segmentId === segmentId)?.securityCode 
                    ? "Mostrando código actual del segmento" 
                    : "No hay código configurado para este segmento"}
                </p>
              </div>
            </div>
            
            <div className="mb-4">
              <Label className="mb-2 block">Formato del QR</Label>
              <RadioGroup 
                value={qrFormat} 
                onValueChange={setQrFormat}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="format-json" />
                  <Label htmlFor="format-json" className="cursor-pointer">
                    JSON ({"{"}"segmentId": {segmentId}, "securityCode": "{securityCode}"{"}"})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="text" id="format-text" />
                  <Label htmlFor="format-text" className="cursor-pointer">
                    Texto ({`${segmentId}:${securityCode}`})
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleGenerateQR} 
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Generando...' : 'Generar QR'}
              </Button>
              <Button 
                variant="outline"
                onClick={handleGenerateAll}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Generando...' : 'Generar Todos'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {qrCodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {qrCodes.map((code) => (
            <Card key={code.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Segmento {code.id}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  Código: <span className="font-mono font-medium">{code.securityCode}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center pt-2">
                <img 
                  src={code.url} 
                  alt={`QR Code for segment ${code.id}`} 
                  className="mb-3 border border-gray-200 p-2 rounded-lg" 
                  style={{ width: '180px', height: '180px' }}
                />
                <div className="text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded-md w-full text-center">
                  <p className="mb-1">Formato: {code.format}</p>
                  <p className="font-semibold">
                    Escanea este QR para desbloquear el segmento {code.id}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default QRGenerator;