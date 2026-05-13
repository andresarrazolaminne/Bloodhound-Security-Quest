import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { login, unlockSegment } from '@/lib/api';
import { useUser } from '@/context/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TrapMessageModal from '@/components/TrapMessageModal';
import SegmentContentModal from '@/components/SegmentContentModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { playQRSuccessSound, playQRErrorSound } from '@/lib/sounds';
import { withUiCampaign, playerScopedStorageKey, getCampaignSlugFromPath } from '@/lib/paths';

// Handler específico para códigos QR que vienen desde URLs externas
const QRUnlockHandler = () => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { setCurrentUser, addUnlockedSegment } = useUser();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    title?: string;
    segmentId?: number;
    isTrap?: boolean;
    trapMessage?: string;
    trapPoints?: number;
    modalContent?: string;
    segmentTitle?: string;
  } | null>(null);
  const [showTrapModal, setShowTrapModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);

  // Cargar configuración del sistema para mensajes personalizados
  const { data: systemConfig, isLoading: isConfigLoading } = useQuery({
    queryKey: ['/api/system-config'],
    staleTime: 0, // Sin cache para obtener mensajes actualizados
    gcTime: 0 // Sin cache para obtener mensajes actualizados (TanStack Query v5)
  });

  useEffect(() => {
    const handleUnlock = async () => {
      try {
        // Esperar a que se cargue la configuración del sistema
        if (isConfigLoading || !systemConfig) {
          return;
        }
        
        // Invalidar cache para obtener mensajes actualizados
        await queryClient.invalidateQueries({ queryKey: ['/api/system-config'] });
        
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

        const qrSlug =
          getCampaignSlugFromPath(window.location.pathname)?.trim() || undefined;

        // Intentar obtener el último usuario logueado (clave por campaña)
        const lastDocument =
          localStorage.getItem(playerScopedStorageKey("lastDocument")) ??
          localStorage.getItem("lastDocument");

        if (!lastDocument) {
          // Si no hay usuario guardado, redirigir al login con los parámetros
          console.log('QRUnlockHandler - Sin usuario guardado, redirigiendo al login');
          setLocation(
            `${withUiCampaign('/auth')}?redirect=${encodeURIComponent(
              window.location.pathname + window.location.search,
            )}`,
          );
          return;
        }

        console.log('QRUnlockHandler - Intentando auto-login con:', lastDocument);
        
        // Auto-login
        const loginResponse = await login(lastDocument, qrSlug);
        console.log('QRUnlockHandler - Login exitoso:', loginResponse.user);

        // Procesar desbloqueo del segmento
        console.log('QRUnlockHandler - Desbloqueando segmento:', segmentId);
        const unlockResponse = await unlockSegment(
          loginResponse.user.documentNumber,
          parseInt(segmentId),
          securityCode,
          qrSlug,
        );

        console.log('QRUnlockHandler - Desbloqueo exitoso:', unlockResponse);

        if (
          unlockResponse.needsQuiz &&
          unlockResponse.challengeToken &&
          Array.isArray(unlockResponse.quizOptionLabels) &&
          unlockResponse.quizOptionLabels.length > 0
        ) {
          setCurrentUser(loginResponse.user);
          const pendingKey = `pendingSegmentQuiz:${qrSlug ?? "default"}`;
          sessionStorage.setItem(
            pendingKey,
            JSON.stringify({
              challengeToken: unlockResponse.challengeToken,
              quizQuestionHtml: unlockResponse.quizQuestionHtml ?? "",
              quizOptionLabels: unlockResponse.quizOptionLabels,
              segmentId: parseInt(segmentId, 10),
              securityCode: securityCode ?? undefined,
            }),
          );
          setLocation(withUiCampaign("/map"));
          setIsProcessing(false);
          return;
        }

        setCurrentUser(loginResponse.user);
        addUnlockedSegment(parseInt(segmentId));

        // Manejar caso de segmento ya escaneado
        if (unlockResponse.alreadyScanned) {
          const achievementTitle = (systemConfig as any)?.config?.achievementUnlockedTitle || '¡Logro Desbloqueado!';
          const message = unlockResponse.message || 'Este segmento ya fue desbloqueado anteriormente';
          
          setResult({
            success: true,
            title: achievementTitle,
            message: message,
            segmentId: parseInt(segmentId),
            modalContent: unlockResponse.modalContent,
            segmentTitle: unlockResponse.segmentTitle
          });

          // Mostrar modal de contenido opcional si hay contenido disponible
          if (unlockResponse.modalContent) {
            console.log('QRUnlockHandler - Abriendo modal para segmento ya escaneado:', {
              segmentId: parseInt(segmentId),
              modalContent: unlockResponse.modalContent.substring(0, 100) + '...',
              modalLength: unlockResponse.modalContent.length
            });
            playQRSuccessSound(); // Reproducir sonido de éxito
            setShowSegmentModal(true);
            // No redirigir automáticamente si hay modal - solo después de cerrarlo
          } else {
            playQRSuccessSound(); // Reproducir sonido de éxito
            // Solo redirigir automáticamente si NO hay modal
            setTimeout(() => {
              setLocation(withUiCampaign('/map'));
            }, 3000);
          }

          toast({
            title: achievementTitle,
            description: message,
          });
          
          return; // Salir temprano para evitar procesar como segmento nuevo
        }
        
        // Verificar si es un QR trampa
        if (unlockResponse.isTrap) {
          // QR Trampa - usar mensajes configurables
          console.log('QRUnlockHandler - systemConfig:', systemConfig);
          const trapTitle = (systemConfig as any)?.config?.trapDetectedTitle || '¡Situación de Riesgo Detectada!';
          const trapMessage = (systemConfig as any)?.config?.trapDetectedMessage || 
            '¡Has identificado una situación de riesgo! +{trapPoints} punto(s) de penalización.';
          
          console.log('QRUnlockHandler - Trap messages:', { trapTitle, trapMessage });
          console.log('QRUnlockHandler - Server trapMessage:', unlockResponse.trapMessage);
          
          const formattedMessage = trapMessage
            .replace('{trapPoints}', String(unlockResponse.trapPoints || 1))
            .replace('{segmentId}', segmentId);

          // Usar el mensaje personalizado del servidor si está disponible, sino usar el configurado
          const finalTrapMessage = unlockResponse.trapMessage || formattedMessage;

          setResult({
            success: true,
            title: trapTitle,
            message: formattedMessage,
            segmentId: parseInt(segmentId),
            isTrap: true,
            trapMessage: finalTrapMessage,
            trapPoints: unlockResponse.trapPoints || 1
          });

          // Mostrar modal con mensaje HTML personalizable
          playQRErrorSound(); // Reproducir sonido de error para trampas
          setShowTrapModal(true);

          toast({
            title: trapTitle,
            description: `+${unlockResponse.trapPoints || 1} punto(s) de penalización`,
          });
        } else {
          // QR Normal - usar mensajes configurables
          const achievementTitle = (systemConfig as any)?.config?.achievementUnlockedTitle || '¡Logro Desbloqueado!';
          const achievementMessage = (systemConfig as any)?.config?.achievementUnlockedMessage || 
            '¡Segmento {segmentId} desbloqueado exitosamente!';
          
          const formattedMessage = achievementMessage.replace('{segmentId}', segmentId);



          setResult({
            success: true,
            title: achievementTitle,
            message: formattedMessage,
            segmentId: parseInt(segmentId),
            modalContent: unlockResponse.modalContent,
            segmentTitle: unlockResponse.segmentTitle
          });

          // Mostrar modal de contenido opcional si hay contenido disponible
          if (unlockResponse.modalContent) {
            console.log('QRUnlockHandler - Abriendo modal para segmento nuevo:', {
              segmentId: parseInt(segmentId),
              modalContent: unlockResponse.modalContent.substring(0, 100) + '...',
              modalLength: unlockResponse.modalContent.length
            });
            playQRSuccessSound(); // Reproducir sonido de éxito
            setShowSegmentModal(true);
            // No redirigir automáticamente si hay modal - solo después de cerrarlo
          } else {
            playQRSuccessSound(); // Reproducir sonido de éxito
            // Solo redirigir automáticamente si NO hay modal
            setTimeout(() => {
              setLocation(withUiCampaign('/map'));
            }, 3000);
          }

          toast({
            title: achievementTitle,
            description: formattedMessage,
          });
        }

      } catch (error: unknown) {
        console.error('QRUnlockHandler - Error:', error);

        let errorMessage = 'Error al procesar el código QR';

        if (error instanceof Response) {
          try {
            const data = (await error.clone().json()) as { message?: string; code?: string };
            if (data?.code === "QUIZ_WRONG_FINAL" || data?.code === "QUIZ_FAILED_FINAL") {
              errorMessage =
                data.message ||
                "Respuesta incorrecta (versión antigua del servidor). Actualiza el backend o vuelve a intentar.";
            } else if (data?.message) {
              errorMessage = data.message;
            } else if (error.status === 403) {
              errorMessage =
                "No se pudo desbloquear este segmento. Revisa el código o vuelve a intentarlo.";
            } else if (error.status === 404) {
              errorMessage = "Usuario o segmento no encontrado.";
            }
          } catch {
            if (error.status === 403) {
              errorMessage =
                "No se pudo desbloquear este segmento. Si fallaste una pregunta, vuelve a escanear el QR.";
            }
          }
        } else if (error && typeof error === 'object' && 'message' in error) {
          const msg = String((error as { message: unknown }).message);
          if (msg.includes('Segment already unlocked')) {
            errorMessage = 'Este segmento ya fue desbloqueado anteriormente';
          } else if (msg.includes('Invalid security code')) {
            errorMessage = 'Código de seguridad inválido';
          } else if (msg.includes('User not found')) {
            errorMessage = 'Usuario no encontrado';
          }
        }

        setResult({
          success: false,
          message: errorMessage
        });

        playQRErrorSound();
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
  }, [setLocation, toast, isConfigLoading, systemConfig]);

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
            {result.success ? (result.title || '¡Éxito!') : 'Error'}
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
              onClick={() => setLocation(withUiCampaign('/map'))} 
              className="w-full"
              variant={result.success ? "default" : "outline"}
            >
              {result.success ? 'Ver Mapa' : 'Volver al Mapa'}
            </Button>
            
            {!result.success && (
              <Button 
                onClick={() => setLocation(withUiCampaign('/auth'))} 
                variant="outline"
                className="w-full"
              >
                Iniciar Sesión
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal para mensajes HTML de QR trampa */}
      {result && result.isTrap && (
        <TrapMessageModal
          isOpen={showTrapModal}
          onClose={() => {
            setShowTrapModal(false);
            // Redirigir al mapa después de cerrar el modal
            setTimeout(() => {
              setLocation(withUiCampaign('/map'));
            }, 1000);
          }}
          trapMessage={result.trapMessage}
          segmentId={result.segmentId || 0}
          points={result.trapPoints || 1}
        />
      )}

      {/* Modal para contenido opcional de segmentos normales */}
      {result && !result.isTrap && result.modalContent && (
        <SegmentContentModal
          isOpen={showSegmentModal}
          onClose={() => {
            setShowSegmentModal(false);
            // Redirigir al mapa después de cerrar el modal
            setTimeout(() => {
              setLocation(withUiCampaign('/map'));
            }, 1000);
          }}
          segmentId={result.segmentId || 0}
          modalContent={result.modalContent}
          title={result.segmentTitle}
        />
      )}
    </div>
  );
};

export default QRUnlockHandler;