import { 
  campaigns,
  mapSegments, 
  users, 
  prizes, 
  mapSegmentAssets, 
  trapPoints,
  userScores,
  systemConfig,
  venues,
  uploadedAssets,
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
  type UploadedAsset,
  type InsertUploadedAsset,
  type Campaign,
  type InsertCampaign,
  insertSystemConfigSchema
} from '@shared/schema';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import * as fs from "node:fs";
import * as path from "node:path";

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? "/usr/share/nginx/html/bloodhound/uploads";

export interface IStorage {
  // Campaign operations
  ensureCampaignBySlug(slug: string, name?: string): Promise<Campaign>;
  getCampaignBySlug(slug: string): Promise<Campaign | undefined>;
  listCampaigns(): Promise<Campaign[]>;
  createCampaign(slug: string, name: string): Promise<Campaign>;
  updateCampaign(slug: string, data: { name?: string; isActive?: boolean }): Promise<Campaign | undefined>;

  // User operations
  getUserByDocumentNumber(documentNumber: string, campaignId?: number): Promise<User | undefined>;
  getUserById(userId: number, campaignId?: number): Promise<User | undefined>;
  createUser(user: InsertUser, campaignId?: number): Promise<User>;
  deleteUserAndAllData(userId: number, campaignId?: number): Promise<void>;

  // Map segment operations
  getSegmentsByUserId(userId: number, campaignId?: number): Promise<MapSegment[]>;
  unlockSegment(userId: number, segmentId: number, campaignId?: number): Promise<MapSegment>;
  
  // Trap points operations
  addTrapPoints(userId: number, segmentId: number, points?: number, campaignId?: number): Promise<TrapPoints>;
  getTrapPointsByUserId(userId: number, campaignId?: number): Promise<TrapPoints[]>;
  getTotalTrapPointsByUserId(userId: number, campaignId?: number): Promise<number>;
  
  // Reset all user data (for testing)
  resetAllUserData(campaignId?: number): Promise<void>;

  // Prize operations
  getPrizeByUserId(userId: number, campaignId?: number): Promise<Prize | undefined>;
  createRedemptionCode(userId: number, campaignId?: number): Promise<string>;
  redeemPrize(userId: number, campaignId?: number): Promise<Prize>;
  getPrizeByRedemptionCode(code: string, campaignId?: number): Promise<Prize | undefined>;

  // Map segment assets operations (for admin dashboard)
  getAllMapSegmentAssets(campaignId?: number): Promise<MapSegmentAsset[]>;
  getMapSegmentAsset(segmentId: number, campaignId?: number): Promise<MapSegmentAsset | undefined>;
  createMapSegmentAsset(asset: InsertMapSegmentAsset, campaignId?: number): Promise<MapSegmentAsset>;
  updateMapSegmentAsset(segmentId: number, asset: Partial<InsertMapSegmentAsset>, campaignId?: number): Promise<MapSegmentAsset>;
  deleteMapSegmentAsset(segmentId: number, campaignId?: number): Promise<void>;
  
  // System configuration operations
  getSystemConfig(campaignId?: number): Promise<any>;
  updateSystemConfig(configData: any, campaignId?: number): Promise<any>;

  // Uploaded assets (admin dashboard)
  listUploadedAssets(campaignId?: number): Promise<UploadedAsset[]>;
  createUploadedAsset(asset: InsertUploadedAsset, campaignId?: number): Promise<UploadedAsset>;
  deleteUploadedAsset(id: number, campaignId?: number): Promise<void>;
  
  // Admin statistics
  getAllUsersWithProgress(campaignId?: number): Promise<Array<{
    user: User;
    segments: MapSegment[];
    totalSegments: number;
    unlockedSegments: number;
    completionPercentage: number;
    prize: Prize | null;
  }>>;

  // Venue operations (CRUD)
  getAllVenues(campaignId?: number): Promise<Venue[]>;
  getVenueById(id: number, campaignId?: number): Promise<Venue | undefined>;
  createVenue(venue: InsertVenue, campaignId?: number): Promise<Venue>;
  updateVenue(id: number, venue: Partial<InsertVenue>, campaignId?: number): Promise<Venue>;
  deleteVenue(id: number, campaignId?: number): Promise<void>;
  
  // Venue-specific ranking operations
  getVenueRanking(venueId: number, campaignId?: number): Promise<Array<{
    user: User;
    completionPercentage: number;
    totalSegments: number;
    unlockedSegments: number;
    position: number;
    score: number;
    trapPenalties: number;
  }>>;

  // User scores operations
  addUserScore(userId: number, segmentId: number, points: number, isTrap: boolean, campaignId?: number): Promise<UserScores>;
  getUserScores(userId: number, campaignId?: number): Promise<UserScores[]>;
  getUserScoreBySegment(userId: number, segmentId: number, campaignId?: number): Promise<UserScores | undefined>;
  calculateTotalScore(userId: number, campaignId?: number): Promise<number>;
  getVenueScoreRanking(venueId: number, campaignId?: number): Promise<Array<{
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
  private async getDefaultCampaignId(): Promise<number> {
    const campaign = await this.ensureCampaignBySlug("default", "Default Campaign");
    return campaign.id;
  }

  private async resolveCampaignId(campaignId?: number): Promise<number> {
    return campaignId ?? this.getDefaultCampaignId();
  }

  async ensureCampaignBySlug(slug: string, name?: string): Promise<Campaign> {
    const existing = await this.getCampaignBySlug(slug);
    if (existing) return existing;
    const [created] = await db
      .insert(campaigns)
      .values({
        slug,
        name: name ?? slug,
        isActive: true,
      })
      .returning();
    return created;
  }

  async getCampaignBySlug(slug: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1);
    return campaign;
  }

  async listCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).orderBy(asc(campaigns.name));
  }

  async createCampaign(slug: string, name: string): Promise<Campaign> {
    const existing = await this.getCampaignBySlug(slug);
    if (existing) {
      throw new Error("Ya existe una campaña con ese slug");
    }
    const [created] = await db
      .insert(campaigns)
      .values({
        slug,
        name,
        isActive: true,
      })
      .returning();
    return created;
  }

  async updateCampaign(slug: string, data: { name?: string; isActive?: boolean }): Promise<Campaign | undefined> {
    const existing = await this.getCampaignBySlug(slug);
    if (!existing) return undefined;
    const [updated] = await db
      .update(campaigns)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, existing.id))
      .returning();
    return updated;
  }

  async getUserByDocumentNumber(documentNumber: string, campaignId?: number): Promise<User | undefined> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.documentNumber, documentNumber), eq(users.campaignId, scopedCampaignId)));
    return user || undefined;
  }

  async getUserById(userId: number, campaignId?: number): Promise<User | undefined> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [user] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.campaignId, scopedCampaignId)));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser, campaignId?: number): Promise<User> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, campaignId: scopedCampaignId })
      .returning();
    return user;
  }

  async deleteUserAndAllData(userId: number, campaignId?: number): Promise<void> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    // Eliminar en orden correcto para evitar conflictos de foreign key
    
    // 1. Eliminar puntos de trampa del usuario
    await db.delete(trapPoints).where(and(eq(trapPoints.userId, userId), eq(trapPoints.campaignId, scopedCampaignId)));
    
    // 2. Eliminar scores del usuario
    await db.delete(userScores).where(and(eq(userScores.userId, userId), eq(userScores.campaignId, scopedCampaignId)));
    
    // 3. Eliminar segmentos del mapa del usuario
    await db.delete(mapSegments).where(and(eq(mapSegments.userId, userId), eq(mapSegments.campaignId, scopedCampaignId)));
    
    // 4. Eliminar premios del usuario
    await db.delete(prizes).where(and(eq(prizes.userId, userId), eq(prizes.campaignId, scopedCampaignId)));
    
    // 5. Finalmente eliminar el usuario
    await db.delete(users).where(and(eq(users.id, userId), eq(users.campaignId, scopedCampaignId)));
  }

  async getSegmentsByUserId(userId: number, campaignId?: number): Promise<MapSegment[]> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    return await db
      .select()
      .from(mapSegments)
      .where(and(eq(mapSegments.userId, userId), eq(mapSegments.campaignId, scopedCampaignId)))
      .orderBy(asc(mapSegments.segmentId));
  }

  async unlockSegment(userId: number, segmentId: number, campaignId?: number): Promise<MapSegment> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    // Verificar si ya existe el segmento para este usuario
    const existingSegment = await db
      .select()
      .from(mapSegments)
      .where(and(
        eq(mapSegments.userId, userId),
        eq(mapSegments.segmentId, segmentId),
        eq(mapSegments.campaignId, scopedCampaignId)
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
          campaignId: scopedCampaignId,
          userId,
          segmentId,
          unlocked: true
        })
        .returning();
      
      return newSegment;
    }
  }

  async getPrizeByUserId(userId: number, campaignId?: number): Promise<Prize | undefined> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [prize] = await db
      .select()
      .from(prizes)
      .where(and(eq(prizes.userId, userId), eq(prizes.campaignId, scopedCampaignId)));
    return prize || undefined;
  }

  async createRedemptionCode(userId: number, campaignId?: number): Promise<string> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    // Buscar premio existente
    let [prize] = await db
      .select()
      .from(prizes)
      .where(and(eq(prizes.userId, userId), eq(prizes.campaignId, scopedCampaignId)));
    
    // Si no existe premio, crear uno nuevo
    if (!prize) {
      [prize] = await db
        .insert(prizes)
        .values({
          campaignId: scopedCampaignId,
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

  async redeemPrize(userId: number, campaignId?: number): Promise<Prize> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [prize] = await db
      .select()
      .from(prizes)
      .where(and(eq(prizes.userId, userId), eq(prizes.campaignId, scopedCampaignId)));
    
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

  async getPrizeByRedemptionCode(code: string, campaignId?: number): Promise<Prize | undefined> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [prize] = await db
      .select()
      .from(prizes)
      .where(and(eq(prizes.redemptionCode, code), eq(prizes.campaignId, scopedCampaignId)));
    return prize || undefined;
  }

  async getAllMapSegmentAssets(campaignId?: number): Promise<MapSegmentAsset[]> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    return await db
      .select()
      .from(mapSegmentAssets)
      .where(eq(mapSegmentAssets.campaignId, scopedCampaignId))
      .orderBy(asc(mapSegmentAssets.segmentId));
  }

  async getMapSegmentAsset(segmentId: number, campaignId?: number): Promise<MapSegmentAsset | undefined> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [asset] = await db
      .select()
      .from(mapSegmentAssets)
      .where(and(eq(mapSegmentAssets.segmentId, segmentId), eq(mapSegmentAssets.campaignId, scopedCampaignId)));
    return asset || undefined;
  }

  async createMapSegmentAsset(asset: InsertMapSegmentAsset, campaignId?: number): Promise<MapSegmentAsset> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [newAsset] = await db
      .insert(mapSegmentAssets)
      .values({ ...asset, campaignId: scopedCampaignId })
      .returning();
    return newAsset;
  }

  async updateMapSegmentAsset(segmentId: number, asset: Partial<InsertMapSegmentAsset>, campaignId?: number): Promise<MapSegmentAsset> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [updatedAsset] = await db
      .update(mapSegmentAssets)
      .set(asset)
      .where(and(eq(mapSegmentAssets.segmentId, segmentId), eq(mapSegmentAssets.campaignId, scopedCampaignId)))
      .returning();
    
    if (!updatedAsset) {
      throw new Error("Asset not found");
    }
    
    return updatedAsset;
  }

  async deleteMapSegmentAsset(segmentId: number, campaignId?: number): Promise<void> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    await db
      .delete(mapSegmentAssets)
      .where(and(eq(mapSegmentAssets.segmentId, segmentId), eq(mapSegmentAssets.campaignId, scopedCampaignId)));
  }
  
  // Trap points operations
  async addTrapPoints(userId: number, segmentId: number, points: number = 1, campaignId?: number): Promise<TrapPoints> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [trapPoint] = await db
      .insert(trapPoints)
      .values({
        campaignId: scopedCampaignId,
        userId,
        segmentId,
        pointsAwarded: points
      })
      .returning();
    
    return trapPoint;
  }

  async getTrapPointsByUserId(userId: number, campaignId?: number): Promise<TrapPoints[]> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    return await db
      .select()
      .from(trapPoints)
      .where(and(eq(trapPoints.userId, userId), eq(trapPoints.campaignId, scopedCampaignId)))
      .orderBy(desc(trapPoints.scannedAt));
  }

  async getTotalTrapPointsByUserId(userId: number, campaignId?: number): Promise<number> {
    const userTrapPoints = await this.getTrapPointsByUserId(userId, campaignId);
    return userTrapPoints.reduce((total, trapPoint) => total + (trapPoint.pointsAwarded || 0), 0);
  }

  async resetAllUserData(campaignId?: number): Promise<void> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    await db.delete(trapPoints).where(eq(trapPoints.campaignId, scopedCampaignId));
    await db.delete(mapSegments).where(eq(mapSegments.campaignId, scopedCampaignId));
    await db.delete(prizes).where(eq(prizes.campaignId, scopedCampaignId));
    await db.delete(users).where(eq(users.campaignId, scopedCampaignId));
  }

  async getSystemConfig(campaignId?: number) {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    try {
      const [config] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.campaignId, scopedCampaignId))
        .limit(1);
      
      if (config) {
        return config;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting system config:', error);
      
      return {
        id: 1,
        campaignId: scopedCampaignId,
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
        scanButtonEnabled: true,
        scanButtonText: '¡Escanea aquí!',
        helpButtonText: 'Ayuda',
        siteMapButtonText: 'Mapa del Sitio',
        prizeButtonText: 'Ver Código Premio',
        completionTitle: '¡Felicidades, has completado el reto!',
        completionRewardHeadline: '¡Reto completado!',
        completionRewardDescription: 'Con el siguiente código puedes reclamar tu premio.',
        completionCodeSectionTitle: 'Código de Redención',
        completionCodeLabel: 'Código de validación',
        completionCodeHelpText: 'Muestra este código para reclamar tu premio',
        completionCloseButtonText: 'Cerrar',
        completionSaveButtonText: 'Guardar Premio',
        completionShowBrain: true,
        completionShowQr: true,
        completionShowCode: true,
        completionShowSaveButton: true,
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
    scanButtonEnabled?: boolean;
    scanButtonText?: string;
    helpButtonText?: string;
    siteMapButtonText?: string;
    prizeButtonText?: string;
    completionTitle?: string;
    completionRewardHeadline?: string;
    completionRewardDescription?: string;
    completionCodeSectionTitle?: string;
    completionCodeLabel?: string;
    completionCodeHelpText?: string;
    completionCloseButtonText?: string;
    completionSaveButtonText?: string;
    completionShowBrain?: boolean;
    completionShowQr?: boolean;
    completionShowCode?: boolean;
    completionShowSaveButton?: boolean;
    loadingText?: string;
  }, campaignId?: number): Promise<SystemConfig> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    try {
      const bodyValidated = insertSystemConfigSchema.parse(configData);
      const validatedData = { ...bodyValidated, campaignId: scopedCampaignId };
      
      const existingConfig = await this.getSystemConfig(scopedCampaignId);
      
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

  async listUploadedAssets(campaignId?: number): Promise<UploadedAsset[]> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    return await db
      .select()
      .from(uploadedAssets)
      .where(eq(uploadedAssets.campaignId, scopedCampaignId))
      .orderBy(desc(uploadedAssets.createdAt));
  }

  async createUploadedAsset(asset: InsertUploadedAsset, campaignId?: number): Promise<UploadedAsset> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [created] = await db
      .insert(uploadedAssets)
      .values({ ...asset, campaignId: scopedCampaignId })
      .returning();

    return created;
  }

  async deleteUploadedAsset(id: number, campaignId?: number): Promise<void> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [asset] = await db
      .select()
      .from(uploadedAssets)
      .where(and(eq(uploadedAssets.id, id), eq(uploadedAssets.campaignId, scopedCampaignId)))
      .limit(1);

    if (!asset) return;

    await db.delete(uploadedAssets).where(and(eq(uploadedAssets.id, id), eq(uploadedAssets.campaignId, scopedCampaignId)));

    // Try to delete the physical file too (best-effort; DB delete shouldn't fail).
    try {
      const filePath = path.join(UPLOADS_DIR, asset.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Error deleting uploaded asset file:", err);
    }
  }
  
  async getAllUsersWithProgress(campaignId?: number): Promise<Array<{
    user: User;
    segments: MapSegment[];
    totalSegments: number;
    unlockedSegments: number;
    completionPercentage: number;
    prize: Prize | null;
  }>> {
    const result = [];
    
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    // Get all valid (non-trap) segment assets to calculate actual total segments
    const allAssets = await this.getAllMapSegmentAssets(scopedCampaignId);
    const validAssets = allAssets.filter(asset => !asset.isTrap);
    const totalSegments = validAssets.length;
    const validSegmentIds = validAssets.map(asset => asset.segmentId);
    
    const allUsers = await db.select().from(users).where(eq(users.campaignId, scopedCampaignId));
    
    for (const user of allUsers) {
      const segments = await this.getSegmentsByUserId(user.id, scopedCampaignId);
      // Only count unlocked segments that correspond to valid (non-trap) assets
      const unlockedSegments = segments.filter(s => 
        s.unlocked && validSegmentIds.includes(s.segmentId)
      ).length;
      const completionPercentage = totalSegments > 0 ? (unlockedSegments / totalSegments) * 100 : 0;
      const prize = await this.getPrizeByUserId(user.id, scopedCampaignId);
      
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
  async getAllVenues(campaignId?: number): Promise<Venue[]> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    return await db.select().from(venues).where(eq(venues.campaignId, scopedCampaignId)).orderBy(asc(venues.name));
  }

  async getVenueById(id: number, campaignId?: number): Promise<Venue | undefined> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [venue] = await db.select().from(venues).where(and(eq(venues.id, id), eq(venues.campaignId, scopedCampaignId)));
    return venue;
  }

  async createVenue(venue: InsertVenue, campaignId?: number): Promise<Venue> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [newVenue] = await db.insert(venues).values({ ...venue, campaignId: scopedCampaignId }).returning();
    return newVenue;
  }

  async updateVenue(id: number, venue: Partial<InsertVenue>, campaignId?: number): Promise<Venue> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [updatedVenue] = await db
      .update(venues)
      .set({ ...venue, updatedAt: new Date() })
      .where(and(eq(venues.id, id), eq(venues.campaignId, scopedCampaignId)))
      .returning();
    
    if (!updatedVenue) {
      throw new Error(`Venue with id ${id} not found`);
    }
    
    return updatedVenue;
  }

  async deleteVenue(id: number, campaignId?: number): Promise<void> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    await db.delete(venues).where(and(eq(venues.id, id), eq(venues.campaignId, scopedCampaignId)));
  }

  // Venue-specific ranking operations
  async getVenueRanking(venueId: number, campaignId?: number): Promise<Array<{
    user: User;
    completionPercentage: number;
    totalSegments: number;
    unlockedSegments: number;
    position: number;
    score: number;
    trapPenalties: number;
  }>> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [venueRow] = await db
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.id, venueId), eq(venues.campaignId, scopedCampaignId)))
      .limit(1);
    if (!venueRow) {
      return [];
    }
    const result = [];
    
    const config = await this.getSystemConfig(scopedCampaignId);
    let totalSegments = 9;
    
    if (config && config.mapGridSize) {
      const [columns, rows] = config.mapGridSize.split('x').map(Number);
      totalSegments = columns * rows;
    }
    
    // Get users from specific venue
    const venueUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.venueId, venueId), eq(users.campaignId, scopedCampaignId)));
    
    for (const user of venueUsers) {
      const segments = await this.getSegmentsByUserId(user.id, scopedCampaignId);
      const unlockedSegments = segments.filter(s => s.unlocked).length;
      const completionPercentage = (unlockedSegments / totalSegments) * 100;
      
      // Calculate trap penalties
      const trapPointsRecords = await this.getTrapPointsByUserId(user.id, scopedCampaignId);
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
  async addUserScore(userId: number, segmentId: number, points: number, isTrap: boolean, campaignId?: number): Promise<UserScores> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [score] = await db
      .insert(userScores)
      .values({
        campaignId: scopedCampaignId,
        userId,
        segmentId,
        points,
        isTrap
      })
      .returning();
    
    return score;
  }

  async getUserScores(userId: number, campaignId?: number): Promise<UserScores[]> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    return await db
      .select()
      .from(userScores)
      .where(and(eq(userScores.userId, userId), eq(userScores.campaignId, scopedCampaignId)))
      .orderBy(asc(userScores.scannedAt));
  }

  async getUserScoreBySegment(userId: number, segmentId: number, campaignId?: number): Promise<UserScores | undefined> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [score] = await db
      .select()
      .from(userScores)
      .where(and(
        eq(userScores.userId, userId),
        eq(userScores.segmentId, segmentId),
        eq(userScores.campaignId, scopedCampaignId)
      ));
    
    return score;
  }

  async calculateTotalScore(userId: number, campaignId?: number): Promise<number> {
    const scores = await this.getUserScores(userId, campaignId);
    return scores.reduce((total, score) => total + score.points, 0);
  }

  async getVenueScoreRanking(venueId: number, campaignId?: number): Promise<Array<{
    user: User;
    validQRsScanned: number;
    trapQRsScanned: number;
    totalScore: number;
    position: number;
  }>> {
    const scopedCampaignId = await this.resolveCampaignId(campaignId);
    const [venueRow] = await db
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.id, venueId), eq(venues.campaignId, scopedCampaignId)))
      .limit(1);
    if (!venueRow) {
      return [];
    }
    const result = [];
    
    // Get users from specific venue
    const venueUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.venueId, venueId), eq(users.campaignId, scopedCampaignId)));
    
    for (const user of venueUsers) {
      const scores = await this.getUserScores(user.id, scopedCampaignId);
      
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