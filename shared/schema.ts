import { pgTable, text, serial, integer, boolean, json, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// System configuration table
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  instructionsText: text("instructions_text").notNull(),
  siteMapImageUrl: text("site_map_image_url").notNull(),
  footerLogoUrl: text("footer_logo_url").notNull().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Pata_de_logos_negro.png'),
  cobrandingImageUrl: text("cobranding_image_url").notNull().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Cobranding_actualizado.png'),
  mapGapSize: text("map_gap_size").notNull().default('medium'),
  mapGridSize: text("map_grid_size").notNull().default('3x3'),
  // Frontend customization fields
  appTitle: text("app_title").notNull().default('Lanzamiento 2025'),
  backgroundImageUrl: text("background_image_url").notNull().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png'),
  backgroundSize: text("background_size").notNull().default('auto'),
  backgroundRepeat: text("background_repeat").notNull().default('repeat'),
  backgroundPosition: text("background_position").notNull().default('center'),
  gradientStartColor: text("gradient_start_color").notNull().default('#bb2558'),
  gradientEndColor: text("gradient_end_color").notNull().default('#e8cf00'),
  gradientMidColor: text("gradient_mid_color"),
  gradientDirection: text("gradient_direction").notNull().default('175deg'),
  gradientType: text("gradient_type").notNull().default('linear'),
  // Text colors configuration
  primaryTextColor: text("primary_text_color").notNull().default('#1a1a1a'),
  secondaryTextColor: text("secondary_text_color").notNull().default('#6b7280'),
  titleTextColor: text("title_text_color").notNull().default('#111827'),
  buttonTextColor: text("button_text_color").notNull().default('#ffffff'),
  linkTextColor: text("link_text_color").notNull().default('#3b82f6'),
  successTextColor: text("success_text_color").notNull().default('#059669'),
  errorTextColor: text("error_text_color").notNull().default('#dc2626'),
  warningTextColor: text("warning_text_color").notNull().default('#d97706'),
  // UI component colors
  headerBackgroundColor: text("header_background_color").notNull().default('#3b82f6'),
  headerTextColor: text("header_text_color").notNull().default('#ffffff'),
  progressTextColor: text("progress_text_color").notNull().default('#ffffff'),
  // Login page customization
  loginTitle: text("login_title").notNull().default('Lanzamiento'),
  loginSubtitle: text("login_subtitle").notNull().default('2025'),
  loginWelcomeText: text("login_welcome_text").notNull().default('Bienvenido al reto de identificación de riesgos'),
  loginButtonText: text("login_button_text").notNull().default('Ingresar'),
  loginDocumentLabel: text("login_document_label").notNull().default('Número de documento'),
  loginNameLabel: text("login_name_label").notNull().default('Nombre completo'),
  // Image management system - organized by usage type
  loginLogoImageUrl: text("login_logo_image_url").notNull().default(''),
  registrationImageUrl: text("registration_image_url").notNull().default(''),
  headerLogoImageUrl: text("header_logo_image_url").notNull().default(''),
  headerLogoSize: integer("header_logo_size").notNull().default(32), // Size in pixels (height)
  preloadImageUrl: text("preload_image_url").notNull().default(''),
  scanButtonEnabled: boolean("scan_button_enabled").notNull().default(true),
  scanButtonText: text("scan_button_text").notNull().default('¡Escanea aquí!'),
  helpButtonText: text("help_button_text").notNull().default('Ayuda'),
  siteMapButtonText: text("site_map_button_text").notNull().default('Mapa del Sitio'),
  prizeButtonText: text("prize_button_text").notNull().default('Ver Código Premio'),
  completionTitle: text("completion_title").notNull().default('¡Felicidades, has completado el reto!'),
  completionRewardHeadline: text("completion_reward_headline").notNull().default('¡Reto completado!'),
  completionRewardDescription: text("completion_reward_description").notNull().default('Con el siguiente código puedes reclamar tu premio.'),
  completionCodeSectionTitle: text("completion_code_section_title").notNull().default('Código de Redención'),
  completionCodeLabel: text("completion_code_label").notNull().default('Código de validación'),
  completionCodeHelpText: text("completion_code_help_text").notNull().default('Muestra este código para reclamar tu premio'),
  completionCloseButtonText: text("completion_close_button_text").notNull().default('Cerrar'),
  completionSaveButtonText: text("completion_save_button_text").notNull().default('Guardar Premio'),
  completionShowBrain: boolean("completion_show_brain").notNull().default(true),
  completionShowQr: boolean("completion_show_qr").notNull().default(true),
  completionShowCode: boolean("completion_show_code").notNull().default(true),
  completionShowSaveButton: boolean("completion_show_save_button").notNull().default(true),
  loadingText: text("loading_text").notNull().default('Cargando tu mapa...'),
  // Mensajes de logros y trampas
  achievementUnlockedTitle: text("achievement_unlocked_title").notNull().default('¡Logro Desbloqueado!'),
  achievementUnlockedMessage: text("achievement_unlocked_message").notNull().default('¡Segmento {segmentId} desbloqueado exitosamente!'),
  trapDetectedTitle: text("trap_detected_title").notNull().default('¡Situación de Riesgo Detectada!'),
  trapDetectedMessage: text("trap_detected_message").notNull().default('¡Has identificado una situación de riesgo! +{trapPoints} punto(s) de penalización.'),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Uploaded assets (logos, background, etc.)
export const uploadedAssets = pgTable("uploaded_assets", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  publicUrl: text("public_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUploadedAssetsSchema = createInsertSchema(uploadedAssets).pick({
  filename: true,
  originalName: true,
  mime: true,
  size: true,
  publicUrl: true,
});

export type InsertUploadedAsset = z.infer<typeof insertUploadedAssetsSchema>;
export type UploadedAsset = typeof uploadedAssets.$inferSelect;

// Venues/Sedes table
export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  isActive: boolean("is_active").notNull().default(true),
  maxParticipants: integer("max_participants"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Schema for system configuration
export const systemConfigSchema = z.object({
  id: z.number(),
  campaignId: z.number(),
  instructionsText: z.string().default(""),
  siteMapImageUrl: z.string().default(""),
  footerLogoUrl: z.string().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Pata_de_logos_negro.png'),
  cobrandingImageUrl: z.string().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Cobranding_actualizado.png'),
  mapGapSize: z.enum(['none', 'x-small', 'small', 'medium', 'large']).default('medium'),
  mapGridSize: z.enum(['3x3', '3x2', '2x3', '4x2', '2x4']).default('3x3'),
  // Frontend customization fields
  appTitle: z.string().default('Lanzamiento 2025'),
  backgroundImageUrl: z.string().default('https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png'),
  // Incluye "100% 100%" usado en Admin (Estirar); es CSS válido para background-size.
  backgroundSize: z
    .enum(['auto', 'cover', 'contain', '100%', '50%', '100% 100%'])
    .default('auto'),
  backgroundRepeat: z.enum(['repeat', 'no-repeat', 'repeat-x', 'repeat-y']).default('repeat'),
  backgroundPosition: z.enum(['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']).default('center'),
  gradientStartColor: z.string().default('#bb2558'),
  gradientEndColor: z.string().default('#e8cf00'),
  /** null desde JSON/BD se normaliza antes del parse; aquí aceptamos ausencia. */
  gradientMidColor: z.string().nullish(),
  gradientDirection: z.string().default('175deg'),
  gradientType: z.enum(['linear', 'radial']).default('linear'),
  // Text colors configuration
  primaryTextColor: z.string().default('#1a1a1a'),
  secondaryTextColor: z.string().default('#6b7280'),
  titleTextColor: z.string().default('#111827'),
  buttonTextColor: z.string().default('#ffffff'),
  linkTextColor: z.string().default('#3b82f6'),
  successTextColor: z.string().default('#059669'),
  errorTextColor: z.string().default('#dc2626'),
  warningTextColor: z.string().default('#d97706'),
  // UI component colors
  headerBackgroundColor: z.string().default('#3b82f6'),
  headerTextColor: z.string().default('#ffffff'),
  progressTextColor: z.string().default('#ffffff'),
  // Login page customization
  loginTitle: z.string().default('Lanzamiento'),
  loginSubtitle: z.string().default('2025'),
  loginWelcomeText: z.string().default('Bienvenido al reto de identificación de riesgos'),
  loginButtonText: z.string().default('Ingresar'),
  loginDocumentLabel: z.string().default('Número de documento'),
  loginNameLabel: z.string().default('Nombre completo'),
  loginLogoImageUrl: z.string().default(''),
  registrationImageUrl: z.string().default(''),
  headerLogoImageUrl: z.string().default(''),
  headerLogoSize: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return 32;
    const n = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(n)) return 32;
    return Math.min(128, Math.max(16, Math.round(n)));
  }, z.number()),
  preloadImageUrl: z.string().default(''),
  scanButtonEnabled: z.boolean().default(true),
  scanButtonText: z.string().default('¡Escanea aquí!'),
  helpButtonText: z.string().default('Ayuda'),
  siteMapButtonText: z.string().default('Mapa del Sitio'),
  prizeButtonText: z.string().default('Ver Código Premio'),
  completionTitle: z.string().default('¡Felicidades, has completado el reto!'),
  completionRewardHeadline: z.string().default('¡Reto completado!'),
  completionRewardDescription: z.string().default('Con el siguiente código puedes reclamar tu premio.'),
  completionCodeSectionTitle: z.string().default('Código de Redención'),
  completionCodeLabel: z.string().default('Código de validación'),
  completionCodeHelpText: z.string().default('Muestra este código para reclamar tu premio'),
  completionCloseButtonText: z.string().default('Cerrar'),
  completionSaveButtonText: z.string().default('Guardar Premio'),
  completionShowBrain: z.boolean().default(true),
  completionShowQr: z.boolean().default(true),
  completionShowCode: z.boolean().default(true),
  completionShowSaveButton: z.boolean().default(true),
  loadingText: z.string().default('Cargando tu mapa...'),
  // Mensajes de logros y trampas
  achievementUnlockedTitle: z.string().default('¡Logro Desbloqueado!'),
  achievementUnlockedMessage: z.string().default('¡Segmento {segmentId} desbloqueado exitosamente!'),
  trapDetectedTitle: z.string().default('¡Situación de Riesgo Detectada!'),
  trapDetectedMessage: z.string().default('¡Has identificado una situación de riesgo! +{trapPoints} punto(s) de penalización.'),
  updatedAt: z.date()
});

export type SystemConfig = z.infer<typeof systemConfigSchema>;

const MAP_GAP_ALLOWED = new Set(["none", "x-small", "small", "medium", "large"]);
const MAP_GRID_ALLOWED = new Set(["3x3", "3x2", "2x3", "4x2", "2x4"]);
const BG_SIZE_ALLOWED = new Set(["auto", "cover", "contain", "100%", "50%", "100% 100%"]);
const BG_REPEAT_ALLOWED = new Set(["repeat", "no-repeat", "repeat-x", "repeat-y"]);
const BG_POSITION_ALLOWED = new Set([
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
]);
const GRADIENT_TYPE_ALLOWED = new Set(["linear", "radial"]);

/**
 * Normaliza el JSON del panel admin antes de Zod: quita `null` (Zod no aplica .default() con null),
 * y corrige enums desfasados respecto a la BD o a versiones viejas del UI.
 */
export function sanitizeAdminSystemConfigBody(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const o = { ...(input as Record<string, unknown>) };

  for (const key of Object.keys(o)) {
    if (o[key] === null) delete o[key];
  }

  if (typeof o.mapGapSize === "string" && !MAP_GAP_ALLOWED.has(o.mapGapSize)) {
    o.mapGapSize = "medium";
  }
  if (typeof o.mapGridSize === "string" && !MAP_GRID_ALLOWED.has(o.mapGridSize)) {
    o.mapGridSize = "3x3";
  }
  if (typeof o.backgroundSize === "string" && !BG_SIZE_ALLOWED.has(o.backgroundSize)) {
    o.backgroundSize = "auto";
  }
  if (typeof o.backgroundRepeat === "string" && !BG_REPEAT_ALLOWED.has(o.backgroundRepeat)) {
    o.backgroundRepeat = "repeat";
  }
  if (typeof o.backgroundPosition === "string" && !BG_POSITION_ALLOWED.has(o.backgroundPosition)) {
    o.backgroundPosition = "center";
  }
  if (typeof o.gradientType === "string" && !GRADIENT_TYPE_ALLOWED.has(o.gradientType)) {
    o.gradientType = "linear";
  }

  return o;
}

const insertSystemConfigSchemaInner = systemConfigSchema.omit({
  id: true,
  updatedAt: true,
  campaignId: true,
});

/** Payload de API / insert: sin id, updatedAt ni campaignId (campaignId lo fija el scope del request). */
export const insertSystemConfigSchema = z.preprocess(
  sanitizeAdminSystemConfigBody,
  insertSystemConfigSchemaInner,
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  documentNumber: text("document_number").notNull(),
  name: text("name").notNull(),
  venueId: integer("venue_id").references(() => venues.id),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  usersCampaignDocumentUnique: uniqueIndex("users_campaign_document_unique").on(table.campaignId, table.documentNumber),
}));

export const mapSegments = pgTable("map_segments", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  userId: integer("user_id").notNull(),
  segmentId: integer("segment_id").notNull(),
  unlocked: boolean("unlocked").default(false),
});

export const prizes = pgTable("prizes", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  userId: integer("user_id").notNull(),
  redeemed: boolean("redeemed").default(false),
  redemptionCode: text("redemption_code"),
  redeemedAt: timestamp("redeemed_at"),
});

// Tabla para gestionar las configuraciones de los segmentos del mapa
export const mapSegmentAssets = pgTable("map_segment_assets", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  segmentId: integer("segment_id").notNull(),
  imageUrl: text("image_url").notNull(),
  redirectUrl: text("redirect_url"),
  title: text("title").notNull().default(""),
  description: text("description"),
  securityCode: text("security_code").notNull().default(""), // Nuevo campo para código de seguridad
  isTrap: boolean("is_trap").default(false), // Campo para indicar si es un QR trampa
  trapMessage: text("trap_message"), // Mensaje HTML personalizable para QR trampa
  modalContent: text("modal_content"), // Contenido HTML opcional para modal al desbloquear
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  mapSegmentCampaignSegmentUnique: uniqueIndex("map_segment_campaign_segment_unique").on(table.campaignId, table.segmentId),
}));

// Tabla para rastrear puntos falsos de usuarios
export const trapPoints = pgTable("trap_points", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  userId: integer("user_id").notNull(),
  segmentId: integer("segment_id").notNull(),
  pointsAwarded: integer("points_awarded").default(1), // Puntos falsos otorgados
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
});

// New table for user scores tracking
export const userScores = pgTable("user_scores", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  userId: integer("user_id").notNull().references(() => users.id),
  segmentId: integer("segment_id").notNull(),
  points: integer("points").notNull(), // +10 for valid QR, -5 for trap QR
  isTrap: boolean("is_trap").notNull().default(false),
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  documentNumber: true,
  name: true,
  venueId: true,
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
  trapMessage: true,
  modalContent: true,
});

export const insertTrapPointsSchema = createInsertSchema(trapPoints).pick({
  userId: true,
  segmentId: true,
  pointsAwarded: true,
});

export const insertUserScoresSchema = createInsertSchema(userScores).pick({
  userId: true,
  segmentId: true,
  points: true,
  isTrap: true,
});

export const insertVenueSchema = createInsertSchema(venues).pick({
  name: true,
  description: true,
  location: true,
  isActive: true,
  maxParticipants: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertCampaignSchema = createInsertSchema(campaigns).pick({
  slug: true,
  name: true,
  isActive: true,
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertVenue = z.infer<typeof insertVenueSchema>;
export type Venue = typeof venues.$inferSelect;

export type InsertMapSegment = z.infer<typeof insertMapSegmentSchema>;
export type MapSegment = typeof mapSegments.$inferSelect;

export type InsertPrize = z.infer<typeof insertPrizeSchema>;
export type Prize = typeof prizes.$inferSelect;

export type InsertMapSegmentAsset = z.infer<typeof insertMapSegmentAssetsSchema>;
export type MapSegmentAsset = typeof mapSegmentAssets.$inferSelect;

export type InsertTrapPoints = z.infer<typeof insertTrapPointsSchema>;
export type TrapPoints = typeof trapPoints.$inferSelect;

export type InsertUserScores = z.infer<typeof insertUserScoresSchema>;
export type UserScores = typeof userScores.$inferSelect;
