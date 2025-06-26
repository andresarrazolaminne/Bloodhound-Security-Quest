import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { login, unlockSegment } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Handler específico para códigos QR que vienen desde URLs externas
const QRUnlockHandler = () => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    segmentId?: number;
  } | null>(null);

  useEffect(() => {
    const handleUnlock = async () => {
      try {
        // Obtener parámetros de la URL
        const urlParams = new URLSearchParams(window.location.search);
        const segmentId = urlParams.get('segment');
        const securityCode = urlParams.get('code');

        console.log('QRUnlockHandler - Parámetros:', { segmentId, securityCode });

        if (!segmentId || !securityCode) {
          setResult({
            success: false,
            message: 'URL de QR inválida. Faltan parámetros requeridos.'
          });
          setIsProcessing(false);
          return;
        }

        // Intentar obtener el último usuario logueado
        const lastDocument = localStorage.getItem("last_login_document");
        
        if (!lastDocument) {
          // Si no hay usuario guardado, redirigir al login con los parámetros
          console.log('QRUnlockHandler - Sin usuario guardado, redirigiendo al login');
          setLocation(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }

        console.log('QRUnlockHandler - Intentando auto-login con:', lastDocument);
        
        // Auto-login
        const loginResponse = await login(lastDocument);
        console.log('QRUnlockHandler - Login exitoso:', loginResponse.user);

        // Procesar desbloqueo del segmento
        console.log('QRUnlockHandler - Desbloqueando segmento:', segmentId);
        const unlockResponse = await unlockSegment(
          loginResponse.user.documentNumber,
          parseInt(segmentId),
          securityCode
        );

        console.log('QRUnlockHandler - Desbloqueo exitoso:', unlockResponse);

        // Guardar el usuario en localStorage para persistencia
        localStorage.setItem('currentUser', JSON.stringify(loginResponse.user));
        
        // Verificar si es un QR trampa
        if (unlockResponse.isTrap) {
          // QR Trampa - no desbloquea segmento real, solo otorga puntos falsos
          setResult({
            success: true,
            message: unlockResponse.message || `¡Situación de riesgo reportada! Has ganado ${unlockResponse.trapPoints || 1} punto(s) falso(s).`,
            segmentId: parseInt(segmentId)
          });

          toast({
            title: "🎯 QR Trampa",
            description: `+${unlockResponse.trapPoints || 1} punto(s) falso(s)`,
          });
        } else {
          // QR Normal - desbloquea segmento real
          // Actualizar segmentos desbloqueados
          const existingSegments = JSON.parse(localStorage.getItem('unlockedSegments') || '[]');
          const uniqueSegments = Array.from(new Set([...existingSegments, unlockResponse.segment.segmentId]));
          localStorage.setItem('unlockedSegments', JSON.stringify(uniqueSegments));

          setResult({
            success: true,
            message: `¡Segmento ${segmentId} desbloqueado exitosamente!`,
            segmentId: parseInt(segmentId)
          });

          toast({
            title: "¡Éxito!",
            description: `Segmento ${segmentId} desbloqueado`,
          });
        }

        // Redirigir al mapa después de mostrar el resultado
        setTimeout(() => {
          setLocation('/map');
        }, 3000);

      } catch (error: any) {
        console.error('QRUnlockHandler - Error:', error);
        
        let errorMessage = 'Error al procesar el código QR';
        
        if (error.message?.includes('Segment already unlocked')) {
          errorMessage = 'Este segmento ya fue desbloqueado anteriormente';
        } else if (error.message?.includes('Invalid security code')) {
          errorMessage = 'Código de seguridad inválido';
        } else if (error.message?.includes('User not found')) {
          errorMessage = 'Usuario no encontrado';
        }

        setResult({
          success: false,
          message: errorMessage
        });

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    };

    handleUnlock();
  }, [setLocation, toast]);

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
                <span className="font-medium">
                  {result.message.includes('trampa') || result.message.includes('falso') ? 
                    `QR Trampa - Segmento ${result.segmentId}` : 
                    `Segmento ${result.segmentId} desbloqueado`
                  }
                </span>
              </div>
              <p className="text-sm text-green-600 mt-2">
                {result.message.includes('trampa') || result.message.includes('falso') ? 
                  'Continúa buscando riesgos reales para desbloquear el mapa...' :
                  'Serás redirigido al mapa en unos segundos...'
                }
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

export default QRUnlockHandler;