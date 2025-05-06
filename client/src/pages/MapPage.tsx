import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { HelpCircle, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { getUserSegments, unlockSegment as apiUnlockSegment, getUserPrize } from "@/lib/api";
import MapGrid from "@/components/MapGrid";
import ProgressBar from "@/components/ProgressBar";
import QRScanner from "@/components/QRScanner";
import HtmlContent from "@/components/HtmlContent";
import BrainLoader from "@/components/BrainLoader";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const MapPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { 
    currentUser, 
    unlockedSegments, 
    setUnlockedSegments,
    addUnlockedSegment,
    isMapCompleted,
    setIsMapCompleted,
    redemptionCode,
    setRedemptionCode,
    logout 
  } = useUser();
  
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showSiteMapModal, setShowSiteMapModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [systemConfig, setSystemConfig] = useState<{
    instructionsText: string;
    siteMapImageUrl: string;
    mapGapSize: 'none' | 'x-small' | 'small' | 'medium' | 'large';
    mapGridSize: '3x3' | '3x2' | '2x3' | '4x2' | '2x4';
  }>({
    instructionsText: '',
    siteMapImageUrl: 'https://i.pinimg.com/736x/df/93/10/df93101fdd1057543ae9a6bf2ff16b1c.jpg',
    mapGapSize: 'medium',
    mapGridSize: '3x3'
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      setLocation("/");
      return;
    }

    // Load user segments and system config
    loadUserData();
    
    // Check if first time visit
    const hasVisitedKey = `has_visited_${currentUser.documentNumber}`;
    const hasVisited = localStorage.getItem(hasVisitedKey);
    
    if (!hasVisited) {
      setShowInstructionsModal(true);
      localStorage.setItem(hasVisitedKey, 'true');
    }
  }, [currentUser]);

  useEffect(() => {
    // Cargar configuración del sistema
    const loadSystemConfig = async () => {
      try {
        const response = await fetch('/api/system-config');
        if (response.ok) {
          const data = await response.json();
          setSystemConfig(data.config);
        }
      } catch (error) {
        console.error('Error loading system config:', error);
      }
    };
    
    loadSystemConfig();
  }, []);

  const loadUserData = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      
      // Load segments
      const segmentsResponse = await getUserSegments(currentUser.documentNumber);
      const unlockedSegmentIds = segmentsResponse.segments
        .filter(segment => segment.unlocked)
        .map(segment => segment.segmentId);
      
      setUnlockedSegments(unlockedSegmentIds);
      
      // Load prize status
      const prizeResponse = await getUserPrize(currentUser.documentNumber);
      
      if (prizeResponse.completed) {
        setIsMapCompleted(true);
        setRedemptionCode(prizeResponse.redemptionCode);
      }
      
    } catch (error) {
      toast({
        title: "Error",
        description: "No pudimos cargar tu progreso. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRScan = async (segmentId: number, securityCode?: string) => {
    if (!currentUser) return;

    try {
      setShowQRScanner(false);
      
      // Check if already unlocked
      if (unlockedSegments.includes(segmentId)) {
        setSuccessMessage(`¡Ya has desbloqueado este segmento (${segmentId})!`);
        setShowSuccessModal(true);
        return;
      }
      
      setIsLoading(true);
      
      // Pasar el código de seguridad (si existe) a la API para verificación
      const response = await apiUnlockSegment(currentUser.documentNumber, segmentId, securityCode);
      
      // Update unlocked segments
      addUnlockedSegment(segmentId);
      
      // Recargar los datos para asegurar que todo esté sincronizado
      await loadUserData();
      
      setSuccessMessage(`¡Has desbloqueado el segmento ${segmentId}!`);
      setShowSuccessModal(true);
      
      // Check if map is now completed
      if (response.completed) {
        setIsMapCompleted(true);
        setRedemptionCode(response.redemptionCode);
        // Show completion modal after success modal is closed
        setTimeout(() => {
          setShowCompletionModal(true);
        }, 1500);
      }
    } catch (error) {
      console.error("Error unlocking segment:", error);
      
      // Verificar si el error es por código de seguridad inválido
      if (error instanceof Response && error.status === 403) {
        try {
          const errorData = await error.json();
          toast({
            title: "Código de seguridad inválido",
            description: errorData.message || "El código de seguridad no es correcto para este segmento.",
            variant: "destructive"
          });
        } catch (e) {
          toast({
            title: "Error",
            description: "Código de seguridad inválido o no proporcionado.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Error",
          description: "No pudimos desbloquear el segmento. Inténtalo de nuevo.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen" style={{
      background: `url('https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png') repeat, linear-gradient(175deg, #bb2558 0%, #bb2558 75%, #e8cf00 100%)`
    }}>
      {/* Header */}
      <header className="bg-primary text-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">Mapa de Logros</h1>
          <div className="flex items-center">
            <div className="mr-3">
              <p className="text-sm font-medium">{currentUser.name}</p>
              <p className="text-xs opacity-80">{currentUser.documentNumber}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                />
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <BrainLoader size="large" text="Cargando tu mapa..." />
          </div>
        ) : (
          <>
            <ProgressBar 
              progress={unlockedSegments.length} 
              total={(() => {
                const [columns, rows] = systemConfig.mapGridSize.split('x').map(Number);
                return columns * rows;
              })()} 
            />
            
            <div className="flex justify-between items-center mb-4">
              <div>
                {isMapCompleted && (
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 border-primary text-primary hover:bg-primary/5"
                    onClick={() => setShowCompletionModal(true)}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      className="h-5 w-5"
                    >
                      <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743-.356l1.918-.87a.5.5 0 01.449 0l1.918.87a6.73 6.73 0 002.743.356 6.753 6.753 0 006.138-5.6.75.75 0 00-.584-.86 47.25 47.25 0 00-3.07-.543v-.858a48.322 48.322 0 00-11.782 0z" clipRule="evenodd" />
                      <path d="M9.5 14.25l-3.22 2.092a.75.75 0 01-1.035-.229.75.75 0 01-.054-.789L7.099 11.5l-3.22-2.092a.75.75 0 01.4-1.357l3.98-.326 1.483-3.918a.75.75 0 011.437 0l1.483 3.918 3.98.326a.75.75 0 01.4 1.357L13.773 11.5l1.906 3.824a.75.75 0 01-.837 1.003L11 14.25l-1.5-.375zm4.5 9.75h-3c-4.416 0-8-3.584-8-8v-2.909l.112.063 2.094 1.371-.6 1.199A1.75 1.75 0 004.917 16 6.3 6.3 0 008.48 17.38l1.733.78.429.195-.518 3.053a1.75 1.75 0 003.462.32L14 16.5l1.265.57a6.3 6.3 0 003.539 1a1.75 1.75 0 001.21-2.89l-.493-.986 1.207-.794a1.75 1.75 0 00.625-2.31l-.516-1.24a44.84 44.84 0 00-.742-.628A1.76 1.76 0 0018.65 8.75l-2.436.607-.469-1.152a1.75 1.75 0 00-1.587-1.014h-.358A7.555 7.555 0 0012 7c-.596 0-1.176.07-1.735.2h-.691a1.75 1.75 0 00-1.594 1.065l-.413 1.011-2.145-.53a1.75 1.75 0 00-1.45.301 1.69 1.69 0 00-.618-.99h-.002L4 8.364v-1.45l.062-.028c.719-.32 1.437-.605 2.156-.855L13.933 4c2.848 0 5.67.285 8.426.847l.64.152.063.028v.242A48.476 48.476 0 0118 6v1.636l.114.062c.284.156.568.319.85.491l.262.159.176.103.06.036.042.028.027.02.011.009L20 9l-.024-.04-.043-.066-.064-.092-.086-.119-.106-.147-.127-.173-.145-.199-.141-.188L19.17 8l-.3.5c-.242.396-.46.796-.653 1.2-.155.325-.282.657-.38.997-.09.33-.149.67-.175 1.018l.334.006.743.014 1.497.045 1.952.09c-.244-4.422-3.906-7.87-8.355-7.87-4.624 0-8.372 3.748-8.372 8.372 0 4.582 3.7 8.294 8.281 8.37l.09-.012z" />
                    </svg>
                    Ver Código Premio
                  </Button>
                )}
              </div>

            </div>
            
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInstructionsModal(true)}
                className="flex items-center gap-2 bg-white/90 hover:bg-white"
              >
                <HelpCircle className="h-4 w-4" />
                Ayuda
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSiteMapModal(true)}
                className="flex items-center gap-2 bg-white/90 hover:bg-white"
              >
                <Map className="h-4 w-4" />
                Mapa del Sitio
              </Button>
            </div>
            
            <MapGrid 
              unlockedSegments={unlockedSegments} 
              gapSize={systemConfig.mapGapSize} // Usar el tamaño de separación configurado en el sistema
              gridSize={systemConfig.mapGridSize} // Usar el tamaño de cuadrícula configurado
            />
          </>
        )}
      </main>

      {/* Instructions Modal */}
      <Dialog open={showInstructionsModal} onOpenChange={setShowInstructionsModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Instrucciones</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none overflow-y-auto max-h-[60vh] pr-2">
            {systemConfig.instructionsText ? (
              <HtmlContent html={systemConfig.instructionsText} />
            ) : (
              <p>Cargando instrucciones...</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInstructionsModal(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Site Map Modal - Full Screen optimized */}
      <Dialog open={showSiteMapModal} onOpenChange={setShowSiteMapModal}>
        <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[95vh] p-4 data-[state=open]:shadow-lg">
          {/* Hidden title for accessibility */}
          <DialogHeader className="sr-only">
            <DialogTitle>Mapa del Sitio</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Vista ampliada del mapa del sitio
          </DialogDescription>
          <div className="relative w-full h-full flex-1 overflow-hidden flex items-center justify-center">
            <img 
              src={systemConfig.siteMapImageUrl} 
              alt="Mapa del sitio"
              className="max-w-full max-h-[85vh] object-contain border border-gray-200 rounded-lg shadow-sm"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Scanner Button with Call to Action */}
      <div className="fixed bottom-6 right-6 z-10 flex flex-col items-center">
        <div className="bg-white/80 text-orange-600 font-semibold px-3 py-1 rounded-full text-sm mb-2 shadow-md">
          ¡Escanea aquí!
        </div>
        <Button 
          onClick={() => setShowQRScanner(true)}
          className="w-16 h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform transform hover:scale-110"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
        </Button>
      </div>

      {/* QR Scanner Modal */}
      <QRScanner 
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onSuccess={handleQRScan}
      />

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¡Logro Desbloqueado!</DialogTitle>
          </DialogHeader>
          
          <div className="pt-6 pb-4 px-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-10 w-10 text-green-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
            </div>
            <p className="text-gray-600 text-center">{successMessage}</p>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowSuccessModal(false)}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-lg sm:text-xl">¡Felicidades! ¡Mapa Completo!</DialogTitle>
          </DialogHeader>
          
          <div className="py-3 px-4 flex flex-col items-center">
            {/* Contenido más compacto */}
            <div className="flex items-center gap-4 mb-3">
              {/* Trofeo animado */}
              <div className="flex-shrink-0">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="h-12 w-12 text-yellow-500 animate-[spin_3s_linear_infinite]"
                >
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              </div>
              
              <div className="text-left">
                <p className="text-gray-800 text-lg font-medium">
                  ¡Misión cumplida!
                </p>
                <p className="text-gray-600 text-sm">
                  Has completado el mapa y desbloqueado tu premio.
                </p>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-3 w-full bg-gradient-to-b from-yellow-50 to-white mb-3">
              <h4 className="text-center font-medium text-gray-700 mb-2 text-sm">Código de Redención</h4>
              
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                {/* QR Code */}
                <div className="w-36 h-36 sm:w-40 sm:h-40 flex-shrink-0 mx-auto sm:mx-0 bg-white p-2 border border-gray-300 rounded-lg shadow-sm flex items-center justify-center">
                  {redemptionCode ? (
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${redemptionCode}`}
                      alt="QR de redención"
                      className="max-w-full max-h-full"
                    />
                  ) : (
                    <BrainLoader size="medium" />
                  )}
                </div>
                
                {/* Código de redención en formato texto */}
                {redemptionCode && (
                  <div className="flex-grow bg-white p-3 border border-gray-300 rounded-md text-center">
                    <p className="text-xs text-gray-500 mb-1">Código de validación</p>
                    <p className="font-mono text-lg font-bold tracking-wider select-all break-all">
                      {redemptionCode}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Muestra este código para reclamar tu premio
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCompletionModal(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cerrar
            </Button>
            <Button
              onClick={() => window.print()}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              Guardar Premio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MapPage;
