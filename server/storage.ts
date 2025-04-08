import { 
  users, 
  mapSegments, 
  prizes,
  type User, 
  type InsertUser, 
  type MapSegment, 
  type InsertMapSegment,
  type Prize,
  type InsertPrize
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private segments: Map<number, MapSegment[]>;
  private prizes: Map<number, Prize>;
  private redemptionCodes: Map<string, number>; // redemptionCode -> userId
  private currentUserId: number;
  private currentSegmentId: number;
  private currentPrizeId: number;

  constructor() {
    this.users = new Map();
    this.segments = new Map();
    this.prizes = new Map();
    this.redemptionCodes = new Map();
    this.currentUserId = 1;
    this.currentSegmentId = 1;
    this.currentPrizeId = 1;
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
}

export const storage = new MemStorage();
