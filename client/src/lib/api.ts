import { apiRequest } from "@/lib/queryClient";
import type { User, MapSegment, Prize } from "@shared/schema";

/** Lee JSON en respuestas OK; evita fallos silenciosos si llega HTML (API mal montada) o cuerpo vacío. */
export async function readOkJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const ct = response.headers.get("content-type") || "";
  const looksHtml =
    ct.includes("text/html") ||
    text.trimStart().startsWith("<!") ||
    text.trimStart().toLowerCase().startsWith("<html");
  if (looksHtml) {
    throw new Error(
      "El servidor devolvió HTML en lugar de JSON. Revisa que Node monte la API en el mismo prefijo que el frontend (p. ej. /bloodhound/api) y variables VITE_BASE_PATH / UI_BASE_PATH en PM2.",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.trim() === ""
        ? "Respuesta vacía del servidor (¿URL de API incorrecta?)."
        : `Respuesta no válida: ${text.slice(0, 180)}`,
    );
  }
}

export async function describeApiFailure(error: unknown): Promise<string> {
  if (error instanceof Response) {
    const raw = await error.clone().text();
    try {
      const j = JSON.parse(raw) as { message?: string; code?: string };
      if (typeof j.message === "string") return j.message;
      if (typeof j.code === "string") return `${j.code}${j.message ? `: ${j.message}` : ""}`;
    } catch {
      if (raw.includes("<!DOCTYPE") || raw.includes("<html")) {
        return "Respuesta HTML en error HTTP (prefijo de API incorrecto o proxy mal configurado).";
      }
      return `HTTP ${error.status}: ${raw.slice(0, 160)}`;
    }
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface LoginResponse {
  user: User;
}

export interface RegisterResponse {
  user: User;
}

export interface SegmentsResponse {
  segments: MapSegment[];
}

export interface UnlockSegmentResponse {
  segment?: MapSegment;
  unlockedSegments: number;
  totalSegments: number;
  completed: boolean;
  redemptionCode: string | null;
  // Campos para QR trampa
  isTrap?: boolean;
  trapPoints?: number;
  message?: string;
  trapMessage?: string;
  // Campos para modal de contenido opcional
  modalContent?: string;
  segmentTitle?: string;
  // Campo para indicar si el segmento ya fue escaneado
  alreadyScanned?: boolean;
  /** Paso intermedio: el jugador debe responder antes de desbloquear */
  needsQuiz?: boolean;
  challengeToken?: string;
  quizQuestionHtml?: string;
  quizOptionLabels?: string[];
}

export interface PrizeResponse {
  prize: Prize;
  completed: boolean;
  redemptionCode: string | null;
}

export interface RedeemPrizeResponse {
  message: string;
  prize: Prize;
}

export interface UserQuizStatsResponse {
  quizCorrectAnswers: number;
  quizWrongAnswers: number;
  quizBonusPoints: number;
}

// Login with document number
export const login = async (documentNumber: string, campaignSlug?: string | null): Promise<LoginResponse> => {
  const response = await apiRequest("POST", "/api/login", { documentNumber }, campaignSlug);
  // If the response is not ok, throw the response object so we can check status codes
  if (!response.ok) {
    throw response;
  }
  return readOkJson<LoginResponse>(response);
};

// Register new user
export const register = async (
  documentNumber: string,
  name: string,
  venueId?: number,
  campaignSlug?: string | null,
): Promise<RegisterResponse> => {
  const response = await apiRequest("POST", "/api/register", { documentNumber, name, venueId }, campaignSlug);
  // If the response is not ok, throw the response object so we can check status codes
  if (!response.ok) {
    throw response;
  }
  return readOkJson<RegisterResponse>(response);
};

// Get user segments
export const getUserSegments = async (
  documentNumber: string,
  campaignSlug?: string | null,
): Promise<SegmentsResponse> => {
  const doc = encodeURIComponent(documentNumber);
  const response = await apiRequest("GET", `/api/user/${doc}/segments`, undefined, campaignSlug);
  if (!response.ok) {
    throw response;
  }
  return readOkJson<SegmentsResponse>(response);
};

// Unlock segment
export const unlockSegment = async (
  documentNumber: string,
  segmentId: number,
  securityCode?: string,
  campaignSlug?: string | null,
  quiz?: { challengeToken: string; selectedSlot: number },
): Promise<UnlockSegmentResponse> => {
  const payload: Record<string, unknown> = { documentNumber, segmentId };

  if (securityCode) {
    payload.securityCode = securityCode;
  }
  if (quiz) {
    payload.quizChallengeToken = quiz.challengeToken;
    payload.quizSelectedSlot = quiz.selectedSlot;
  }

  const response = await apiRequest("POST", "/api/unlock-segment", payload, campaignSlug);
  
  // Si hay un error, lanzamos la respuesta para poder verificar el código de estado
  if (!response.ok) {
    throw response;
  }
  
  return readOkJson<UnlockSegmentResponse>(response);
};

// Get user prize status
export const getUserPrize = async (
  documentNumber: string,
  campaignSlug?: string | null,
): Promise<PrizeResponse> => {
  const doc = encodeURIComponent(documentNumber);
  const response = await apiRequest("GET", `/api/user/${doc}/prize`, undefined, campaignSlug);
  if (!response.ok) {
    throw response;
  }
  return readOkJson<PrizeResponse>(response);
};

export const getUserQuizStats = async (
  documentNumber: string,
  campaignSlug?: string | null,
): Promise<UserQuizStatsResponse> => {
  const doc = encodeURIComponent(documentNumber);
  const response = await apiRequest("GET", `/api/user/${doc}/quiz-stats`, undefined, campaignSlug);
  if (!response.ok) {
    throw response;
  }
  return readOkJson<UserQuizStatsResponse>(response);
};

// Redeem prize
export const redeemPrize = async (redemptionCode: string): Promise<RedeemPrizeResponse> => {
  const response = await apiRequest("POST", "/api/redeem-prize", { redemptionCode });
  // If the response is not ok, throw the response object so we can check status codes
  if (!response.ok) {
    throw response;
  }
  return readOkJson<RedeemPrizeResponse>(response);
};

// Get all map assets (jugador: endpoint público, sin códigos de seguridad)
export const getAllMapAssets = async (
  campaignSlug?: string | null,
): Promise<{ assets: Array<{ isTrap: boolean; segmentId: number }> }> => {
  const response = await apiRequest("GET", "/api/map-assets", undefined, campaignSlug);
  if (!response.ok) {
    throw response;
  }
  return readOkJson<{ assets: Array<{ isTrap: boolean; segmentId: number }> }>(response);
};
