import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Simple utility to generate a QR code URL using the Google Charts API
const getQRCodeUrl = (data: string) => {
  // Encode the data to be URL-safe
  const encodedData = encodeURIComponent(data);
  return `https://chart.googleapis.com/chart?cht=qr&chl=${encodedData}&chs=250x250&chld=L|0`;
};

const QRGenerator = () => {
  const [segmentId, setSegmentId] = useState<number>(1);
  const [qrCodes, setQrCodes] = useState<{id: number, url: string}[]>([]);

  const handleGenerateQR = () => {
    // Format: segmentId as a simple JSON object
    const qrData = JSON.stringify({ segmentId });
    const qrUrl = getQRCodeUrl(qrData);
    
    // Add to the list, avoid duplicates
    if (!qrCodes.some(code => code.id === segmentId)) {
      setQrCodes([...qrCodes, { id: segmentId, url: qrUrl }]);
    }
  };

  const handleGenerateAll = () => {
    // Generate QR codes for all 9 segments
    const newCodes = [];
    for (let i = 1; i <= 9; i++) {
      const qrData = JSON.stringify({ segmentId: i });
      newCodes.push({
        id: i,
        url: getQRCodeUrl(qrData)
      });
    }
    setQrCodes(newCodes);
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
              <Button onClick={handleGenerateQR}>Generar QR</Button>
              <Button 
                variant="outline"
                onClick={handleGenerateAll}
              >
                Generar Todos
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