import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertMapSegmentAssetsSchema, insertSystemConfigSchema, insertVenueSchema, users } from "@shared/schema";
import { db, verifyMultitenantSchema } from "./db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import multer from "multer";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/usr/share/nginx/html/bloodhound/uploads";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "admin123";

type CampaignRequest = express.Request & {
  campaignId?: number;
  campaignSlug?: string;
};

/** Recorre err y err.cause (Drizzle/pg envuelven el error de Postgres). */
function forEachErrorCause(err: unknown, visitor: (e: unknown) => void): void {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current !== undefined && current !== null) {
    if (typeof current === "object" || typeof current === "function") {
      if (seen.has(current)) break;
      seen.add(current);
    }
    visitor(current);
    const next =
      current && typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : undefined;
    if (next === undefined) break;
    current = next;
  }
}

function isMissingCampaignsTableError(err: unknown): boolean {
  let missing = false;
  forEachErrorCause(err, (e) => {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    const msg =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
    const m = msg.toLowerCase();
    if (code === "42P01") missing = true;
    if (m.includes("does not exist") && m.includes("campaign")) missing = true;
  });
  return missing;
}

/** Primer error con código PostgreSQL de 5 caracteres (p. ej. 42P01, 42703). */
function extractPostgresError(err: unknown): { code: string; message: string } | null {
  let best: { code: string; message: string } | null = null;
  forEachErrorCause(err, (e) => {
    if (!e || typeof e !== "object") return;
    const code = "code" in e ? String((e as { code: unknown }).code) : "";
    const msg =
      e instanceof Error
        ? e.message
        : "message" in e
          ? String((e as { message: unknown }).message)
          : "";
    if (/^[0-9A-Z]{5}$/.test(code) && msg.length > 0) {
      best = { code, message: msg };
    }
  });
  return best;
}

// Función para generar un código de seguridad alfanumérico aleatorio
function generateSecurityCode(length: number = 5): string {
  // Limitamos a caracteres alfanuméricos fáciles de leer (evitamos 0, O, 1, I, etc)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Sin prefijo de campaña: health y CRUD de listado/creación de campañas (antes del tenant). */
function shouldSkipCampaignTenantResolution(req: express.Request): boolean {
  const p = req.path ?? "";
  if (p === "/health" || p.startsWith("/admin/campaigns")) return true;
  const noQuery = (req.originalUrl ?? req.url ?? "").split("?")[0];
  if (noQuery.endsWith("/api/health") || noQuery.includes("/api/admin/campaigns")) return true;
  return false;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes (mismo router en /api y, si existe, /{VITE_BASE_PATH}/api para coincidir con el cliente)
  const apiRouter = express.Router();
  const mounts = new Set<string>(["/api"]);
  const uiBase = process.env.VITE_BASE_PATH?.trim();
  if (uiBase && uiBase !== "/" && uiBase !== "") {
    mounts.add(`${uiBase.replace(/\/+$/, "")}/api`);
  }
  Array.from(mounts).forEach((mount) => {
    app.use(mount, apiRouter);
  });

  apiRouter.use(async (req, res, next) => {
    if (shouldSkipCampaignTenantResolution(req)) return next();
    try {
      const requestedSlug = String(req.header("x-campaign-slug") || req.query.campaignSlug || "").trim();
      const slug = requestedSlug || process.env.DEFAULT_CAMPAIGN_SLUG || "default";
      const campaign = await storage.ensureCampaignBySlug(slug, slug === "default" ? "Default Campaign" : slug);
      const adminToken = req.header("x-admin-auth");
      const isAdminRequest = Boolean(adminToken) && adminToken === ADMIN_API_TOKEN;
      if (!campaign.isActive && !isAdminRequest && !req.path.startsWith("/admin")) {
        return res.status(404).json({ message: "Campaña no encontrada" });
      }
      (req as CampaignRequest).campaignId = campaign.id;
      (req as CampaignRequest).campaignSlug = campaign.slug;
      next();
    } catch (err: unknown) {
      const missingCampaigns = isMissingCampaignsTableError(err);
      if (missingCampaigns) {
        console.error(
          "[api] Falta tabla campaigns. Ejecuta: npm run db:apply-multitenant (con DATABASE_URL)",
        );
        return res.status(503).json({
          message: "Base de datos sin migración multitenant (falta tabla campaigns)",
          code: "SCHEMA_CAMPAIGNS_MISSING",
          hint: 'npm run db:apply-multitenant   o   psql "$DATABASE_URL" -f scripts/multitenant-bigbang.sql',
        });
      }
      console.error("[api] campaign middleware:", err);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.use("/admin", (req, res, next) => {
    const token = req.header("x-admin-auth");
    if (token !== ADMIN_API_TOKEN) {
      return res.status(401).json({ message: "No autorizado" });
    }
    next();
  });

  apiRouter.get("/admin/campaigns", async (_req, res) => {
    try {
      const campaigns = await storage.listCampaigns();
      return res.status(200).json({ campaigns });
    } catch (error) {
      if (isMissingCampaignsTableError(error)) {
        console.error("[api] GET /admin/campaigns: falta tabla campaigns");
        return res.status(503).json({
          message: "Base de datos sin migración multitenant (falta tabla campaigns)",
          code: "SCHEMA_CAMPAIGNS_MISSING",
          hint: 'Con DATABASE_URL definida: npm run db:apply-multitenant   (o psql "$DATABASE_URL" -f scripts/multitenant-bigbang.sql)',
        });
      }
      const pg = extractPostgresError(error);
      const fallbackMsg = error instanceof Error ? error.message : String(error);
      console.error("[api] GET /admin/campaigns:", error);
      return res.status(500).json({
        message: pg ? pg.message : fallbackMsg || "Error interno del servidor",
        pgCode: pg?.code,
        code: "LIST_CAMPAIGNS_FAILED",
      });
    }
  });

  const reservedCampaignSlug = new Set(["admin", "admin-login"]);
  const newCampaignBody = z.object({
    slug: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1).max(200),
  });

  apiRouter.post("/admin/campaigns", async (req, res) => {
    try {
      const body = newCampaignBody.parse(req.body);
      if (reservedCampaignSlug.has(body.slug)) {
        return res.status(400).json({ message: "Slug reservado" });
      }
      const campaign = await storage.createCampaign(body.slug, body.name);
      return res.status(201).json({ campaign });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      if (error instanceof Error && error.message.includes("Ya existe")) {
        return res.status(409).json({ message: error.message });
      }
      if (isMissingCampaignsTableError(error)) {
        return res.status(503).json({
          message: "Base de datos sin migración multitenant (falta tabla campaigns)",
          code: "SCHEMA_CAMPAIGNS_MISSING",
          hint: 'npm run db:apply-multitenant (con DATABASE_URL)',
        });
      }
      const pg = extractPostgresError(error);
      const fallbackMsg = error instanceof Error ? error.message : String(error);
      console.error("create campaign:", error);
      return res.status(500).json({
        message: pg ? pg.message : fallbackMsg || "Error interno del servidor",
        pgCode: pg?.code,
        code: "CREATE_CAMPAIGN_FAILED",
      });
    }
  });

  apiRouter.patch("/admin/campaigns/:slug", async (req, res) => {
    try {
      const slug = z.string().min(1).parse(req.params.slug);
      const body = z
        .object({
          name: z.string().min(1).max(200).optional(),
          isActive: z.boolean().optional(),
        })
        .parse(req.body);
      const campaign = await storage.updateCampaign(slug, body);
      if (!campaign) {
        return res.status(404).json({ message: "Campaña no encontrada" });
      }
      return res.status(200).json({ campaign });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      console.error("patch campaign:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // User routes
  apiRouter.post("/login", async (req, res) => {
    try {
      const documentNumber = z.string().min(1).parse(req.body.documentNumber);
      
      const user = await storage.getUserByDocumentNumber(documentNumber, (req as unknown as CampaignRequest).campaignId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      return res.status(200).json({ user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Número de documento inválido" });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.post("/register", async (req, res) => {
    try {
      console.log("Recibido en registro:", req.body);
      
      const userData = insertUserSchema.parse(req.body);
      console.log("Datos validados:", userData);
      
      // Check if user already exists
      const existingUser = await storage.getUserByDocumentNumber(userData.documentNumber, (req as unknown as CampaignRequest).campaignId);
      if (existingUser) {
        return res.status(409).json({ message: "Usuario ya existe" });
      }
      
      const newUser = await storage.createUser(userData, (req as unknown as CampaignRequest).campaignId);
      return res.status(201).json({ user: newUser });
    } catch (error) {
      console.error("Error en registro:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Por favor completa todos tus datos",
          errors: error.errors
        });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Get active venues for registration
  apiRouter.get("/venues/active", async (req, res) => {
    try {
      const venues = await storage.getAllVenues((req as CampaignRequest).campaignId);
      const activeVenues = venues.filter(venue => venue.isActive);
      return res.status(200).json({ venues: activeVenues });
    } catch (error) {
      console.error("Error getting active venues:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Map segment routes
  apiRouter.get("/user/:documentNumber/segments", async (req, res) => {
    try {
      const { documentNumber } = req.params;
      
      const user = await storage.getUserByDocumentNumber(documentNumber, (req as CampaignRequest).campaignId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const segments = await storage.getSegmentsByUserId(user.id, (req as CampaignRequest).campaignId);
      return res.status(200).json({ segments });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.post("/unlock-segment", async (req, res) => {
    try {
      const { documentNumber, segmentId, securityCode } = z.object({
        documentNumber: z.string(),
        segmentId: z.number(),
        securityCode: z.string().optional()
      }).parse(req.body);
      
      const user = await storage.getUserByDocumentNumber(documentNumber, (req as CampaignRequest).campaignId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      // Obtenemos los datos del segmento de la base de datos
      const segmentAsset = await storage.getMapSegmentAsset(segmentId, (req as CampaignRequest).campaignId);
      
      // Verificamos si existe configuración para este segmento
      if (!segmentAsset) {
        return res.status(404).json({ 
          message: "No se encontró configuración para este segmento" 
        });
      }
      
      // Verificamos que se haya proporcionado un código de seguridad
      if (!securityCode) {
        return res.status(403).json({ 
          message: "Se requiere un código de seguridad para desbloquear el segmento" 
        });
      }
      
      // Verificamos que el código de seguridad coincida exactamente con el almacenado
      if (segmentAsset.securityCode !== securityCode) {
        return res.status(403).json({ 
          message: "Código de seguridad inválido para este segmento" 
        });
      }
      
      // Verificar si es un QR trampa
      if (segmentAsset.isTrap) {
        // Check if user has already scanned this trap QR
        const existingScore = await storage.getUserScoreBySegment(user.id, segmentId, (req as CampaignRequest).campaignId);
        
        if (existingScore) {
          // User has already scanned this QR, don't add/subtract points
          return res.status(200).json({ 
            isTrap: true,
            alreadyScanned: true,
            trapPoints: 0,
            message: "Este QR ya fue escaneado anteriormente",
            trapMessage: segmentAsset.trapMessage || null,
            segmentId,
            timestamp: existingScore.scannedAt
          });
        }
        
        // Add -5 points for trap QR
        const trapScore = await storage.addUserScore(user.id, segmentId, -5, true, (req as CampaignRequest).campaignId);
        // Also add to legacy trap points system
        await storage.addTrapPoints(user.id, segmentId, 1, (req as CampaignRequest).campaignId);
        
        const totalScore = await storage.calculateTotalScore(user.id, (req as CampaignRequest).campaignId);
        
        return res.status(200).json({ 
          isTrap: true,
          trapPoints: 5, // Show as positive number for penalty display
          totalScore,
          message: "¡Situación de riesgo reportada! -5 puntos",
          trapMessage: segmentAsset.trapMessage || null,
          segmentId,
          timestamp: trapScore.scannedAt
        });
      }
      
      // Check if user has already scanned this valid QR
      const existingScore = await storage.getUserScoreBySegment(user.id, segmentId, (req as CampaignRequest).campaignId);
      
      if (existingScore) {
        // User has already scanned this QR, don't add points but ensure segment is unlocked
        const segment = await storage.unlockSegment(user.id, segmentId, (req as CampaignRequest).campaignId);
        
        const allSegments = await storage.getSegmentsByUserId(user.id, (req as CampaignRequest).campaignId);
        const allAssets = await storage.getAllMapSegmentAssets((req as CampaignRequest).campaignId);
        const validAssets = allAssets.filter(asset => !asset.isTrap);
        const totalSegments = validAssets.length;
        const validSegmentIds = validAssets.map(asset => asset.segmentId);
        const unlockedSegments = allSegments.filter(s => 
          s.unlocked && validSegmentIds.includes(s.segmentId)
        ).length;
        
        return res.status(200).json({ 
          alreadyScanned: true,
          segment,
          unlockedSegments,
          totalSegments,
          completed: unlockedSegments === totalSegments,
          message: "Este QR ya fue escaneado anteriormente",
          modalContent: segmentAsset.modalContent || null,
          segmentTitle: segmentAsset.title || null,
          timestamp: existingScore.scannedAt
        });
      }
      
      // Add +10 points for valid QR
      await storage.addUserScore(user.id, segmentId, 10, false, (req as CampaignRequest).campaignId);
      
      const segment = await storage.unlockSegment(user.id, segmentId, (req as CampaignRequest).campaignId);
      
      // Check if all segments are completed
      const allSegments = await storage.getSegmentsByUserId(user.id, (req as CampaignRequest).campaignId);
      
      // Get all valid (non-trap) segment assets to calculate actual progress
      const allAssets = await storage.getAllMapSegmentAssets((req as CampaignRequest).campaignId);
      const validAssets = allAssets.filter(asset => !asset.isTrap);
      const totalSegments = validAssets.length;
      
      // Only count unlocked segments that correspond to valid (non-trap) assets
      const validSegmentIds = validAssets.map(asset => asset.segmentId);
      const unlockedSegments = allSegments.filter(s => 
        s.unlocked && validSegmentIds.includes(s.segmentId)
      ).length;
      
      let redemptionCode = null;
      if (unlockedSegments === totalSegments) {
        // Create redemption code if all segments are unlocked
        redemptionCode = await storage.createRedemptionCode(user.id, (req as CampaignRequest).campaignId);
        
        // Si el usuario completó el mapa y no tiene fecha de completado, registramos la fecha
        if (!user.completedAt) {
          await db.update(users)
            .set({ completedAt: new Date() })
            .where(eq(users.id, user.id));
        }
      }
      
      return res.status(200).json({ 
        segment, 
        unlockedSegments,
        totalSegments,
        completed: unlockedSegments === totalSegments,
        redemptionCode,
        modalContent: segmentAsset.modalContent || null,
        segmentTitle: segmentAsset.title || null
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos" });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Prize redemption routes
  apiRouter.get("/user/:documentNumber/prize", async (req, res) => {
    try {
      const { documentNumber } = req.params;
      
      const user = await storage.getUserByDocumentNumber(documentNumber, (req as CampaignRequest).campaignId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const prize = await storage.getPrizeByUserId(user.id, (req as CampaignRequest).campaignId);
      
      // Check if user has unlocked all segments
      const segments = await storage.getSegmentsByUserId(user.id, (req as CampaignRequest).campaignId);
      
      // Get all valid (non-trap) segment assets to calculate actual progress
      const allAssets = await storage.getAllMapSegmentAssets((req as CampaignRequest).campaignId);
      const validAssets = allAssets.filter(asset => !asset.isTrap);
      const totalSegments = validAssets.length;
      
      // Only count unlocked segments that correspond to valid (non-trap) assets
      const validSegmentIds = validAssets.map(asset => asset.segmentId);
      const unlockedSegments = segments.filter(s => 
        s.unlocked && validSegmentIds.includes(s.segmentId)
      ).length;
      
      const completed = unlockedSegments === totalSegments;
      
      // Generate redemption code if completed and not already generated
      let redemptionCode = prize?.redemptionCode;
      if (completed && !redemptionCode) {
        redemptionCode = await storage.createRedemptionCode(user.id, (req as CampaignRequest).campaignId);
      }
      
      return res.status(200).json({ 
        prize,
        completed,
        redemptionCode
      });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.post("/redeem-prize", async (req, res) => {
    try {
      const { redemptionCode } = z.object({
        redemptionCode: z.string()
      }).parse(req.body);
      
      const prize = await storage.getPrizeByRedemptionCode(redemptionCode, (req as CampaignRequest).campaignId);
      if (!prize) {
        return res.status(404).json({ message: "Código de redención inválido" });
      }
      
      if (prize.redeemed) {
        return res.status(400).json({ 
          message: "Premio ya reclamado", 
          redeemedAt: prize.redeemedAt 
        });
      }
      
      const updatedPrize = await storage.redeemPrize(prize.userId, (req as CampaignRequest).campaignId);
      
      return res.status(200).json({ 
        message: "Premio reclamado exitosamente",
        prize: updatedPrize
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Código de redención inválido" });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Obtener puntos trampa de un usuario
  apiRouter.get("/user/:documentNumber/trap-points", async (req, res) => {
    try {
      const { documentNumber } = req.params;
      
      const user = await storage.getUserByDocumentNumber(documentNumber, (req as CampaignRequest).campaignId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const trapPoints = await storage.getTrapPointsByUserId(user.id, (req as CampaignRequest).campaignId);
      const totalTrapPoints = await storage.getTotalTrapPointsByUserId(user.id, (req as CampaignRequest).campaignId);
      
      return res.status(200).json({
        trapPoints,
        totalTrapPoints
      });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Obtener ranking de puntos trampa para mostrar en el admin
  apiRouter.get("/admin/trap-points-ranking", async (req, res) => {
    try {
      const usersWithProgress = await storage.getAllUsersWithProgress((req as CampaignRequest).campaignId);
      
      // Agregar puntos trampa a cada usuario
      const ranking = await Promise.all(
        usersWithProgress.map(async (userProgress) => {
          const totalTrapPoints = await storage.getTotalTrapPointsByUserId(userProgress.user.id, (req as CampaignRequest).campaignId);
          const trapPointsHistory = await storage.getTrapPointsByUserId(userProgress.user.id, (req as CampaignRequest).campaignId);
          
          return {
            ...userProgress,
            totalTrapPoints,
            trapPointsHistory
          };
        })
      );
      
      // Ordenar por puntos trampa (mayor a menor)
      ranking.sort((a, b) => b.totalTrapPoints - a.totalTrapPoints);
      
      return res.status(200).json({ ranking });
    } catch (error) {
      console.error("Error getting trap points ranking:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Admin Dashboard routes for map segment assets
  apiRouter.get("/admin/map-assets", async (req, res) => {
    try {
      const assets = await storage.getAllMapSegmentAssets((req as CampaignRequest).campaignId);
      return res.status(200).json({ assets });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.get("/admin/map-assets/:segmentId", async (req, res) => {
    try {
      const segmentId = parseInt(req.params.segmentId);
      
      // Validar que el ID de segmento sea válido
      if (isNaN(segmentId) || segmentId < 1) {
        return res.status(400).json({ 
          message: "ID de segmento inválido, debe ser un número positivo"
        });
      }
      
      // Verificar si el segmento existe en la base de datos
      // En lugar de limitar por tamaño de cuadrícula, permitimos cualquier segmento existente
      const asset = await storage.getMapSegmentAsset(segmentId, (req as CampaignRequest).campaignId);
      
      if (!asset) {
        // Es una respuesta 200 vacía en lugar de 404 para evitar errores en consola
        // cuando un segmento simplemente no tiene configuración todavía
        return res.status(200).json({ asset: null });
      }
      
      return res.status(200).json({ asset });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.post("/admin/map-assets", async (req, res) => {
    try {
      const assetData = insertMapSegmentAssetsSchema.parse(req.body);
      
      // Verificar si ya existe un asset para este segmento
      const existingAsset = await storage.getMapSegmentAsset(assetData.segmentId, (req as CampaignRequest).campaignId);
      if (existingAsset) {
        return res.status(409).json({ 
          message: "Ya existe un asset para este segmento", 
          existingAsset 
        });
      }
      
      // Generar un código de seguridad aleatorio si no se proporciona uno
      if (!assetData.securityCode) {
        assetData.securityCode = generateSecurityCode();
      }
      
      const newAsset = await storage.createMapSegmentAsset(assetData, (req as CampaignRequest).campaignId);
      return res.status(201).json({ asset: newAsset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.put("/admin/map-assets/:segmentId", async (req, res) => {
    try {
      const segmentId = parseInt(req.params.segmentId);
      
      // Verificar si el asset existe
      const existingAsset = await storage.getMapSegmentAsset(segmentId, (req as CampaignRequest).campaignId);
      if (!existingAsset) {
        return res.status(404).json({ message: "Asset no encontrado" });
      }
      
      // Validar los datos para actualizar
      const updatedData = z.object({
        imageUrl: z.string().optional(),
        redirectUrl: z.string().nullable().optional(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        securityCode: z.string().optional(),
        isTrap: z.boolean().optional(),
        trapMessage: z.string().nullable().optional(),
        modalContent: z.string().nullable().optional()
      }).parse(req.body);
      
      // Generar un código de seguridad aleatorio si se solicita explícitamente
      if (req.body.generateNewCode === true) {
        updatedData.securityCode = generateSecurityCode();
      }
      
      const updatedAsset = await storage.updateMapSegmentAsset(segmentId, updatedData, (req as CampaignRequest).campaignId);
      return res.status(200).json({ asset: updatedAsset });
    } catch (error) {
      console.error('Error updating map asset:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.delete("/admin/map-assets/:segmentId", async (req, res) => {
    try {
      const segmentId = parseInt(req.params.segmentId);
      
      // Verificar si el asset existe
      const existingAsset = await storage.getMapSegmentAsset(segmentId, (req as CampaignRequest).campaignId);
      if (!existingAsset) {
        return res.status(404).json({ message: "Asset no encontrado" });
      }
      
      await storage.deleteMapSegmentAsset(segmentId, (req as CampaignRequest).campaignId);
      return res.status(200).json({ message: "Asset eliminado exitosamente" });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Endpoint para limpiar la base de datos (solo para pruebas)
  apiRouter.post("/admin/reset-data", async (_req, res) => {
    try {
      await storage.resetAllUserData((_req as CampaignRequest).campaignId);
      return res.status(200).json({ message: "Datos de usuarios reiniciados exitosamente" });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Endpoint para eliminar un usuario individual
  apiRouter.delete("/admin/users/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "ID de usuario inválido" });
      }

      // Verificar si el usuario existe
      const user = await storage.getUserById(userId, (req as CampaignRequest).campaignId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Eliminar todos los datos relacionados con el usuario
      await storage.deleteUserAndAllData(userId, (req as CampaignRequest).campaignId);
      
      return res.status(200).json({ 
        message: `Usuario ${user.documentNumber} eliminado exitosamente` 
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Health check endpoint
  // System configuration routes
  apiRouter.get("/system-config", async (_req, res) => {
    try {
      const config = await storage.getSystemConfig((_req as CampaignRequest).campaignId);
      return res.status(200).json({ config });
    } catch (error) {
      console.error('Error getting system config:', error);
      // En caso de error, devolver un valor predeterminado
      return res.status(200).json({ 
        config: {
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
          loadingText: 'Cargando tu mapa...'
        }
      });
    }
  });

  apiRouter.post("/admin/system-config", async (req, res) => {
    try {
      const configData = insertSystemConfigSchema.parse(req.body);
      const config = await storage.updateSystemConfig(configData, (req as CampaignRequest).campaignId);
      return res.status(200).json({ config });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[POST /api/admin/system-config] Validación Zod:", error.flatten());
        return res.status(400).json({
          message: "Datos inválidos",
          errors: error.errors,
        });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });


  


  // Admin uploads (logos, support images, etc.)
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        try {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          cb(null, UPLOADS_DIR);
        } catch (err) {
          cb(err as Error, UPLOADS_DIR);
        }
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExt = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
        const safeExt = allowedExt.includes(ext) ? ext : "";
        const filename = `${nanoid(16)}${safeExt}`;
        cb(null, filename);
      },
    }),
    limits: {
      fileSize: Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024), // 10MB
    },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/svg+xml",
      ]);

      if (!allowedMimes.has(file.mimetype)) {
        return cb(new Error("Tipo de archivo no permitido"));
      }
      cb(null, true);
    },
  });

  apiRouter.get("/admin/uploads", async (_req, res) => {
    try {
      const assets = await storage.listUploadedAssets((_req as CampaignRequest).campaignId);
      return res.status(200).json({ assets });
    } catch (error) {
      console.error("Error listing uploads:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.post("/admin/uploads", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No se recibió ningún archivo" });

      const publicUrl = `/bloodhound/uploads/${file.filename}`;

      const asset = await storage.createUploadedAsset({
        filename: file.filename,
        originalName: file.originalname,
        mime: file.mimetype,
        size: file.size ?? 0,
        publicUrl,
      }, (req as CampaignRequest).campaignId);

      return res.status(201).json({ asset });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Error uploading file:", err.message, err);
      const msg =
        err.message?.includes("EACCES") || err.message?.includes("permission denied")
          ? "Sin permiso para escribir en la carpeta de uploads. Revisa permisos en el servidor."
          : err.message?.includes("uploaded_assets") || err.message?.includes("relation")
            ? "Falta la tabla uploaded_assets. Ejecuta npm run db:push en el servidor."
            : err.message || "Error interno del servidor";
      return res.status(500).json({ message: msg });
    }
  });

  apiRouter.delete("/admin/uploads/:id", async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await storage.deleteUploadedAsset(id, (req as CampaignRequest).campaignId);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: "Solicitud inválida" });
    }
  });

  apiRouter.get("/health", async (_req, res) => {
    const schema = await verifyMultitenantSchema();
    res.status(200).json({
      status: schema.ok ? "ok" : "degraded",
      multitenantSchemaOk: schema.ok,
      ...(schema.detail ? { schemaHint: schema.detail } : {}),
    });
  });
  
  // Endpoint especial para sembrar datos de prueba (9 segmentos)
  apiRouter.post("/admin/seed-map-assets", async (_req, res) => {
    try {
      const segmentData = [
        {
          segmentId: 1,
          imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/blue-and-purple-sky-awv7vj_hKp0',
          title: 'Segmento 1',
          description: 'Colorido atardecer con tonos azules y morados'
        },
        {
          segmentId: 2,
          imageUrl: 'https://images.unsplash.com/photo-1603366615917-1fa6dad5c4fa?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/blue-and-orange-abstract-painting-JpYroTab9a0',
          title: 'Segmento 2',
          description: 'Abstracción en tonos azules y anaranjados'
        },
        {
          segmentId: 3,
          imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/abstract-painting-in-blue-and-orange-sYffw0LNr7s',
          title: 'Segmento 3',
          description: 'Resplandor naranja sobre fondo azul'
        },
        {
          segmentId: 4,
          imageUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/silhouette-photo-of-person-near-body-of-water-nz-TnRx0Eeo',
          title: 'Segmento 4',
          description: 'Silueta sobre agua al atardecer'
        },
        {
          segmentId: 5,
          imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/spiral-staircase-5i0GnoTTjSE',
          title: 'Segmento 5',
          description: 'Escalera de caracol en tonos azules'
        },
        {
          segmentId: 6,
          imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/green-leafed-plant-y8lCoTRanuQ',
          title: 'Segmento 6',
          description: 'Hojas verdes con rocío'
        },
        {
          segmentId: 7,
          imageUrl: 'https://images.unsplash.com/photo-1548504769-900b70ed122e?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/green-sequoia-trees-oyMTNjTpTFU',
          title: 'Segmento 7',
          description: 'Árboles secuoyas verdes'
        },
        {
          segmentId: 8,
          imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/green-leafed-forest-trees-KMn4VEeEPR8',
          title: 'Segmento 8',
          description: 'Bosque con luz solar'
        },
        {
          segmentId: 9,
          imageUrl: 'https://images.unsplash.com/photo-1505245208761-ba872912fac0?w=400&h=400&fit=crop',
          redirectUrl: 'https://unsplash.com/photos/island-in-the-middle-of-lake-3I4OcyKiOxM',
          title: 'Segmento 9',
          description: 'Isla en medio de un lago'
        }
      ];
      
      const results = [];
      
      // Procesar cada segmento
      for (const segment of segmentData) {
        try {
          // Verificar si ya existe
          const existing = await storage.getMapSegmentAsset(segment.segmentId, (_req as CampaignRequest).campaignId);
          
          if (existing) {
            // Actualizar registro existente
            // Si no tiene código de seguridad, generamos uno nuevo
            let securityCode = existing.securityCode;
            if (!securityCode) {
              securityCode = generateSecurityCode();
            }
            
            const updated = await storage.updateMapSegmentAsset(segment.segmentId, {
              imageUrl: segment.imageUrl,
              redirectUrl: segment.redirectUrl,
              title: segment.title,
              description: segment.description,
              securityCode,
            }, (_req as CampaignRequest).campaignId);
            results.push({ segmentId: segment.segmentId, action: 'updated', asset: updated });
          } else {
            // Crear nuevo registro
            // Generar un código de seguridad único para este segmento
            const securityCode = generateSecurityCode();
            
            const created = await storage.createMapSegmentAsset({
              segmentId: segment.segmentId,
              imageUrl: segment.imageUrl,
              redirectUrl: segment.redirectUrl,
              title: segment.title,
              description: segment.description,
              securityCode, // Agregar el código de seguridad
            }, (_req as CampaignRequest).campaignId);
            results.push({ segmentId: segment.segmentId, action: 'created', asset: created });
          }
        } catch (error) {
          results.push({ segmentId: segment.segmentId, error: String(error) });
        }
      }
      
      return res.json({ 
        success: true, 
        message: 'Siembra de datos completada',
        results 
      });
    } catch (error) {
      console.error("Error seeding map assets:", error);
      return res.status(500).json({ 
        error: "Error interno del servidor",
        details: String(error)
      });
    }
  });

  // Endpoint para obtener estadísticas de usuarios (Administrador)
  apiRouter.get("/admin/users-progress", async (_req, res) => {
    try {
      // Obtener todos los usuarios con su progreso
      const users = await storage.getAllUsersWithProgress((_req as CampaignRequest).campaignId);
      
      // Enriquecer con datos de scoring, traps y sedes
      const enhancedUsers = await Promise.all(
        users.map(async (userProgress) => {
          // Obtener puntos trampa
          const trapPoints = await storage.getTrapPointsByUserId(userProgress.user.id, (_req as CampaignRequest).campaignId);
          const totalTrapPoints = trapPoints.length;
          
          // Obtener segmentos desbloqueados (códigos correctos)
          const unlockedSegments = userProgress.segments.filter(s => s.unlocked);
          const correctCodes = unlockedSegments.length;
          
          // Calcular puntaje total (10 puntos por código correcto - 5 puntos por trampa)
          const totalScore = (correctCodes * 10) - (totalTrapPoints * 5);
          
          // Obtener información de la sede
          const venue = userProgress.user.venueId ? 
            await storage.getVenueById(userProgress.user.venueId, (_req as CampaignRequest).campaignId) : null;
          
          return {
            ...userProgress,
            totalScore,
            correctCodes,
            trapCodes: totalTrapPoints,
            trapPoints,
            venue: venue ? {
              id: venue.id,
              name: venue.name
            } : null
          };
        })
      );
      
      // Ordenar por múltiples criterios:
      // 1. Puntaje total (mayor a menor)
      // 2. Fecha de finalización (más temprano primero)
      // 3. Menor cantidad de códigos trampa
      enhancedUsers.sort((a, b) => {
        // Criterio 1: Puntaje total
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        
        // Criterio 2: Fecha de finalización para usuarios completados
        if (a.completionPercentage === 100 && b.completionPercentage === 100) {
          if (a.user.completedAt && b.user.completedAt) {
            return new Date(a.user.completedAt).getTime() - new Date(b.user.completedAt).getTime();
          }
          // Si uno no tiene fecha de finalización, el que tiene fecha va primero
          if (a.user.completedAt && !b.user.completedAt) return -1;
          if (!a.user.completedAt && b.user.completedAt) return 1;
        }
        
        // Criterio 3: Menor cantidad de códigos trampa
        return a.trapCodes - b.trapCodes;
      });
      
      res.json({ users: enhancedUsers });
    } catch (error) {
      console.error("Error getting user stats:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Venue management routes (Admin only)
  apiRouter.get("/admin/venues", async (req, res) => {
    try {
      const venues = await storage.getAllVenues((req as CampaignRequest).campaignId);
      return res.status(200).json({ venues });
    } catch (error) {
      console.error("Error getting venues:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.get("/admin/venues/:id", async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "ID de sede inválido" });
      }
      
      const venue = await storage.getVenueById(venueId, (req as CampaignRequest).campaignId);
      if (!venue) {
        return res.status(404).json({ message: "Sede no encontrada" });
      }
      
      return res.status(200).json({ venue });
    } catch (error) {
      console.error("Error getting venue:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.post("/admin/venues", async (req, res) => {
    try {
      const venueData = insertVenueSchema.parse(req.body);
      const newVenue = await storage.createVenue(venueData, (req as CampaignRequest).campaignId);
      return res.status(201).json({ venue: newVenue });
    } catch (error) {
      console.error("Error creating venue:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Datos de sede inválidos",
          errors: error.errors
        });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.put("/admin/venues/:id", async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "ID de sede inválido" });
      }
      
      const venueData = insertVenueSchema.partial().parse(req.body);
      const updatedVenue = await storage.updateVenue(venueId, venueData, (req as CampaignRequest).campaignId);
      return res.status(200).json({ venue: updatedVenue });
    } catch (error) {
      console.error("Error updating venue:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Datos de sede inválidos",
          errors: error.errors
        });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.delete("/admin/venues/:id", async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "ID de sede inválido" });
      }
      
      await storage.deleteVenue(venueId, (req as CampaignRequest).campaignId);
      return res.status(200).json({ message: "Sede eliminada exitosamente" });
    } catch (error) {
      console.error("Error deleting venue:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Venue-specific ranking endpoint (admin)
  apiRouter.get("/admin/venues/:id/ranking", async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "ID de sede inválido" });
      }
      
      const ranking = await storage.getVenueRanking(venueId, (req as CampaignRequest).campaignId);
      return res.status(200).json({ ranking });
    } catch (error) {
      console.error("Error getting venue ranking:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Public venue ranking endpoint (no authentication required)
  apiRouter.get("/venues/:id/ranking", async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "ID de sede inválido" });
      }
      
      const ranking = await storage.getVenueRanking(venueId, (req as CampaignRequest).campaignId);
      return res.status(200).json({ ranking });
    } catch (error) {
      console.error("Error getting venue ranking:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // New venue score ranking endpoint
  apiRouter.get("/venues/:id/score-ranking", async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "ID de sede inválido" });
      }
      
      const ranking = await storage.getVenueScoreRanking(venueId, (req as CampaignRequest).campaignId);
      return res.status(200).json({ ranking });
    } catch (error) {
      console.error("Error getting venue score ranking:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
