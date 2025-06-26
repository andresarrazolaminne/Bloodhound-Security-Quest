import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// System configuration table
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  instructionsText: text("instructions_text").notNull(),
  siteMapImageUrl: text("site_map_image_url").notNull(),
  footerLogoUrl: text("footer_logo_url").notNull().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Pata_de_logos_negro.png'),
  cobrandingImageUrl: text("cobranding_image_url").notNull().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Cobranding_actualizado.png'),
  mapGapSize: text("map_gap_size").notNull().default('medium'),
  mapGridSize: text("map_grid_size").notNull().default('3x3'),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Schema for system configuration
export const systemConfigSchema = z.object({
  id: z.number(),
  instructionsText: z.string(),
  siteMapImageUrl: z.string(),
  footerLogoUrl: z.string().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Pata_de_logos_negro.png'),
  cobrandingImageUrl: z.string().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Cobranding_actualizado.png'),
  mapGapSize: z.enum(['none', 'x-small', 'small', 'medium', 'large']).default('medium'),
  mapGridSize: z.enum(['3x3', '3x2', '2x3', '4x2', '2x4']).default('3x3'),
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
  completedAt: timestamp("completed_at"),
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
  isTrap: boolean("is_trap").default(false), // Campo para indicar si es un QR trampa
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tabla para rastrear puntos falsos de usuarios
export const trapPoints = pgTable("trap_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  segmentId: integer("segment_id").notNull(),
  pointsAwarded: integer("points_awarded").default(1), // Puntos falsos otorgados
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  documentNumber: true,
  name: true,
  completedAt: true,
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
  isTrap: true,
});

export const insertTrapPointsSchema = createInsertSchema(trapPoints).pick({
  userId: true,
  segmentId: true,
  pointsAwarded: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMapSegment = z.infer<typeof insertMapSegmentSchema>;
export type MapSegment = typeof mapSegments.$inferSelect;

export type InsertPrize = z.infer<typeof insertPrizeSchema>;
export type Prize = typeof prizes.$inferSelect;

export type InsertMapSegmentAsset = z.infer<typeof insertMapSegmentAssetsSchema>;
export type MapSegmentAsset = typeof mapSegmentAssets.$inferSelect;

export type InsertTrapPoints = z.infer<typeof insertTrapPointsSchema>;
export type TrapPoints = typeof trapPoints.$inferSelect;
