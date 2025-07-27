import { 
  mapSegments, 
  users, 
  prizes, 
  mapSegmentAssets, 
  trapPoints,
  userScores,
  systemConfig,
  venues,
  type User, 
  type InsertUser, 
  type MapSegment, 
  type InsertMapSegment, 
  type Prize, 
  type InsertPrize, 
  type MapSegmentAsset, 
  type InsertMapSegmentAsset,
  type TrapPoints,
  type InsertTrapPoints,
  type UserScores,
  type InsertUserScores,
  type SystemConfig,
  type Venue,
  type InsertVenue,
  insertSystemConfigSchema
} from '@shared/schema';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export interface IStorage {
  // User operations
  getUserByDocumentNumber(documentNumber: string): Promise<User | undefined>;
  getUserById(userId: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUserAndAllData(userId: number): Promise<void>;

  // Map segment operations
  getSegmentsByUserId(userId: number): Promise<MapSegment[]>;
  unlockSegment(userId: number, segmentId: number): Promise<MapSegment>;
  
  // Trap points operations
  addTrapPoints(userId: number, segmentId: number, points?: number): Promise<TrapPoints>;
  getTrapPointsByUserId(userId: number): Promise<TrapPoints[]>;
  getTotalTrapPointsByUserId(userId: number): Promise<number>;
  
  // Reset all user data (for testing)
  resetAllUserData(): Promise<void>;

  // Prize operations
  getPrizeByUserId(userId: number): Promise<Prize | undefined>;
  createRedemptionCode(userId: number): Promise<string>;
  redeemPrize(userId: number): Promise<Prize>;
  getPrizeByRedemptionCode(code: string): Promise<Prize | undefined>;

  // Map segment assets operations (for admin dashboard)
  getAllMapSegmentAssets(): Promise<MapSegmentAsset[]>;
  getMapSegmentAsset(segmentId: number): Promise<MapSegmentAsset | undefined>;
  createMapSegmentAsset(asset: InsertMapSegmentAsset): Promise<MapSegmentAsset>;
  updateMapSegmentAsset(segmentId: number, asset: Partial<InsertMapSegmentAsset>): Promise<MapSegmentAsset>;
  deleteMapSegmentAsset(segmentId: number): Promise<void>;
  
  // System configuration operations
  getSystemConfig(): Promise<any>;
  updateSystemConfig(configData: any): Promise<any>;
  
  // Admin statistics
  getAllUsersWithProgress(): Promise<Array<{
    user: User;
    segments: MapSegment[];
    totalSegments: number;
    unlockedSegments: number;
    completionPercentage: number;
    prize: Prize | null;
  }>>;

  // Venue operations (CRUD)
  getAllVenues(): Promise<Venue[]>;
  getVenueById(id: number): Promise<Venue | undefined>;
  createVenue(venue: InsertVenue): Promise<Venue>;
  updateVenue(id: number, venue: Partial<InsertVenue>): Promise<Venue>;
  deleteVenue(id: number): Promise<void>;
  
  // Venue-specific ranking operations
  getVenueRanking(venueId: number): Promise<Array<{
    user: User;
    completionPercentage: number;
    totalSegments: number;
    unlockedSegments: number;
    position: number;
    score: number;
    trapPenalties: number;
  }>>;

  // User scores operations
  addUserScore(userId: number, segmentId: number, points: number, isTrap: boolean): Promise<UserScores>;
  getUserScores(userId: number): Promise<UserScores[]>;
  getUserScoreBySegment(userId: number, segmentId: number): Promise<UserScores | undefined>;
  calculateTotalScore(userId: number): Promise<number>;
  getVenueScoreRanking(venueId: number): Promise<Array<{
    user: User;
    validQRsScanned: number;
    trapQRsScanned: number;
    totalScore: number;
    position: number;
  }>>;
}

// Database storage implementation
import { db } from "./db";
import { asc, desc, eq, and, count } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUserByDocumentNumber(documentNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.documentNumber, documentNumber));
    return user || undefined;
  }

  async getUserById(userId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async deleteUserAndAllData(userId: number): Promise<void> {
    // Eliminar en orden correcto para evitar conflictos de foreign key
    
    // 1. Eliminar puntos de trampa del usuario
    await db.delete(trapPoints).where(eq(trapPoints.userId, userId));
    
    // 2. Eliminar scores del usuario
    await db.delete(userScores).where(eq(userScores.userId, userId));
    
    // 3. Eliminar segmentos del mapa del usuario
    await db.delete(mapSegments).where(eq(mapSegments.userId, userId));
    
    // 4. Eliminar premios del usuario
    await db.delete(prizes).where(eq(prizes.userId, userId));
    
    // 5. Finalmente eliminar el usuario
    await db.delete(users).where(eq(users.id, userId));
  }

  async getSegmentsByUserId(userId: number): Promise<MapSegment[]> {
    return await db
      .select()
      .from(mapSegments)
      .where(eq(mapSegments.userId, userId))
      .orderBy(asc(mapSegments.segmentId));
  }

  async unlockSegment(userId: number, segmentId: number): Promise<MapSegment> {
    // Verificar si ya existe el segmento para este usuario
    const existingSegment = await db
      .select()
      .from(mapSegments)
      .where(and(
        eq(mapSegments.userId, userId),
        eq(mapSegments.segmentId, segmentId)
      ));

    if (existingSegment.length > 0 && existingSegment[0].unlocked) {
      return existingSegment[0];
    }

    if (existingSegment.length > 0) {
      // Actualizar segmento existente
      const [updatedSegment] = await db
        .update(mapSegments)
        .set({ unlocked: true })
        .where(eq(mapSegments.id, existingSegment[0].id))
        .returning();
      
      return updatedSegment;
    } else {
      // Crear nuevo segmento
      const [newSegment] = await db
        .insert(mapSegments)
        .values({
          userId,
          segmentId,
          unlocked: true
        })
        .returning();
      
      return newSegment;
    }
  }

  async getPrizeByUserId(userId: number): Promise<Prize | undefined> {
    const [prize] = await db
      .select()
      .from(prizes)
      .where(eq(prizes.userId, userId));
    return prize || undefined;
  }

  async createRedemptionCode(userId: number): Promise<string> {
    // Buscar premio existente
    let [prize] = await db
      .select()
      .from(prizes)
      .where(eq(prizes.userId, userId));
    
    // Si no existe premio, crear uno nuevo
    if (!prize) {
      [prize] = await db
        .insert(prizes)
        .values({
          userId,
          redeemed: false
        })
        .returning();
    }
    
    // Si ya tiene código de redención, devolverlo
    if (prize.redemptionCode) {
      return prize.redemptionCode;
    }
    
    // Generar nuevo código de redención
    const code = nanoid(6).toUpperCase();
    
    await db
      .update(prizes)
      .set({ redemptionCode: code })
      .where(eq(prizes.id, prize.id));
    
    return code;
  }

  async redeemPrize(userId: number): Promise<Prize> {
    const [prize] = await db
      .select()
      .from(prizes)
      .where(eq(prizes.userId, userId));
    
    if (!prize) {
      throw new Error("No prize found for user");
    }
    
    const now = new Date();
    await db
      .update(prizes)
      .set({ 
        redeemed: true,
        redeemedAt: now
      })
      .where(eq(prizes.id, prize.id));
    
    return {
      ...prize,
      redeemed: true,
      redeemedAt: now
    };
  }

  async getPrizeByRedemptionCode(code: string): Promise<Prize | undefined> {
    const [prize] = await db
      .select()
      .from(prizes)
      .where(eq(prizes.redemptionCode, code));
    return prize || undefined;
  }

  async getAllMapSegmentAssets(): Promise<MapSegmentAsset[]> {
    return await db
      .select()
      .from(mapSegmentAssets)
      .orderBy(asc(mapSegmentAssets.segmentId));
  }

  async getMapSegmentAsset(segmentId: number): Promise<MapSegmentAsset | undefined> {
    const [asset] = await db
      .select()
      .from(mapSegmentAssets)
      .where(eq(mapSegmentAssets.segmentId, segmentId));
    return asset || undefined;
  }

  async createMapSegmentAsset(asset: InsertMapSegmentAsset): Promise<MapSegmentAsset> {
    const [newAsset] = await db
      .insert(mapSegmentAssets)
      .values(asset)
      .returning();
    return newAsset;
  }

  async updateMapSegmentAsset(segmentId: number, asset: Partial<InsertMapSegmentAsset>): Promise<MapSegmentAsset> {
    const [updatedAsset] = await db
      .update(mapSegmentAssets)
      .set(asset)
      .where(eq(mapSegmentAssets.segmentId, segmentId))
      .returning();
    
    if (!updatedAsset) {
      throw new Error("Asset not found");
    }
    
    return updatedAsset;
  }

  async deleteMapSegmentAsset(segmentId: number): Promise<void> {
    await db
      .delete(mapSegmentAssets)
      .where(eq(mapSegmentAssets.segmentId, segmentId));
  }
  
  // Trap points operations
  async addTrapPoints(userId: number, segmentId: number, points: number = 1): Promise<TrapPoints> {
    const [trapPoint] = await db
      .insert(trapPoints)
      .values({
        userId,
        segmentId,
        pointsAwarded: points
      })
      .returning();
    
    return trapPoint;
  }

  async getTrapPointsByUserId(userId: number): Promise<TrapPoints[]> {
    return await db
      .select()
      .from(trapPoints)
      .where(eq(trapPoints.userId, userId))
      .orderBy(desc(trapPoints.scannedAt));
  }

  async getTotalTrapPointsByUserId(userId: number): Promise<number> {
    const userTrapPoints = await this.getTrapPointsByUserId(userId);
    return userTrapPoints.reduce((total, trapPoint) => total + (trapPoint.pointsAwarded || 0), 0);
  }

  async resetAllUserData(): Promise<void> {
    await db.delete(trapPoints);
    await db.delete(mapSegments);
    await db.delete(prizes);
    await db.delete(users);
  }

  async getSystemConfig() {
    try {
      const [config] = await db
        .select()
        .from(systemConfig)
        .limit(1);
      
      if (config) {
        return config;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting system config:', error);
      
      return {
        id: 1,
        instructionsText: "Bienvenido a nuestra aplicación. Sigue las instrucciones para participar.",
        siteMapImageUrl: "https://placehold.co/1200x800/e2e8f0/64748b?text=Mapa+del+Sitio",
        footerLogoUrl: "https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Pata_de_logos_negro.png",
        cobrandingImageUrl: "https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Cobranding_actualizado.png",
        mapGapSize: "medium",
        mapGridSize: "3x3",
        appTitle: 'Lanzamiento 2025',
        backgroundImageUrl: 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png',
        gradientStartColor: '#bb2558',
        gradientEndColor: '#e8cf00',
        loginTitle: 'Lanzamiento',
        loginSubtitle: '2025',
        loginWelcomeText: 'Bienvenido al reto de identificación de riesgos',
        loginButtonText: 'Ingresar',
        loginDocumentLabel: 'Número de documento',
        loginNameLabel: 'Nombre completo',
        loginLogoImageUrl: '',
        headerLogoImageUrl: '',
        preloadImageUrl: '',
        scanButtonText: '¡Escanea aquí!',
        helpButtonText: 'Ayuda',
        siteMapButtonText: 'Mapa del Sitio',
        prizeButtonText: 'Ver Código Premio',
        completionTitle: '¡Felicidades, has completado el reto!',
        loadingText: 'Cargando tu mapa...',
        updatedAt: new Date()
      };
    }
  }
  
  async updateSystemConfig(configData: {
    instructionsText?: string;
    siteMapImageUrl?: string;
    footerLogoUrl?: string;
    cobrandingImageUrl?: string;
    mapGapSize?: 'none' | 'x-small' | 'small' | 'medium' | 'large';
    mapGridSize?: '3x3' | '3x2' | '2x3' | '4x2' | '2x4';
    appTitle?: string;
    backgroundImageUrl?: string;
    gradientStartColor?: string;
    gradientEndColor?: string;
    loginLogoImageUrl?: string;
    headerLogoImageUrl?: string;
    preloadImageUrl?: string;
    scanButtonText?: string;
    helpButtonText?: string;
    siteMapButtonText?: string;
    prizeButtonText?: string;
    completionTitle?: string;
    loadingText?: string;
  }): Promise<SystemConfig> {
    try {
      const validatedData = insertSystemConfigSchema.parse(configData);
      
      const existingConfig = await this.getSystemConfig();
      
      if (existingConfig) {
        const [updatedConfig] = await db
          .update(systemConfig)
          .set({
            ...validatedData,
            updatedAt: new Date()
          })
          .where(eq(systemConfig.id, existingConfig.id))
          .returning();
        
        return updatedConfig as any;
      } else {
        const [newConfig] = await db
          .insert(systemConfig)
          .values({
            ...validatedData,
            updatedAt: new Date()
          })
          .returning();
        
        return newConfig as any;
      }
    } catch (error) {
      console.error("Error al actualizar la configuración:", error);
      throw error;
    }
  }
  
  async getAllUsersWithProgress(): Promise<Array<{
    user: User;
    segments: MapSegment[];
    totalSegments: number;
    unlockedSegments: number;
    completionPercentage: number;
    prize: Prize | null;
  }>> {
    const result = [];
    
    // Get all valid (non-trap) segment assets to calculate actual total segments
    const allAssets = await this.getAllMapSegmentAssets();
    const validAssets = allAssets.filter(asset => !asset.isTrap);
    const totalSegments = validAssets.length;
    const validSegmentIds = validAssets.map(asset => asset.segmentId);
    
    const allUsers = await db.select().from(users);
    
    for (const user of allUsers) {
      const segments = await this.getSegmentsByUserId(user.id);
      // Only count unlocked segments that correspond to valid (non-trap) assets
      const unlockedSegments = segments.filter(s => 
        s.unlocked && validSegmentIds.includes(s.segmentId)
      ).length;
      const completionPercentage = totalSegments > 0 ? (unlockedSegments / totalSegments) * 100 : 0;
      const prize = await this.getPrizeByUserId(user.id);
      
      result.push({
        user,
        segments,
        totalSegments,
        unlockedSegments,
        completionPercentage,
        prize: prize || null
      });
    }
    
    return result.sort((a, b) => {
      if (a.completionPercentage === 100 && b.completionPercentage === 100) {
        if (a.user.completedAt && b.user.completedAt) {
          return a.user.completedAt.getTime() - b.user.completedAt.getTime();
        }
        else if (a.user.completedAt) {
          return -1;
        } else if (b.user.completedAt) {
          return 1;
        }
        return 0;
      }
      
      if (a.completionPercentage === 100) return -1;
      if (b.completionPercentage === 100) return 1;
      
      return b.completionPercentage - a.completionPercentage;
    });
  }

  // Venue operations (CRUD)
  async getAllVenues(): Promise<Venue[]> {
    return await db.select().from(venues).orderBy(asc(venues.name));
  }

  async getVenueById(id: number): Promise<Venue | undefined> {
    const [venue] = await db.select().from(venues).where(eq(venues.id, id));
    return venue;
  }

  async createVenue(venue: InsertVenue): Promise<Venue> {
    const [newVenue] = await db.insert(venues).values(venue).returning();
    return newVenue;
  }

  async updateVenue(id: number, venue: Partial<InsertVenue>): Promise<Venue> {
    const [updatedVenue] = await db
      .update(venues)
      .set({ ...venue, updatedAt: new Date() })
      .where(eq(venues.id, id))
      .returning();
    
    if (!updatedVenue) {
      throw new Error(`Venue with id ${id} not found`);
    }
    
    return updatedVenue;
  }

  async deleteVenue(id: number): Promise<void> {
    await db.delete(venues).where(eq(venues.id, id));
  }

  // Venue-specific ranking operations
  async getVenueRanking(venueId: number): Promise<Array<{
    user: User;
    completionPercentage: number;
    totalSegments: number;
    unlockedSegments: number;
    position: number;
    score: number;
    trapPenalties: number;
  }>> {
    const result = [];
    
    const config = await this.getSystemConfig();
    let totalSegments = 9;
    
    if (config && config.mapGridSize) {
      const [columns, rows] = config.mapGridSize.split('x').map(Number);
      totalSegments = columns * rows;
    }
    
    // Get users from specific venue
    const venueUsers = await db
      .select()
      .from(users)
      .where(eq(users.venueId, venueId));
    
    for (const user of venueUsers) {
      const segments = await this.getSegmentsByUserId(user.id);
      const unlockedSegments = segments.filter(s => s.unlocked).length;
      const completionPercentage = (unlockedSegments / totalSegments) * 100;
      
      // Calculate trap penalties
      const trapPointsRecords = await this.getTrapPointsByUserId(user.id);
      const trapPenalties = trapPointsRecords.reduce((total, record) => total + (record.pointsAwarded || 0), 0);
      
      // Calculate score: number of unlocked segments minus 0.5 points per trap penalty
      const score = unlockedSegments - (trapPenalties * 0.5);
      
      result.push({
        user,
        completionPercentage,
        totalSegments,
        unlockedSegments,
        position: 0, // Will be set after sorting
        score: Math.max(0, score), // Ensure score doesn't go negative
        trapPenalties
      });
    }
    
    // Sort by score (descending), then by completion percentage, then by completion time
    const sortedResults = result.sort((a, b) => {
      // First sort by score
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      
      // If scores are equal, sort by completion percentage
      if (a.completionPercentage !== b.completionPercentage) {
        return b.completionPercentage - a.completionPercentage;
      }
      
      // If completion percentages are equal and both completed, sort by completion time
      if (a.completionPercentage === 100 && b.completionPercentage === 100) {
        if (a.user.completedAt && b.user.completedAt) {
          return a.user.completedAt.getTime() - b.user.completedAt.getTime();
        }
        else if (a.user.completedAt) {
          return -1;
        } else if (b.user.completedAt) {
          return 1;
        }
      }
      
      return 0;
    });
    
    // Assign positions
    return sortedResults.map((item, index) => ({
      ...item,
      position: index + 1
    }));
  }

  // User scores operations
  async addUserScore(userId: number, segmentId: number, points: number, isTrap: boolean): Promise<UserScores> {
    const [score] = await db
      .insert(userScores)
      .values({
        userId,
        segmentId,
        points,
        isTrap
      })
      .returning();
    
    return score;
  }

  async getUserScores(userId: number): Promise<UserScores[]> {
    return await db
      .select()
      .from(userScores)
      .where(eq(userScores.userId, userId))
      .orderBy(asc(userScores.scannedAt));
  }

  async getUserScoreBySegment(userId: number, segmentId: number): Promise<UserScores | undefined> {
    const [score] = await db
      .select()
      .from(userScores)
      .where(and(
        eq(userScores.userId, userId),
        eq(userScores.segmentId, segmentId)
      ));
    
    return score;
  }

  async calculateTotalScore(userId: number): Promise<number> {
    const scores = await this.getUserScores(userId);
    return scores.reduce((total, score) => total + score.points, 0);
  }

  async getVenueScoreRanking(venueId: number): Promise<Array<{
    user: User;
    validQRsScanned: number;
    trapQRsScanned: number;
    totalScore: number;
    position: number;
  }>> {
    const result = [];
    
    // Get users from specific venue
    const venueUsers = await db
      .select()
      .from(users)
      .where(eq(users.venueId, venueId));
    
    for (const user of venueUsers) {
      const scores = await this.getUserScores(user.id);
      
      const validQRsScanned = scores.filter(s => !s.isTrap).length;
      const trapQRsScanned = scores.filter(s => s.isTrap).length;
      const totalScore = scores.reduce((total, score) => total + score.points, 0);
      
      result.push({
        user,
        validQRsScanned,
        trapQRsScanned,
        totalScore,
        position: 0 // Will be set after sorting
      });
    }
    
    // Sort by total score (descending)
    const sortedResults = result.sort((a, b) => b.totalScore - a.totalScore);
    
    // Assign positions
    return sortedResults.map((item, index) => ({
      ...item,
      position: index + 1
    }));
  }
}

export const storage = new DatabaseStorage();