import { 
  mapSegments, 
  users, 
  prizes, 
  mapSegmentAssets, 
  systemConfig, 
  type User, 
  type InsertUser, 
  type MapSegment, 
  type InsertMapSegment, 
  type Prize, 
  type InsertPrize, 
  type MapSegmentAsset, 
  type InsertMapSegmentAsset,
  type SystemConfig,
  insertSystemConfigSchema
} from '@shared/schema';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export interface IStorage {
  // User operations
  getUserByDocumentNumber(documentNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Map segment operations
  getSegmentsByUserId(userId: number): Promise<MapSegment[]>;
  unlockSegment(userId: number, segmentId: number): Promise<MapSegment>;
  
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
  
  // Admin statistics
  getAllUsersWithProgress(): Promise<Array<{
    user: User;
    segments: MapSegment[];
    totalSegments: number;
    unlockedSegments: number;
    completionPercentage: number;
    prize: Prize | null;
  }>>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private segments: Map<number, MapSegment[]>;
  private prizes: Map<number, Prize>;
  private redemptionCodes: Map<string, number>; // redemptionCode -> userId
  private mapAssets: Map<number, MapSegmentAsset>; // segmentId -> asset
  private currentUserId: number;
  private currentSegmentId: number;
  private currentPrizeId: number;
  private currentAssetId: number;

  constructor() {
    this.users = new Map();
    this.segments = new Map();
    this.prizes = new Map();
    this.redemptionCodes = new Map();
    this.mapAssets = new Map();
    this.currentUserId = 1;
    this.currentSegmentId = 1;
    this.currentPrizeId = 1;
    this.currentAssetId = 1;
  }

  // User operations
  async getUserByDocumentNumber(documentNumber: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.documentNumber === documentNumber) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user = { 
      ...insertUser, 
      id, 
      completedAt: null 
    };
    this.users.set(id, user);

    // Initialize empty segments for the new user
    this.segments.set(id, []);

    // Initialize prize record for the user
    const prize: Prize = {
      id: this.currentPrizeId++,
      userId: id,
      redeemed: false,
      redemptionCode: null,
      redeemedAt: null
    };
    this.prizes.set(id, prize);

    return user;
  }

  // Map segment operations
  async getSegmentsByUserId(userId: number): Promise<MapSegment[]> {
    return this.segments.get(userId) || [];
  }

  async unlockSegment(userId: number, segmentId: number): Promise<MapSegment> {
    const userSegments = this.segments.get(userId) || [];

    // Check if segment is already unlocked
    const existingSegment = userSegments.find(s => s.segmentId === segmentId);
    if (existingSegment) {
      if (!existingSegment.unlocked) {
        existingSegment.unlocked = true;
      }
      return existingSegment;
    }

    // Create new segment record
    const newSegment: MapSegment = {
      id: this.currentSegmentId++,
      userId,
      segmentId,
      unlocked: true
    };

    userSegments.push(newSegment);
    this.segments.set(userId, userSegments);

    return newSegment;
  }

  // Prize operations
  async getPrizeByUserId(userId: number): Promise<Prize | undefined> {
    return this.prizes.get(userId);
  }

  async createRedemptionCode(userId: number): Promise<string> {
    const prize = this.prizes.get(userId);
    if (!prize) {
      throw new Error("No prize found for user");
    }

    if (prize.redemptionCode) {
      return prize.redemptionCode;
    }

    // Generate unique 6-character redemption code
    const code = nanoid(6).toUpperCase();
    
    // Update prize with redemption code
    prize.redemptionCode = code;
    this.prizes.set(userId, prize);
    this.redemptionCodes.set(code, userId);

    return code;
  }

  async redeemPrize(userId: number): Promise<Prize> {
    const prize = this.prizes.get(userId);
    if (!prize) {
      throw new Error("No prize found for user");
    }

    // Mark as redeemed with timestamp
    prize.redeemed = true;
    prize.redeemedAt = new Date();
    this.prizes.set(userId, prize);

    return prize;
  }

  async getPrizeByRedemptionCode(code: string): Promise<Prize | undefined> {
    const userId = this.redemptionCodes.get(code);
    if (!userId) {
      return undefined;
    }
    return this.prizes.get(userId);
  }

  // Map segment assets operations (for admin dashboard)
  async getAllMapSegmentAssets(): Promise<MapSegmentAsset[]> {
    return Array.from(this.mapAssets.values());
  }

  async getMapSegmentAsset(segmentId: number): Promise<MapSegmentAsset | undefined> {
    return this.mapAssets.get(segmentId);
  }

  async createMapSegmentAsset(asset: InsertMapSegmentAsset): Promise<MapSegmentAsset> {
    const id = this.currentAssetId++;

    const newAsset: MapSegmentAsset = {
      id,
      segmentId: asset.segmentId,
      imageUrl: asset.imageUrl,
      redirectUrl: asset.redirectUrl || null,
      title: asset.title || "",
      description: asset.description || null,
      securityCode: asset.securityCode || "",
      updatedAt: new Date()
    };

    this.mapAssets.set(asset.segmentId, newAsset);
    return newAsset;
  }

  async updateMapSegmentAsset(segmentId: number, asset: Partial<InsertMapSegmentAsset>): Promise<MapSegmentAsset> {
    const existingAsset = this.mapAssets.get(segmentId);
    if (!existingAsset) {
      throw new Error("Asset not found");
    }

    const updatedAsset: MapSegmentAsset = {
      ...existingAsset,
      ...asset,
      updatedAt: new Date()
    };

    this.mapAssets.set(segmentId, updatedAsset);
    return updatedAsset;
  }

  async deleteMapSegmentAsset(segmentId: number): Promise<void> {
    this.mapAssets.delete(segmentId);
  }
  
  // Reset user data for testing
  async resetAllUserData(): Promise<void> {
    this.users.clear();
    this.segments.clear();
    this.prizes.clear();
    this.redemptionCodes.clear();
    this.currentUserId = 1;
    this.currentSegmentId = 1;
    this.currentPrizeId = 1;
  }
  
  // Admin statistics
  async getAllUsersWithProgress(): Promise<Array<{
    user: User;
    segments: MapSegment[];
    totalSegments: number;
    unlockedSegments: number;
    completionPercentage: number;
    prize: Prize | null;
  }>> {
    const result = [];
    const totalSegments = 9; // Total de segmentos fijos en el mapa
    
    // Recorrer todos los usuarios
    for (const user of this.users.values()) {
      const segments = this.segments.get(user.id) || [];
      const unlockedSegments = segments.filter(s => s.unlocked).length;
      const completionPercentage = (unlockedSegments / totalSegments) * 100;
      const prize = this.prizes.get(user.id) || null;
      
      result.push({
        user,
        segments,
        totalSegments,
        unlockedSegments,
        completionPercentage,
        prize
      });
    }
    
    // Primero ordenamos por quién completó el mapa (100%)
    // Luego por la fecha de completado (los que completaron primero aparecen primero)
    // Finalmente por el porcentaje de completado para los que no han terminado
    return result.sort((a, b) => {
      // Si ambos completaron el mapa
      if (a.completionPercentage === 100 && b.completionPercentage === 100) {
        // Si ambos tienen fecha de completado, ordenar por fecha (más antigua primero)
        if (a.user.completedAt && b.user.completedAt) {
          return a.user.completedAt.getTime() - b.user.completedAt.getTime();
        }
        // Si solo uno tiene fecha de completado, ese va primero
        else if (a.user.completedAt) {
          return -1;
        } else if (b.user.completedAt) {
          return 1;
        }
        // Si ninguno tiene fecha, mantener el orden actual
        return 0;
      }
      
      // Si solo uno completó el mapa, ese va primero
      if (a.completionPercentage === 100) return -1;
      if (b.completionPercentage === 100) return 1;
      
      // Si ninguno completó, ordenar por porcentaje de completado (mayor primero)
      return b.completionPercentage - a.completionPercentage;
    });
  }
}

// Database storage implementation
import { db } from "./db";
import { asc, desc, eq, and, count } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUserByDocumentNumber(documentNumber: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.documentNumber, documentNumber));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    // Crear segmentos para el usuario (inicialmente bloqueados)
    for (let i = 1; i <= 9; i++) {
      await db
        .insert(mapSegments)
        .values({
          userId: user.id,
          segmentId: i,
          unlocked: false
        });
    }
    
    // Crear premio para el usuario (inicialmente no reclamado)
    await db
      .insert(prizes)
      .values({
        userId: user.id,
        redeemed: false,
        redemptionCode: null,
        redeemedAt: null
      });
    
    return user;
  }

  async getSegmentsByUserId(userId: number): Promise<MapSegment[]> {
    return await db
      .select()
      .from(mapSegments)
      .where(eq(mapSegments.userId, userId));
  }

  async unlockSegment(userId: number, segmentId: number): Promise<MapSegment> {
    // Verificar si el segmento ya existe
    const [existingSegment] = await db
      .select()
      .from(mapSegments)
      .where(
        and(
          eq(mapSegments.userId, userId),
          eq(mapSegments.segmentId, segmentId)
        )
      );
    
    if (existingSegment) {
      // Si existe pero no está desbloqueado, actualizarlo
      if (!existingSegment.unlocked) {
        await db
          .update(mapSegments)
          .set({ unlocked: true })
          .where(eq(mapSegments.id, existingSegment.id));
        
        return { ...existingSegment, unlocked: true };
      }
      // Si ya está desbloqueado, simplemente retornarlo
      return existingSegment;
    } 
    else {
      // Crear nuevo registro de segmento desbloqueado
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
    
    return prize;
  }

  async createRedemptionCode(userId: number): Promise<string> {
    const [prize] = await db
      .select()
      .from(prizes)
      .where(eq(prizes.userId, userId));
    
    if (!prize) {
      throw new Error("No prize found for user");
    }
    
    // Si ya tiene código, simplemente devolverlo
    if (prize.redemptionCode) {
      return prize.redemptionCode;
    }
    
    // Generar código único de 6 caracteres
    const code = nanoid(6).toUpperCase();
    
    // Actualizar premio con código de redención
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
    
    // Marcar como reclamado con marca de tiempo
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
    
    return prize;
  }

  async getAllMapSegmentAssets(): Promise<MapSegmentAsset[]> {
    return await db
      .select()
      .from(mapSegmentAssets)
      .orderBy(mapSegmentAssets.segmentId);
  }

  async getMapSegmentAsset(segmentId: number): Promise<MapSegmentAsset | undefined> {
    const [asset] = await db
      .select()
      .from(mapSegmentAssets)
      .where(eq(mapSegmentAssets.segmentId, segmentId));
    
    return asset;
  }

  async createMapSegmentAsset(asset: InsertMapSegmentAsset): Promise<MapSegmentAsset> {
    const [newAsset] = await db
      .insert(mapSegmentAssets)
      .values({
        ...asset,
        updatedAt: new Date()
      })
      .returning();
    
    return newAsset;
  }

  async updateMapSegmentAsset(segmentId: number, asset: Partial<InsertMapSegmentAsset>): Promise<MapSegmentAsset> {
    const [updatedAsset] = await db
      .update(mapSegmentAssets)
      .set({
        ...asset,
        updatedAt: new Date()
      })
      .where(eq(mapSegmentAssets.segmentId, segmentId))
      .returning();
    
    return updatedAsset;
  }

  async deleteMapSegmentAsset(segmentId: number): Promise<void> {
    await db
      .delete(mapSegmentAssets)
      .where(eq(mapSegmentAssets.segmentId, segmentId));
  }
  
  // Reset all user data for testing
  async resetAllUserData(): Promise<void> {
    // Eliminar todos los premios
    await db.delete(prizes);
    
    // Eliminar todos los segmentos del mapa
    await db.delete(mapSegments);
    
    // Eliminar todos los usuarios
    await db.delete(users);
    
    console.log("Todos los datos de usuarios han sido eliminados");
  }
  
  async getSystemConfig() {
    const [config] = await db
      .select()
      .from(systemConfig);
    
    return config || null;
  }
  
  async updateSystemConfig(configData: {
    instructionsText?: string;
    siteMapImageUrl?: string;
  }): Promise<SystemConfig> {
    try {
      // Validar los datos 
      const validatedData = insertSystemConfigSchema.parse(configData);
      
      // Verificar si ya existe una configuración
      const existingConfig = await this.getSystemConfig();
      
      if (existingConfig) {
        // Actualizar configuración existente
        const [updatedConfig] = await db
          .update(systemConfig)
          .set({
            ...validatedData,
            updatedAt: new Date()
          })
          .where(eq(systemConfig.id, existingConfig.id))
          .returning();
        
        return updatedConfig;
      } else {
        // Crear nueva configuración
        const [newConfig] = await db
          .insert(systemConfig)
          .values({
            ...validatedData,
            updatedAt: new Date()
          })
          .returning();
        
        return newConfig;
      }
    } catch (error) {
      console.error("Error al actualizar la configuración:", error);
      throw error;
    }
  }
  
  // Admin statistics
  async getAllUsersWithProgress(): Promise<Array<{
    user: User;
    segments: MapSegment[];
    totalSegments: number;
    unlockedSegments: number;
    completionPercentage: number;
    prize: Prize | null;
  }>> {
    const result = [];
    const totalSegments = 9; // Total de segmentos fijos en el mapa
    
    // Obtener todos los usuarios
    const allUsers = await db.select().from(users);
    
    // Para cada usuario, recopilamos su progreso
    for (const user of allUsers) {
      // Obtener segmentos del usuario
      const segments = await this.getSegmentsByUserId(user.id);
      
      // Calcular segmentos desbloqueados
      const unlockedSegments = segments.filter(s => s.unlocked).length;
      const completionPercentage = (unlockedSegments / totalSegments) * 100;
      
      // Obtener premio (si existe)
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
    
    // Primero ordenamos por quién completó el mapa (100%)
    // Luego por la fecha de completado (los que completaron primero aparecen primero)
    // Finalmente por el porcentaje de completado para los que no han terminado
    return result.sort((a, b) => {
      // Si ambos completaron el mapa
      if (a.completionPercentage === 100 && b.completionPercentage === 100) {
        // Si ambos tienen fecha de completado, ordenar por fecha (más antigua primero)
        if (a.user.completedAt && b.user.completedAt) {
          return a.user.completedAt.getTime() - b.user.completedAt.getTime();
        }
        // Si solo uno tiene fecha de completado, ese va primero
        else if (a.user.completedAt) {
          return -1;
        } else if (b.user.completedAt) {
          return 1;
        }
        // Si ninguno tiene fecha, mantener el orden actual
        return 0;
      }
      
      // Si solo uno completó el mapa, ese va primero
      if (a.completionPercentage === 100) return -1;
      if (b.completionPercentage === 100) return 1;
      
      // Si ninguno completó, ordenar por porcentaje de completado (mayor primero)
      return b.completionPercentage - a.completionPercentage;
    });
  }
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();
