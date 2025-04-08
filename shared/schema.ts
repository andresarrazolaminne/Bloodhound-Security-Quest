import { pgTable, text, serial, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  redeemedAt: text("redeemed_at"),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMapSegment = z.infer<typeof insertMapSegmentSchema>;
export type MapSegment = typeof mapSegments.$inferSelect;

export type InsertPrize = z.infer<typeof insertPrizeSchema>;
export type Prize = typeof prizes.$inferSelect;
