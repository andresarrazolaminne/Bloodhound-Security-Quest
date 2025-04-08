import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import QRCode from 'qrcode';

// Function to generate QR code as data URL
const generateQRCode = async (data: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(data, {
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'L'
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
};

const QRGenerator = () => {
  const [segmentId, setSegmentId] = useState<number>(1);
  const [qrCodes, setQrCodes] = useState<{id: number, url: string}[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleGenerateQR = async () => {
    setIsLoading(true);
    // Format: segmentId as a simple JSON object
    const qrData = JSON.stringify({ segmentId });
    
    try {
      const qrUrl = await generateQRCode(qrData);
      
      // Add to the list, avoid duplicates
      if (!qrCodes.some(code => code.id === segmentId)) {
        setQrCodes([...qrCodes, { id: segmentId, url: qrUrl }]);
      } else {
        // Update existing QR code
        setQrCodes(qrCodes.map(code => 
          code.id === segmentId ? { ...code, url: qrUrl } : code
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
      const newCodesPromises = Array.from({ length: 9 }, (_, i) => {
        const id = i + 1;
        const qrData = JSON.stringify({ segmentId: id });
        return generateQRCode(qrData).then(url => ({ id, url }));
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
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="segment-id">ID del Segmento (1-9)</Label>
                <Input
                  id="segment-id"
                  type="number"
                  min={1}
                  max={9}
                  value={segmentId}
                  onChange={(e) => setSegmentId(parseInt(e.target.value) || 1)}
                />
              </div>
              <Button 
                onClick={handleGenerateQR} 
                disabled={isLoading}
              >
                {isLoading ? 'Generando...' : 'Generar QR'}
              </Button>
              <Button 
                variant="outline"
                onClick={handleGenerateAll}
                disabled={isLoading}
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
              <CardHeader>
                <CardTitle>Segmento {code.id}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <img 
                  src={code.url} 
                  alt={`QR Code for segment ${code.id}`} 
                  className="mb-2" 
                />
                <p className="text-sm text-muted-foreground">
                  Escanea este código para desbloquear el segmento {code.id}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default QRGenerator;