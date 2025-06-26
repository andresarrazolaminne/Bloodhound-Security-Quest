import { createContext, useState, useContext, ReactNode } from "react";
import type { User, MapSegment } from "@shared/schema";

interface UserContextType {
  currentUser: User | null;
  unlockedSegments: number[];
  setCurrentUser: (user: User | null) => void;
  setUnlockedSegments: (segmentIds: number[]) => void;
  addUnlockedSegment: (segmentId: number) => void;
  isMapCompleted: boolean;
  setIsMapCompleted: (completed: boolean) => void;
  redemptionCode: string | null;
  setRedemptionCode: (code: string | null) => void;
  trapPoints: number;
  setTrapPoints: (points: number) => void;
  addTrapPoints: (points: number) => void;
  isUserLoading: boolean;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [unlockedSegments, setUnlockedSegmentsState] = useState<number[]>([]);
  const [isMapCompleted, setIsMapCompleted] = useState<boolean>(false);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [trapPoints, setTrapPoints] = useState<number>(0);

  const setUnlockedSegments = (segmentIds: number[]) => {
    setUnlockedSegmentsState(segmentIds);
    
    // Check if all segments are unlocked (total of 9 segments)
    if (segmentIds.length === 9) {
      setIsMapCompleted(true);
    }
  };

  const addUnlockedSegment = (segmentId: number) => {
    if (!unlockedSegments.includes(segmentId)) {
      const newUnlockedSegments = [...unlockedSegments, segmentId];
      setUnlockedSegmentsState(newUnlockedSegments);
      
      // Check if all segments are unlocked (total of 9 segments)
      if (newUnlockedSegments.length === 9) {
        setIsMapCompleted(true);
      }
    }
  };

  const addTrapPoints = (points: number) => {
    setTrapPoints(prev => prev + points);
  };

  const logout = () => {
    // Limpiar localStorage para evitar auto-login
    try {
      localStorage.removeItem("last_login_document");
    } catch (e) {
      console.error("Error al limpiar localStorage:", e);
    }
    
    // Reiniciar estado
    setCurrentUser(null);
    setUnlockedSegmentsState([]);
    setIsMapCompleted(false);
    setRedemptionCode(null);
    setTrapPoints(0);
  };

  const value = {
    currentUser,
    unlockedSegments,
    setCurrentUser,
    setUnlockedSegments,
    addUnlockedSegment,
    isMapCompleted,
    setIsMapCompleted,
    redemptionCode,
    setRedemptionCode,
    trapPoints,
    setTrapPoints,
    addTrapPoints,
    isUserLoading: false,
    logout
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
