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
            
            <div className="flex justify-end mb-4">
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
            <DialogTitle>¡Felicidades! ¡Mapa Completo!</DialogTitle>
          </DialogHeader>
          
          <div className="pt-6 pb-4 px-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-10 w-10 text-orange-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                />
              </svg>
            </div>
            <p className="text-gray-600 text-center mb-4">
              Has completado todo el mapa de logros y desbloqueado tu premio.
            </p>
            
            <div className="border border-gray-200 rounded p-4 w-full bg-gray-50 mb-4">
              <h4 className="text-center font-medium text-gray-700 mb-3">Código de Redención</h4>
              <div className="w-48 h-48 mx-auto bg-white p-2 border border-gray-300 flex items-center justify-center">
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
          
          <DialogFooter>
            <Button onClick={() => setShowCompletionModal(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MapPage;
