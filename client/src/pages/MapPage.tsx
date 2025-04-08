import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { getUserSegments, unlockSegment as apiUnlockSegment, getUserPrize } from "@/lib/api";
import MapGrid from "@/components/MapGrid";
import ProgressBar from "@/components/ProgressBar";
import QRScanner from "@/components/QRScanner";
import AuthCertificate from "@/components/AuthCertificate";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      setLocation("/");
      return;
    }

    // Load user segments
    loadUserData();
  }, [currentUser]);

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

  const handleQRScan = async (segmentId: number) => {
    if (!currentUser) return;

    try {
      setShowQRScanner(false);
      
      // Check if already unlocked
      if (unlockedSegments.includes(segmentId)) {
        setSuccessMessage(`¡Ya has desbloqueado este segmento (${segmentId})!`);
        setShowSuccessModal(true);
        return;
      }
      
      const response = await apiUnlockSegment(currentUser.documentNumber, segmentId);
      
      // Update unlocked segments
      addUnlockedSegment(segmentId);
      
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
      toast({
        title: "Error",
        description: "No pudimos desbloquear el segmento. Inténtalo de nuevo.",
        variant: "destructive"
      });
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
    <div className="flex flex-col min-h-screen bg-gray-50">
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <ProgressBar 
              progress={unlockedSegments.length} 
              total={9} 
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
              <AuthCertificate />
            </div>
            
            <MapGrid unlockedSegments={unlockedSegments} />
          </>
        )}
      </main>

      {/* QR Scanner Button */}
      <div className="fixed bottom-6 right-6 z-10">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-lg sm:text-xl">¡Felicidades! ¡Mapa Completo!</DialogTitle>
          </DialogHeader>
          
          <div className="pt-6 pb-4 px-6 flex flex-col items-center">
            {/* Trofeo animado */}
            <div className="w-24 h-24 mb-4 flex items-center justify-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="h-16 w-16 text-yellow-500 animate-[spin_3s_linear_infinite]"
              >
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            </div>
            
            <div className="text-center">
              <p className="text-gray-800 text-lg font-medium mb-1">
                ¡Misión cumplida!
              </p>
              <p className="text-gray-600 text-center mb-4">
                Has completado todo el mapa de logros y desbloqueado tu premio.
              </p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 w-full bg-gradient-to-b from-yellow-50 to-white mb-4">
              <h4 className="text-center font-medium text-gray-700 mb-3">Código de Redención</h4>
              <div className="w-48 h-48 mx-auto bg-white p-2 border border-gray-300 rounded-lg shadow-sm flex items-center justify-center">
                {redemptionCode ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${redemptionCode}`}
                    alt="QR de redención"
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                )}
              </div>
              <p className="text-sm text-gray-500 text-center mt-2">
                Muestra este código para reclamar tu premio
              </p>
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
