import { apiRequest } from "@/lib/queryClient";
import type { User, MapSegment, Prize } from "@shared/schema";

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
  segment: MapSegment;
  unlockedSegments: number;
  totalSegments: number;
  completed: boolean;
  redemptionCode: string | null;
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

// Login with document number
export const login = async (documentNumber: string): Promise<LoginResponse> => {
  const response = await apiRequest("POST", "/api/login", { documentNumber });
  // If the response is not ok, throw the response object so we can check status codes
  if (!response.ok) {
    throw response;
  }
  return response.json();
};

// Register new user
export const register = async (documentNumber: string, name: string): Promise<RegisterResponse> => {
  const response = await apiRequest("POST", "/api/register", { documentNumber, name });
  // If the response is not ok, throw the response object so we can check status codes
  if (!response.ok) {
    throw response;
  }
  return response.json();
};

// Get user segments
export const getUserSegments = async (documentNumber: string): Promise<SegmentsResponse> => {
  const response = await apiRequest("GET", `/api/user/${documentNumber}/segments`);
  return response.json();
};

// Unlock segment
export const unlockSegment = async (documentNumber: string, segmentId: number): Promise<UnlockSegmentResponse> => {
  const response = await apiRequest("POST", "/api/unlock-segment", { documentNumber, segmentId });
  return response.json();
};

// Get user prize status
export const getUserPrize = async (documentNumber: string): Promise<PrizeResponse> => {
  const response = await apiRequest("GET", `/api/user/${documentNumber}/prize`);
  return response.json();
};

// Redeem prize
export const redeemPrize = async (redemptionCode: string): Promise<RedeemPrizeResponse> => {
  const response = await apiRequest("POST", "/api/redeem-prize", { redemptionCode });
  return response.json();
};
