import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Esquema para la configuración del sistema
export const systemConfigSchema = z.object({
  id: z.number(),
  instructionsText: z.string(),
  siteMapImageUrl: z.string(),
  updatedAt: z.date()
});

export type SystemConfig = z.infer<typeof systemConfigSchema>;

export const insertSystemConfigSchema = systemConfigSchema.omit({ 
  id: true,
  updatedAt: true 
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  documentNumber: text("document_number").notNull().unique(),
  name: text("name").notNull(),
});

export const mapSegments = pgTable("map_segments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  segmentId: integer("segment_id").notNull(),
  unlocked: boolean("unlocked").default(false),
});

export const prizes = pgTable("prizes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  redeemed: boolean("redeemed").default(false),
  redemptionCode: text("redemption_code"),
  redeemedAt: timestamp("redeemed_at"),
});

// Tabla para gestionar las configuraciones de los segmentos del mapa
export const mapSegmentAssets = pgTable("map_segment_assets", {
  id: serial("id").primaryKey(),
  segmentId: integer("segment_id").notNull().unique(),
  imageUrl: text("image_url").notNull(),
  redirectUrl: text("redirect_url"),
  title: text("title").notNull().default(""),
  description: text("description"),
  securityCode: text("security_code").notNull().default(""), // Nuevo campo para código de seguridad
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  documentNumber: true,
  name: true,
});

export const insertMapSegmentSchema = createInsertSchema(mapSegments).pick({
  userId: true,
  segmentId: true,
  unlocked: true,
});

export const insertPrizeSchema = createInsertSchema(prizes).pick({
  userId: true,
  redeemed: true,
  redemptionCode: true,
  redeemedAt: true,
});

export const insertMapSegmentAssetsSchema = createInsertSchema(mapSegmentAssets).pick({
  segmentId: true,
  imageUrl: true,
  redirectUrl: true,
  title: true,
  description: true,
  securityCode: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMapSegment = z.infer<typeof insertMapSegmentSchema>;
export type MapSegment = typeof mapSegments.$inferSelect;

export type InsertPrize = z.infer<typeof insertPrizeSchema>;
export type Prize = typeof prizes.$inferSelect;

export type InsertMapSegmentAsset = z.infer<typeof insertMapSegmentAssetsSchema>;
export type MapSegmentAsset = typeof mapSegmentAssets.$inferSelect;
