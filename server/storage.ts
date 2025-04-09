import { 
  users, 
  mapSegments, 
  prizes,
  mapSegmentAssets,
  type User, 
  type InsertUser, 
  type MapSegment, 
  type InsertMapSegment,
  type Prize,
  type InsertPrize,
  type MapSegmentAsset,
  type InsertMapSegmentAsset,
  systemConfig as systemConfigTable
} from "@shared/schema";
import { nanoid } from "nanoid";

export interface IStorage {
  // User operations
  getUserByDocumentNumber(documentNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Map segment operations
  getSegmentsByUserId(userId: number): Promise<MapSegment[]>;
  unlockSegment(userId: number, segmentId: number): Promise<MapSegment>;

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
}

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
    const user: User = { ...insertUser, id };
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
      throw new Error("User prize record not found");
    }

    const redemptionCode = nanoid(10); // Generate a random code
    prize.redemptionCode = redemptionCode;
    this.prizes.set(userId, prize);
    this.redemptionCodes.set(redemptionCode, userId);

    return redemptionCode;
  }

  async redeemPrize(userId: number): Promise<Prize> {
    const prize = this.prizes.get(userId);
    if (!prize) {
      throw new Error("User prize record not found");
    }

    prize.redeemed = true;
    prize.redeemedAt = new Date().toISOString();
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
      ...asset,
      updatedAt: new Date()
    };

    this.mapAssets.set(asset.segmentId, newAsset);
    return newAsset;
  }

  async updateMapSegmentAsset(segmentId: number, asset: Partial<InsertMapSegmentAsset>): Promise<MapSegmentAsset> {
    const existingAsset = this.mapAssets.get(segmentId);
    if (!existingAsset) {
      throw new Error("Map segment asset not found");
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
}

// Database storage implementation
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUserByDocumentNumber(documentNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.documentNumber, documentNumber));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();

    // Create empty segments for the user
    const segmentsToCreate = Array.from({ length: 9 }, (_, i) => ({
      userId: user.id,
      segmentId: i + 1,
      unlocked: false
    }));

    await db.insert(mapSegments).values(segmentsToCreate);

    // Create an empty prize for the user
    await db.insert(prizes).values({
      userId: user.id,
      redeemed: false,
      redemptionCode: null,
      redeemedAt: null
    });

    return user;
  }

  async getSegmentsByUserId(userId: number): Promise<MapSegment[]> {
    return await db.select().from(mapSegments).where(eq(mapSegments.userId, userId));
  }

  async unlockSegment(userId: number, segmentId: number): Promise<MapSegment> {
    const [segment] = await db
      .update(mapSegments)
      .set({ unlocked: true })
      .where(
        sql`${mapSegments.userId} = ${userId} AND ${mapSegments.segmentId} = ${segmentId}`
      )
      .returning();

    return segment;
  }

  async getPrizeByUserId(userId: number): Promise<Prize | undefined> {
    const [prize] = await db.select().from(prizes).where(eq(prizes.userId, userId));
    return prize || undefined;
  }

  async createRedemptionCode(userId: number): Promise<string> {
    // Create a unique redemption code
    const redemptionCode = nanoid(10).toUpperCase();

    // Store it with the prize
    await db
      .update(prizes)
      .set({ redemptionCode })
      .where(eq(prizes.userId, userId));

    return redemptionCode;
  }

  async redeemPrize(userId: number): Promise<Prize> {
    const now = new Date();

    const [prize] = await db
      .update(prizes)
      .set({ 
        redeemed: true,
        redeemedAt: now
      })
      .where(eq(prizes.userId, userId))
      .returning();

    return prize;
  }

  async getPrizeByRedemptionCode(code: string): Promise<Prize | undefined> {
    const [prize] = await db
      .select()
      .from(prizes)
      .where(eq(prizes.redemptionCode, code));

    return prize || undefined;
  }

  // Map segment assets operations (for admin dashboard)
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

    return asset || undefined;
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

  // System Configuration
  async getSystemConfig() {
    const configs = await db.select().from(systemConfigTable);
    return configs[0] || {
      instructionsText: "Bienvenido a nuestra aplicación. Sigue las instrucciones para participar.",
      siteMapImageUrl: "https://placehold.co/1200x800/e2e8f0/64748b?text=Mapa+del+Sitio"
    };
  }

  async updateSystemConfig(configData: {
    instructionsText: string;
    siteMapImageUrl: string;
  }) {
    const configs = await db.select().from(systemConfigTable);

    if (configs.length === 0) {
      return db.insert(systemConfigTable).values({
        ...configData,
        updatedAt: new Date()
      }).returning();
    }

    return db.update(systemConfigTable)
      .set({
        ...configData,
        updatedAt: new Date()
      })
      .returning();
  }
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();