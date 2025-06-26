import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useUser } from '@/context/UserContext';
import { unlockSegment } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const UnlockPage = () => {
  const [location, setLocation] = useLocation();
  const { currentUser, addUnlockedSegment } = useUser();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    segmentId?: number;
  } | null>(null);

  useEffect(() => {
    const processUnlock = async () => {
      // Obtener parámetros de la URL
      const urlParams = new URLSearchParams(window.location.search);
      const segmentId = urlParams.get('segment');
      const securityCode = urlParams.get('code');

      if (!segmentId || !securityCode) {
        setResult({
          success: false,
          message: 'Código QR inválido. Faltan parámetros requeridos.'
        });
        return;
      }

      if (!currentUser) {
        // Redirigir a login con parámetros para volver después
        setLocation(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      setIsProcessing(true);

      try {
        const response = await unlockSegment(
          currentUser.documentNumber,
          parseInt(segmentId),
          securityCode
        );

        addUnlockedSegment(response.segment.segmentId);
        
        setResult({
          success: true,
          message: `¡Segmento ${segmentId} desbloqueado exitosamente!`,
          segmentId: parseInt(segmentId)
        });

        toast({
          title: "¡Éxito!",
          description: `Segmento ${segmentId} desbloqueado`,
        });

        // Redirigir al mapa después de un breve delay
        setTimeout(() => {
          setLocation('/map');
        }, 3000);

      } catch (error: any) {
        setResult({
          success: false,
          message: error.message || 'Error al desbloquear el segmento'
        });

        toast({
          title: "Error",
          description: error.message || 'No se pudo desbloquear el segmento',
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    };

    processUnlock();
  }, [currentUser, addUnlockedSegment, setLocation, toast]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-2xl">Procesando QR...</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">
              Desbloqueando segmento del mapa...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-2xl">Cargando...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {result.success ? (
              <CheckCircle className="h-16 w-16 text-green-600" />
            ) : (
              <XCircle className="h-16 w-16 text-red-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {result.success ? '¡Éxito!' : 'Error'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600 text-lg">
            {result.message}
          </p>
          
          {result.success && result.segmentId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2 text-green-800">
                <MapPin className="h-5 w-5" />
                <span className="font-medium">Segmento {result.segmentId} desbloqueado</span>
              </div>
              <p className="text-sm text-green-600 mt-2">
                Serás redirigido al mapa en unos segundos...
              </p>
            </div>
          )}
          
          <div className="flex flex-col space-y-2">
            <Button 
              onClick={() => setLocation('/map')} 
              className="w-full"
              variant={result.success ? "default" : "outline"}
            >
              {result.success ? 'Ver Mapa' : 'Volver al Mapa'}
            </Button>
            
            {!result.success && (
              <Button 
                onClick={() => setLocation('/auth')} 
                variant="outline"
                className="w-full"
              >
                Iniciar Sesión
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnlockPage;