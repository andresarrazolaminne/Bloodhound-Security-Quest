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
  hasActiveSession: () => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    // Cargar usuario del localStorage al inicializar
    try {
      const savedUser = localStorage.getItem('currentUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
      return null;
    }
  });
  
  const [unlockedSegments, setUnlockedSegmentsState] = useState<number[]>(() => {
    // Cargar segmentos desbloqueados del localStorage al inicializar
    try {
      const savedSegments = localStorage.getItem('unlockedSegments');
      return savedSegments ? JSON.parse(savedSegments) : [];
    } catch (error) {
      console.error('Error loading segments from localStorage:', error);
      return [];
    }
  });
  
  const [isMapCompleted, setIsMapCompleted] = useState<boolean>(false);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [trapPoints, setTrapPoints] = useState<number>(0);

  // Función para establecer el usuario actual con persistencia
  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    try {
      if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('lastDocument', user.documentNumber);
      } else {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('lastDocument');
      }
    } catch (error) {
      console.error('Error saving user to localStorage:', error);
    }
  };

  // Función para verificar si hay un usuario que debería estar logueado
  const hasActiveSession = () => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      const lastDocument = localStorage.getItem('lastDocument');
      return savedUser && lastDocument && currentUser;
    } catch (error) {
      console.error('Error checking session:', error);
      return false;
    }
  };

  const setUnlockedSegments = (segmentIds: number[]) => {
    setUnlockedSegmentsState(segmentIds);
    
    // Persistir en localStorage
    try {
      localStorage.setItem('unlockedSegments', JSON.stringify(segmentIds));
    } catch (error) {
      console.error('Error saving segments to localStorage:', error);
    }
    
    // Check if all segments are unlocked (total of 9 segments)
    if (segmentIds.length === 9) {
      setIsMapCompleted(true);
    }
  };

  const addUnlockedSegment = (segmentId: number) => {
    if (!unlockedSegments.includes(segmentId)) {
      const newUnlockedSegments = [...unlockedSegments, segmentId];
      setUnlockedSegmentsState(newUnlockedSegments);
      
      // Persistir en localStorage
      try {
        localStorage.setItem('unlockedSegments', JSON.stringify(newUnlockedSegments));
      } catch (error) {
        console.error('Error saving segments to localStorage:', error);
      }
      
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
      localStorage.removeItem("currentUser");
      localStorage.removeItem("lastDocument");
      localStorage.removeItem("unlockedSegments");
      localStorage.removeItem("tempDocument");
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
    logout,
    hasActiveSession
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
