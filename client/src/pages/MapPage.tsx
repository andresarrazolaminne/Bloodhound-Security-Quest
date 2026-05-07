import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { HelpCircle, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutlineBoxButton, BoxButton } from "@/components/ui/custom-button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import {
  getUserSegments,
  unlockSegment as apiUnlockSegment,
  getUserPrize,
  getAllMapAssets,
  getUserQuizStats,
  describeApiFailure,
  type UnlockSegmentResponse,
} from "@/lib/api";
import MapGrid from "@/components/MapGrid";
import ProgressBar from "@/components/ProgressBar";
import QRScanner from "@/components/QRScanner";
import HtmlContent from "@/components/HtmlContent";
import { playQRSuccessSound, playQRErrorSound, playCompletionSound } from '@/lib/sounds';
import BrainLoader from "@/components/BrainLoader";
import SegmentContentModal from '@/components/SegmentContentModal';
import { withApiBase, withUiCampaign, getCampaignSlugFromPath, getResolvedCampaignSlug } from "@/lib/paths";
import { playableSegmentIdsForCampaign } from "@shared/mapGrid";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type MapPageProps = {
  campaignSlug?: string;
};

const MapPage = ({ campaignSlug: campaignSlugFromRoute }: MapPageProps) => {
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

  const routeSlug = (campaignSlugFromRoute ?? "").trim();
  const pathSlug = (getCampaignSlugFromPath(window.location.pathname) ?? "").trim();
  /** Siempre un slug concreto en mapa jugador (evita undefined y desajuste con la API). */
  const playerCampaignSlug =
    routeSlug || pathSlug || (getResolvedCampaignSlug() ?? "").trim() || "default";

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showSiteMapModal, setShowSiteMapModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [segmentModalData, setSegmentModalData] = useState<{
    segmentId: number;
    modalContent?: string;
    title?: string;
  } | null>(null);
  const [pendingQuiz, setPendingQuiz] = useState<{
    challengeToken: string;
    quizQuestionHtml: string;
    quizOptionLabels: string[];
    segmentId: number;
    securityCode?: string;
  } | null>(null);
  const [quizSelectedSlot, setQuizSelectedSlot] = useState<string>("");
  /** Tras enviar el quiz: mensaje breve antes de volver al mapa. */
  const [quizFeedback, setQuizFeedback] = useState<"bien" | "mal" | null>(null);
  const quizFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quizTransparency, setQuizTransparency] = useState<{
    quizCorrectAnswers: number;
    quizWrongAnswers: number;
    quizBonusPoints: number;
  }>({
    quizCorrectAnswers: 0,
    quizWrongAnswers: 0,
    quizBonusPoints: 0,
  });
  const [systemConfig, setSystemConfig] = useState<{
    instructionsText: string;
    siteMapImageUrl: string;
    footerLogoUrl: string;
    cobrandingImageUrl: string;
    backgroundSize: string;
    backgroundRepeat: string;
    backgroundPosition: string;
    gradientMidColor: string;
    gradientDirection: string;
    gradientType: string;
    mapGapSize: 'none' | 'x-small' | 'small' | 'medium' | 'large';
    mapGridSize: '3x3' | '3x2' | '2x3' | '4x2' | '2x4';
    appTitle: string;
    backgroundImageUrl: string;
    gradientStartColor: string;
    gradientEndColor: string;
    scanButtonEnabled: boolean;
    scanButtonText: string;
    helpButtonText: string;
    siteMapButtonText: string;
    prizeButtonText: string;
    completionTitle: string;
    completionRewardHeadline: string;
    completionRewardDescription: string;
    completionCodeSectionTitle: string;
    completionCodeLabel: string;
    completionCodeHelpText: string;
    completionCloseButtonText: string;
    completionSaveButtonText: string;
    completionShowBrain: boolean;
    completionShowQr: boolean;
    completionShowCode: boolean;
    completionShowSaveButton: boolean;
    loadingText: string;
    headerLogoImageUrl: string;
    headerLogoSize: number;
    headerBackgroundColor: string;
    headerTextColor: string;
    progressTextColor: string;
    // Achievement and trap messages
    achievementUnlockedTitle: string;
    achievementUnlockedMessage: string;
    trapDetectedTitle: string;
    trapDetectedMessage: string;
  }>({
    instructionsText: '',
    siteMapImageUrl: '',
    footerLogoUrl: '',
    cobrandingImageUrl: '',
    backgroundSize: 'auto',
    backgroundRepeat: 'repeat',
    backgroundPosition: 'center',
    gradientMidColor: '',
    gradientDirection: '175deg',
    gradientType: 'linear',
    mapGapSize: 'medium',
    mapGridSize: '3x3',
    appTitle: '',
    backgroundImageUrl: '',
    gradientStartColor: '',
    gradientEndColor: '',
    scanButtonEnabled: true,
    scanButtonText: '',
    helpButtonText: '',
    siteMapButtonText: '',
    prizeButtonText: '',
    completionTitle: '',
    completionRewardHeadline: '',
    completionRewardDescription: '',
    completionCodeSectionTitle: '',
    completionCodeLabel: '',
    completionCodeHelpText: '',
    completionCloseButtonText: '',
    completionSaveButtonText: '',
    completionShowBrain: true,
    completionShowQr: true,
    completionShowCode: true,
    completionShowSaveButton: true,
    loadingText: '',
    headerLogoImageUrl: '',
    headerLogoSize: 32,
    headerBackgroundColor: '',
    headerTextColor: '',
    progressTextColor: '',
    // Achievement and trap messages
    achievementUnlockedTitle: '',
    achievementUnlockedMessage: '',
    trapDetectedTitle: '',
    trapDetectedMessage: '',
  });
  
  /** Assets del mapa (para total jugable = grid ∪ assets; coincide con el servidor). */
  const [mapAssetsForProgress, setMapAssetsForProgress] = useState<
    Array<{ segmentId: number; isTrap: boolean }>
  >([]);
  const [footerImageLoaded, setFooterImageLoaded] = useState(false);

  const playableSegmentIds = useMemo(
    () => playableSegmentIdsForCampaign(mapAssetsForProgress, systemConfig.mapGridSize),
    [mapAssetsForProgress, systemConfig.mapGridSize],
  );
  const playableSegmentIdSet = useMemo(() => new Set(playableSegmentIds), [playableSegmentIds]);
  const progressTotalSegments = playableSegmentIds.length;
  const progressUnlockedCount = useMemo(
    () => unlockedSegments.filter((id) => playableSegmentIdSet.has(id)).length,
    [unlockedSegments, playableSegmentIdSet],
  );

  const loadUserData = useCallback(async () => {
    if (!currentUser) return;
    const doc = String(currentUser.documentNumber ?? "").trim();
    if (!doc) {
      toast({
        title: "Error",
        description: "Usuario sin número de documento. Cierra sesión y vuelve a entrar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const segmentsResponse = await getUserSegments(doc, playerCampaignSlug);
      const unlockedSegmentIds = segmentsResponse.segments
        .filter((segment) => segment.unlocked)
        .map((segment) => segment.segmentId);

      const assetsResponse = await getAllMapAssets(playerCampaignSlug);
      setMapAssetsForProgress(
        assetsResponse.assets.map((a) => ({
          segmentId: a.segmentId,
          isTrap: Boolean(a.isTrap),
        })),
      );

      const totalValidCount = playableSegmentIdsForCampaign(
        assetsResponse.assets,
        systemConfig.mapGridSize,
      ).length;

      setUnlockedSegments(unlockedSegmentIds, totalValidCount);

      try {
        const prizeResponse = await getUserPrize(doc, playerCampaignSlug);

        if (prizeResponse.completed) {
          setIsMapCompleted(true);
          setRedemptionCode(prizeResponse.redemptionCode);
        }
      } catch (prizeErr) {
        console.error("[MapPage] getUserPrize (mapa ya cargado):", prizeErr);
      }

      try {
        const quizStats = await getUserQuizStats(doc, playerCampaignSlug);
        setQuizTransparency({
          quizCorrectAnswers: quizStats.quizCorrectAnswers ?? 0,
          quizWrongAnswers: quizStats.quizWrongAnswers ?? 0,
          quizBonusPoints: quizStats.quizBonusPoints ?? 0,
        });
      } catch (quizErr) {
        setQuizTransparency({
          quizCorrectAnswers: 0,
          quizWrongAnswers: 0,
          quizBonusPoints: 0,
        });
        console.error("[MapPage] getUserQuizStats:", quizErr);
      }
    } catch (error) {
      const description = await describeApiFailure(error);
      toast({
        title: "No se pudo cargar el progreso",
        description,
        variant: "destructive",
      });
      console.error("[MapPage] loadUserData:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentUser,
    playerCampaignSlug,
    systemConfig.mapGridSize,
    toast,
    setUnlockedSegments,
    setIsMapCompleted,
    setRedemptionCode,
  ]);

  const processUnlockResponse = useCallback(
    async (response: UnlockSegmentResponse, segmentId: number) => {
      if (response.alreadyScanned) {
        if (!unlockedSegments.includes(segmentId)) {
          addUnlockedSegment(segmentId, progressTotalSegments);
        }
        await loadUserData();
        if (response.modalContent) {
          playQRSuccessSound();
          setSegmentModalData({
            segmentId,
            modalContent: response.modalContent,
            title: response.segmentTitle,
          });
          setShowSegmentModal(true);
        } else {
          playQRSuccessSound();
          setSuccessMessage(`¡Ya has desbloqueado este segmento (${segmentId})!`);
          setShowSuccessModal(true);
        }
        return;
      }

      addUnlockedSegment(segmentId, progressTotalSegments);
      await loadUserData();

      if (response.isTrap) {
        const trapTitle = systemConfig.trapDetectedTitle || "¡Situación de Riesgo Detectada!";
        const trapMessage =
          systemConfig.trapDetectedMessage ||
          "¡Has identificado una situación de riesgo! +{trapPoints} punto(s) de penalización.";
        const formattedMessage = trapMessage
          .replace("{trapPoints}", String(response.trapPoints || 1))
          .replace("{segmentId}", String(segmentId));
        playQRErrorSound();
        setSuccessMessage(formattedMessage);
        setShowSuccessModal(true);
        toast({
          title: trapTitle,
          description: `+${response.trapPoints || 1} punto(s) de penalización`,
          variant: "destructive",
        });
      } else if (response.modalContent) {
        playQRSuccessSound();
        setSegmentModalData({
          segmentId,
          modalContent: response.modalContent,
          title: response.segmentTitle,
        });
        setShowSegmentModal(true);
      } else {
        const achievementTitle =
          systemConfig.achievementUnlockedTitle || "¡Logro Desbloqueado!";
        const achievementMessage =
          systemConfig.achievementUnlockedMessage ||
          "¡Segmento {segmentId} desbloqueado exitosamente!";
        const formattedMessage = achievementMessage.replace("{segmentId}", String(segmentId));
        playQRSuccessSound();
        setSuccessMessage(formattedMessage);
        setShowSuccessModal(true);
        toast({
          title: achievementTitle,
          description: formattedMessage,
        });
      }

      if (response.completed) {
        playCompletionSound();
        setIsMapCompleted(true);
        setRedemptionCode(response.redemptionCode);
        setTimeout(() => {
          setShowCompletionModal(true);
        }, 1500);
      }
    },
    [
      unlockedSegments,
      progressTotalSegments,
      loadUserData,
      addUnlockedSegment,
      toast,
      systemConfig,
      setIsMapCompleted,
      setRedemptionCode,
    ],
  );

  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      setLocation(withUiCampaign("/"));
      return;
    }

    loadUserData();

    const hasVisitedKey = `has_visited_${currentUser.documentNumber}`;
    const hasVisited = localStorage.getItem(hasVisitedKey);

    if (!hasVisited) {
      setShowInstructionsModal(true);
      localStorage.setItem(hasVisitedKey, "true");
    }
  }, [currentUser, playerCampaignSlug, loadUserData, setLocation]);

  /** Desbloqueo por URL externa: QRUnlockHandler guarda el reto aquí y redirige al mapa. */
  useEffect(() => {
    const key = `pendingSegmentQuiz:${playerCampaignSlug}`;
    const raw = sessionStorage.getItem(key);
    if (!raw || !currentUser) return;
    try {
      const data = JSON.parse(raw) as {
        challengeToken: string;
        quizQuestionHtml?: string;
        quizOptionLabels: string[];
        segmentId: number;
        securityCode?: string;
      };
      sessionStorage.removeItem(key);
      if (
        data?.challengeToken &&
        Array.isArray(data.quizOptionLabels) &&
        data.quizOptionLabels.length > 0
      ) {
        setPendingQuiz({
          challengeToken: data.challengeToken,
          quizQuestionHtml: data.quizQuestionHtml ?? "",
          quizOptionLabels: data.quizOptionLabels,
          segmentId: Number(data.segmentId),
          securityCode: data.securityCode,
        });
        setQuizSelectedSlot("");
      }
    } catch {
      sessionStorage.removeItem(key);
    }
  }, [currentUser, playerCampaignSlug]);

  const clearQuizFeedbackTimer = useCallback(() => {
    if (quizFeedbackTimerRef.current !== null) {
      clearTimeout(quizFeedbackTimerRef.current);
      quizFeedbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearQuizFeedbackTimer(), [clearQuizFeedbackTimer]);

  useEffect(() => {
    // Cargar configuración del sistema
    const loadSystemConfig = async () => {
      try {
        const cfgHeaders: Record<string, string> = {};
        if (playerCampaignSlug) cfgHeaders["x-campaign-slug"] = playerCampaignSlug;
        const response = await fetch(
          withApiBase("/api/system-config?t=" + Date.now(), playerCampaignSlug ?? null),
          { credentials: "include", headers: cfgHeaders },
        );
        if (response.ok) {
          const data = await response.json();
          const config = data.config || {};
          
          // Use only database values - no defaults
          const newConfig = {
            instructionsText: config.instructionsText,
            siteMapImageUrl: config.siteMapImageUrl,
            footerLogoUrl: config.footerLogoUrl,
            cobrandingImageUrl: config.cobrandingImageUrl,
            mapGapSize: config.mapGapSize,
            mapGridSize: config.mapGridSize,
            appTitle: config.appTitle,
            backgroundImageUrl: config.backgroundImageUrl,
            backgroundSize: config.backgroundSize,
            backgroundRepeat: config.backgroundRepeat,
            backgroundPosition: config.backgroundPosition,
            gradientStartColor: config.gradientStartColor,
            gradientMidColor: config.gradientMidColor,
            gradientEndColor: config.gradientEndColor,
            gradientDirection: config.gradientDirection,
            gradientType: config.gradientType,
            scanButtonEnabled: config.scanButtonEnabled ?? true,
            scanButtonText: config.scanButtonText,
            helpButtonText: config.helpButtonText,
            siteMapButtonText: config.siteMapButtonText,
            prizeButtonText: config.prizeButtonText,
            completionTitle: config.completionTitle,
            completionRewardHeadline: config.completionRewardHeadline,
            completionRewardDescription: config.completionRewardDescription,
            completionCodeSectionTitle: config.completionCodeSectionTitle,
            completionCodeLabel: config.completionCodeLabel,
            completionCodeHelpText: config.completionCodeHelpText,
            completionCloseButtonText: config.completionCloseButtonText,
            completionSaveButtonText: config.completionSaveButtonText,
            completionShowBrain: config.completionShowBrain ?? true,
            completionShowQr: config.completionShowQr ?? true,
            completionShowCode: config.completionShowCode ?? true,
            completionShowSaveButton: config.completionShowSaveButton ?? true,
            loadingText: config.loadingText,
            headerLogoImageUrl: config.headerLogoImageUrl,
            headerLogoSize: config.headerLogoSize,
            headerBackgroundColor: config.headerBackgroundColor,
            headerTextColor: config.headerTextColor,
            progressTextColor: config.progressTextColor,
            // Achievement and trap messages
            achievementUnlockedTitle: config.achievementUnlockedTitle,
            achievementUnlockedMessage: config.achievementUnlockedMessage,
            trapDetectedTitle: config.trapDetectedTitle,
            trapDetectedMessage: config.trapDetectedMessage,
          };
          
          // Preload footer image before setting state to prevent flash
          const footerImg = new Image();
          footerImg.onload = () => {
            setFooterImageLoaded(true);
            setSystemConfig(newConfig as any);
          };
          footerImg.onerror = () => {
            // Fallback: still set config even if image fails
            setFooterImageLoaded(true);
            setSystemConfig(newConfig as any);
          };
          footerImg.src = newConfig.footerLogoUrl;
          
          // Update CSS custom properties immediately to prevent flash
          const timestamp = Date.now();
          document.documentElement.style.setProperty('--background-image-url', newConfig.backgroundImageUrl ? `url('${newConfig.backgroundImageUrl}?t=${timestamp}')` : '');
          document.documentElement.style.setProperty('--background-size', newConfig.backgroundSize);
          document.documentElement.style.setProperty('--background-repeat', newConfig.backgroundRepeat);
          document.documentElement.style.setProperty('--background-position', newConfig.backgroundPosition);
          document.documentElement.style.setProperty('--gradient-start-color', newConfig.gradientStartColor);
          document.documentElement.style.setProperty('--gradient-mid-color', newConfig.gradientMidColor);
          document.documentElement.style.setProperty('--gradient-end-color', newConfig.gradientEndColor);
          document.documentElement.style.setProperty('--gradient-direction', newConfig.gradientDirection);
          document.documentElement.style.setProperty('--gradient-type', newConfig.gradientType);
        }
      } catch (error) {
        console.error('Error loading system config:', error);
      }
    };
    
    loadSystemConfig();
    
    // Listen for custom events to reload configuration
    const handleConfigUpdate = () => {
      loadSystemConfig();
    };
    
    window.addEventListener('systemConfigUpdated', handleConfigUpdate);
    
    return () => {
      window.removeEventListener('systemConfigUpdated', handleConfigUpdate);
    };
  }, [playerCampaignSlug]);

  const handleQRScan = async (segmentId: number, securityCode?: string) => {
    if (!currentUser) return;

    try {
      setShowQRScanner(false);
      setIsLoading(true);

      const response = await apiUnlockSegment(
        currentUser.documentNumber,
        segmentId,
        securityCode,
        playerCampaignSlug,
      );

      if (response.needsQuiz) {
        if (
          response.challengeToken &&
          Array.isArray(response.quizOptionLabels) &&
          response.quizOptionLabels.length > 0
        ) {
          setPendingQuiz({
            challengeToken: response.challengeToken,
            quizQuestionHtml: response.quizQuestionHtml ?? "",
            quizOptionLabels: response.quizOptionLabels,
            segmentId,
            securityCode,
          });
          setQuizSelectedSlot("");
        } else {
          toast({
            title: "Pregunta del segmento",
            description:
              "No se pudieron cargar las respuestas. Revisa la configuración del segmento (opciones y respuesta correcta) o inténtalo más tarde.",
            variant: "destructive",
          });
        }
        return;
      }

      await processUnlockResponse(response, segmentId);
    } catch (error) {
      console.error("Error unlocking segment:", error);

      if (error instanceof Response) {
        try {
          const errorData = await error.clone().json();
          const code = errorData?.code as string | undefined;

          if (error.status === 403) {
            if (code === "QUIZ_WRONG_FINAL" || code === "QUIZ_FAILED_FINAL") {
              setPendingQuiz(null);
              toast({
                title: "Pregunta del segmento",
                description:
                  errorData.message ||
                  "No se pudo completar el desbloqueo con esta respuesta.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Código de seguridad inválido",
                description:
                  errorData.message ||
                  "El código de seguridad no es correcto para este segmento.",
                variant: "destructive",
              });
            }
          } else if (error.status === 404) {
            toast({
              title: "Segmento no encontrado",
              description:
                errorData.message || "No se encontró configuración para este segmento.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description:
                errorData.message ||
                "No pudimos desbloquear el segmento. Inténtalo de nuevo.",
              variant: "destructive",
            });
          }
        } catch {
          toast({
            title: "Error",
            description: "Error de conexión. Verifica tu conexión a internet.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: await describeApiFailure(error),
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizSubmit = async () => {
    if (!currentUser || !pendingQuiz) return;
    if (quizSelectedSlot === "") {
      toast({
        title: "Elige una respuesta",
        description: "Selecciona una de las opciones antes de enviar.",
        variant: "destructive",
      });
      return;
    }
    const slot = Number.parseInt(quizSelectedSlot, 10);
    if (!Number.isFinite(slot) || slot < 0) return;

    try {
      setIsLoading(true);
      const segmentIdDone = pendingQuiz.segmentId;
      const response = await apiUnlockSegment(
        currentUser.documentNumber,
        segmentIdDone,
        pendingQuiz.securityCode,
        playerCampaignSlug,
        {
          challengeToken: pendingQuiz.challengeToken,
          selectedSlot: slot,
        },
      );
      setPendingQuiz(null);
      setQuizSelectedSlot("");
      setIsLoading(false);
      clearQuizFeedbackTimer();
      setQuizFeedback("bien");
      quizFeedbackTimerRef.current = setTimeout(() => {
        quizFeedbackTimerRef.current = null;
        setQuizFeedback(null);
        void processUnlockResponse(response, segmentIdDone);
      }, 3000);
    } catch (error) {
      console.error("Error enviando respuesta del quiz:", error);
      if (error instanceof Response) {
        let code: string | undefined;
        try {
          const errData = (await error.clone().json()) as { code?: string };
          code = errData?.code;
        } catch {
          /* ignore */
        }
        const description = await describeApiFailure(error);
        setPendingQuiz(null);
        setQuizSelectedSlot("");
        setIsLoading(false);
        if (
          error.status === 403 &&
          (code === "QUIZ_WRONG_FINAL" || code === "QUIZ_FAILED_FINAL")
        ) {
          clearQuizFeedbackTimer();
          playQRErrorSound();
          setQuizFeedback("mal");
          quizFeedbackTimerRef.current = setTimeout(() => {
            quizFeedbackTimerRef.current = null;
            setQuizFeedback(null);
            void loadUserData();
          }, 3000);
        } else {
          toast({
            title: "Pregunta del segmento",
            description,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: await describeApiFailure(error),
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation(withUiCampaign("/"));
  };

  if (!currentUser) {
    return null;
  }

  const hasGradient = Boolean(systemConfig.gradientStartColor && systemConfig.gradientEndColor);
  const backgroundStyle = hasGradient ? {
    background: `${systemConfig.backgroundImageUrl ? `url('${systemConfig.backgroundImageUrl}'), ` : ''}linear-gradient(${systemConfig.gradientDirection}, ${systemConfig.gradientStartColor} 0%, ${systemConfig.gradientEndColor} 100%)`,
    backgroundSize: systemConfig.backgroundImageUrl ? `${systemConfig.backgroundSize}, cover` : 'cover',
    backgroundRepeat: systemConfig.backgroundImageUrl ? `${systemConfig.backgroundRepeat}, no-repeat` : 'no-repeat',
    backgroundPosition: systemConfig.backgroundImageUrl ? `${systemConfig.backgroundPosition}, center` : 'center'
  } : {};
  
  return (
    <div className="flex flex-col min-h-screen" style={Object.keys(backgroundStyle).length > 0 ? backgroundStyle : { backgroundColor: '#f3f4f6' }}>
      {quizFeedback && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <p
            className={
              quizFeedback === "bien"
                ? "text-5xl sm:text-6xl font-bold tracking-tight text-green-500 drop-shadow-sm"
                : "text-5xl sm:text-6xl font-bold tracking-tight text-red-500 drop-shadow-sm"
            }
          >
            {quizFeedback === "bien" ? "Bien!" : "Mal!"}
          </p>
        </div>
      )}
      {/* Header */}
      <header 
        className="shadow-md"
        style={{ 
          backgroundColor: systemConfig.headerBackgroundColor,
          color: systemConfig.headerTextColor 
        }}
      >
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          {systemConfig.headerLogoImageUrl && (
            <img 
              src={systemConfig.headerLogoImageUrl} 
              alt="Logo" 
              className="object-contain"
              style={{ height: `${systemConfig.headerLogoSize}px` }}
            />
          )}
          {!systemConfig.headerLogoImageUrl && (
            <div className="text-lg font-bold" style={{ color: systemConfig.headerTextColor }}>
              {systemConfig.appTitle}
            </div>
          )}
          <div className="flex items-center">
            <div className="mr-3">
              <p className="text-sm font-medium" style={{ color: systemConfig.headerTextColor }}>
                {currentUser.name}
              </p>
              <p className="text-xs opacity-80" style={{ color: systemConfig.headerTextColor }}>
                {currentUser.documentNumber}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="rounded-full"
              style={{
                backgroundColor: `${systemConfig.headerTextColor}10`,
                color: systemConfig.headerTextColor
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${systemConfig.headerTextColor}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${systemConfig.headerTextColor}10`;
              }}
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
            <BrainLoader size="large" text={systemConfig.loadingText} />
          </div>
        ) : (
          <>
            {/* Cobranding Logo - only show if URL is provided */}
            {systemConfig.cobrandingImageUrl && systemConfig.cobrandingImageUrl.trim() !== "" && (
              <div className="flex justify-center mb-6 bg-white/20 py-3 rounded-lg">
                <img 
                  src={systemConfig.cobrandingImageUrl} 
                  alt="Cobranding" 
                  className="h-12 object-contain"
                />
              </div>
            )}

            <ProgressBar 
              progress={progressUnlockedCount} 
              total={Math.max(progressTotalSegments, 1)}
              progressTextColor={systemConfig.progressTextColor}
            />
            <div className="mb-4 rounded-lg border bg-white/90 px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                <span className="text-green-700">
                  Quiz bien: <strong>{quizTransparency.quizCorrectAnswers}</strong>
                </span>
                <span className="text-red-700">
                  Quiz mal: <strong>{quizTransparency.quizWrongAnswers}</strong>
                </span>
                <span className="text-indigo-700">
                  Bonus quiz: <strong>+{quizTransparency.quizBonusPoints}</strong>
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <div>
                {isMapCompleted &&
                  progressUnlockedCount === progressTotalSegments &&
                  progressTotalSegments > 0 && (
                  <BoxButton 
                    className="flex items-center gap-2 font-medium"
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
                    {systemConfig.prizeButtonText}
                  </BoxButton>
                )}
              </div>

            </div>
            
            <div className="flex gap-2 mb-4">
              <OutlineBoxButton
                size="sm"
                onClick={() => setShowInstructionsModal(true)}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
              >
                <HelpCircle className="h-4 w-4" />
                <span>{systemConfig.helpButtonText}</span>
              </OutlineBoxButton>
              <OutlineBoxButton
                size="sm"
                onClick={() => setShowSiteMapModal(true)}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
              >
                <Map className="h-4 w-4" />
                <span>{systemConfig.siteMapButtonText}</span>
              </OutlineBoxButton>
            </div>
            
            <MapGrid 
              unlockedSegments={unlockedSegments}
              campaignSlug={playerCampaignSlug}
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
            <BoxButton onClick={() => setShowInstructionsModal(false)}>
              Entendido
            </BoxButton>
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
            <BoxButton onClick={() => setShowSuccessModal(false)}>
              Continuar
            </BoxButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-lg sm:text-xl">{systemConfig.completionTitle}</DialogTitle>
          </DialogHeader>
          
          <div className="py-3 px-4 flex flex-col items-center">
            {/* Contenido más compacto */}
            <div className="flex items-center gap-4 mb-3">
              {/* Cerebro animado */}
              {systemConfig.completionShowBrain && (
                <div className="flex-shrink-0 relative w-12 h-12">
                  <img 
                    src="https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Cerebro.png" 
                    alt="Cerebro" 
                    className="w-full h-full object-contain animate-float"
                  />
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2/3 h-1 bg-black/10 rounded-full blur-sm animate-pulse"></div>
                </div>
              )}
              
              <div className="text-left">
                <p className="text-gray-800 text-lg font-medium">
                  {systemConfig.completionRewardHeadline}
                </p>
                <p className="text-gray-600 text-sm">
                  {systemConfig.completionRewardDescription}
                </p>
              </div>
            </div>
            
            {(systemConfig.completionShowQr || systemConfig.completionShowCode) && (
              <div className="border border-gray-200 rounded-lg p-3 w-full bg-gradient-to-b from-yellow-50 to-white mb-3">
                <h4 className="text-center font-medium text-gray-700 mb-2 text-sm">{systemConfig.completionCodeSectionTitle}</h4>
              
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  {/* QR Code */}
                  {systemConfig.completionShowQr && (
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
                  )}
                
                  {/* Código de redención en formato texto */}
                  {systemConfig.completionShowCode && redemptionCode && (
                    <div className="flex-grow bg-white p-3 border border-gray-300 rounded-md text-center">
                      <p className="text-xs text-gray-500 mb-1">{systemConfig.completionCodeLabel}</p>
                      <p className="font-mono text-lg font-bold tracking-wider select-all break-all">
                        {redemptionCode}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {systemConfig.completionCodeHelpText}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <OutlineBoxButton
              onClick={() => setShowCompletionModal(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              {systemConfig.completionCloseButtonText}
            </OutlineBoxButton>
            {systemConfig.completionShowSaveButton && (
              <BoxButton
                onClick={() => window.print()}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {systemConfig.completionSaveButtonText}
              </BoxButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingQuiz !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingQuiz(null);
            setQuizSelectedSlot("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pregunta del segmento</DialogTitle>
            <DialogDescription>
              Solo tienes un intento. Elige la respuesta correcta para desbloquear.
            </DialogDescription>
          </DialogHeader>
          {pendingQuiz && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <HtmlContent
                  html={pendingQuiz.quizQuestionHtml?.trim() ? pendingQuiz.quizQuestionHtml : "<p></p>"}
                />
              </div>
              <RadioGroup value={quizSelectedSlot} onValueChange={setQuizSelectedSlot}>
                {pendingQuiz.quizOptionLabels.map((label, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-3 rounded-md border p-3 bg-white/90"
                  >
                    <RadioGroupItem value={String(idx)} id={`map-quiz-opt-${idx}`} />
                    <Label htmlFor={`map-quiz-opt-${idx}`} className="cursor-pointer flex-1 font-normal">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <OutlineBoxButton
              type="button"
              onClick={() => {
                setPendingQuiz(null);
                setQuizSelectedSlot("");
              }}
            >
              Cancelar
            </OutlineBoxButton>
            <BoxButton
              type="button"
              onClick={handleQuizSubmit}
              disabled={quizSelectedSlot === "" || isLoading}
            >
              Enviar respuesta
            </BoxButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para contenido opcional de segmentos */}
      {segmentModalData && (
        <SegmentContentModal
          isOpen={showSegmentModal}
          onClose={() => {
            setShowSegmentModal(false);
            setSegmentModalData(null);
          }}
          segmentId={segmentModalData.segmentId}
          modalContent={segmentModalData.modalContent}
          title={segmentModalData.title}
        />
      )}
      
      {/* Footer con logos de patrocinadores */}
      {footerImageLoaded && (
        <footer className="mt-auto pb-8 pt-6 px-4">
          <div className="container mx-auto">
            <div className="bg-white/95 rounded-lg shadow-lg px-4 py-3 w-full flex items-center justify-center">
              <img 
                src={systemConfig.footerLogoUrl} 
                alt="Logos patrocinadores" 
                style={{ width: '100%', objectFit: 'contain', height: 'auto', maxHeight: '120px' }}
                className="w-full"
              />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default MapPage;
