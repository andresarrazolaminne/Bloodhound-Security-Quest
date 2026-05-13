import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertUserSchema,
  insertMapSegmentAssetsSchema,
  insertSystemConfigSchema,
  insertVenueSchema,
  users,
  type MapSegmentAsset,
} from "@shared/schema";
import {
  mintQuizChallengeToken,
  verifyQuizChallengeToken,
  quizChallengeExpiry,
  shuffleOrder,
} from "./quizChallenge";
import { db, verifyMultitenantSchema } from "./db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { RESERVED_CAMPAIGN_ROUTE_SEGMENT_SET } from "@shared/reservedSlugs";
import { playableSegmentIdsForCampaign } from "@shared/mapGrid";
import {
  useS3Uploads,
  s3ObjectKeyForUpload,
  publicUrlForS3ObjectKey,
  s3PutUploadObject,
} from "./s3Uploads";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/usr/share/nginx/html/bloodhound/uploads";

/** Evita caracteres de control que rompen el XML interno del .xlsx. */
function sanitizeExcelCell(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = value == null ? "" : String(value);
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, 32760);
}
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "admin123";

function refineMapAssetQuiz(data: {
  quizEnabled?: boolean | null;
  quizOptions?: string[] | null;
  quizCorrectIndex?: number | null;
  isTrap?: boolean | null;
}, ctx: z.RefinementCtx): void {
  if (data.isTrap) return;
  if (!data.quizEnabled) return;
  const opts = data.quizOptions;
  if (!Array.isArray(opts) || opts.length < 2 || !opts.every((o) => typeof o === "string" && o.trim().length > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Con pregunta activa se requieren al menos 2 opciones no vacías",
      path: ["quizOptions"],
    });
    return;
  }
  const ci = data.quizCorrectIndex;
  if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci >= opts.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Índice de respuesta correcta inválido",
      path: ["quizCorrectIndex"],
    });
  }
}

const insertMapSegmentAssetsWithQuizSchema = insertMapSegmentAssetsSchema.superRefine(refineMapAssetQuiz);

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

/** Respuesta 503 si falta migración de columnas/tabla de quiz (PostgreSQL 42703). */
function tryRespondQuizSchemaMissing(res: express.Response, error: unknown): boolean {
  const pg = extractPostgresError(error);
  if (!pg || pg.code !== "42703") return false;
  if (!/quiz_|user_segment_quiz/i.test(pg.message)) return false;
  res.status(503).json({
    message:
      "Falta el esquema de preguntas en la base de datos. Con DATABASE_URL definida ejecuta: npm run db:apply-quiz-schema",
    code: "SCHEMA_QUIZ_COLUMNS_MISSING",
  });
  return true;
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

/** Normaliza prefijo público (/bloodhound). Vacío si es root. */
function normalizePublicBasePath(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  let p = String(raw).trim();
  if (!p) return null;
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+$/, "");
  if (!p || p === "/") return null;
  return p;
}

/**
 * El cliente (Vite) suele llamar a `${UI_BASE_PATH}/api/...`.
 * El servidor DEBE montar el mismo prefijo en runtime; si no, Express sirve el SPA (HTML) y el fetch falla al parsear JSON.
 * Variables típicas: VITE_BASE_PATH (build), UI_BASE_PATH (deploy.sh); aceptamos alias por si PM2 solo define una.
 */
function collectApiMountPaths(): string[] {
  const mounts = new Set<string>(["/api"]);
  const candidates = [
    process.env.VITE_BASE_PATH,
    process.env.UI_BASE_PATH,
    process.env.BASE_PATH,
    process.env.CLIENT_BASE_PATH,
  ];
  for (const raw of candidates) {
    const b = normalizePublicBasePath(raw);
    if (b) mounts.add(`${b}/api`);
  }
  return [...mounts];
}

/** Prefijo de URL público para archivos subidos (alineado al deploy root vs subruta). */
function resolveNormalizedPublicBase(): string | null {
  const candidates = [
    process.env.UI_BASE_PATH,
    process.env.VITE_BASE_PATH,
    process.env.BASE_PATH,
    process.env.CLIENT_BASE_PATH,
  ];
  for (const raw of candidates) {
    const b = normalizePublicBasePath(raw);
    if (b) return b;
  }
  return null;
}

/** Path URL completo del directorio de uploads (sin trailing slash), p. ej. `/uploads` o `/bloodhound/uploads`. */
function publicUploadsUrlDirectory(): string {
  const base = resolveNormalizedPublicBase();
  return base ? `${base}/uploads` : "/uploads";
}

function publicUrlForUploadedFile(filename: string): string {
  return `${publicUploadsUrlDirectory()}/${filename}`;
}

function adminUploadBasename(originalname: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const allowedExt = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
  const safeExt = allowedExt.includes(ext) ? ext : "";
  return `${nanoid(16)}${safeExt}`;
}

/** Sirve UPLOADS_DIR en rutas compatibles con el prefijo de deploy y alias legado. */
function mountUploadsStatic(app: Express): void {
  const staticMw = express.static(UPLOADS_DIR);
  const mountSet = new Set<string>();
  mountSet.add("/uploads");
  mountSet.add("/bloodhound/uploads");
  const base = resolveNormalizedPublicBase();
  if (base) mountSet.add(`${base}/uploads`);
  for (const mount of mountSet) {
    app.use(mount, staticMw);
  }
  console.log("[uploads] Montajes estáticos:", [...mountSet].join(", "));
}

export async function registerRoutes(app: Express): Promise<Server> {
  mountUploadsStatic(app);

  const apiRouter = express.Router();
  const mountPaths = collectApiMountPaths();
  console.log("[api] Montajes del router API:", mountPaths.join(", "));
  mountPaths.forEach((mount) => {
    app.use(mount, apiRouter);
  });

  async function playableUnlockTotals(userId: number, campaignId: number) {
    const allSegments = await storage.getSegmentsByUserId(userId, campaignId);
    const allAssets = await storage.getAllMapSegmentAssets(campaignId);
    const sysConfig = await storage.getSystemConfig(campaignId);
    const playableIds = playableSegmentIdsForCampaign(allAssets, sysConfig?.mapGridSize);
    const playableSet = new Set(playableIds);
    const unlockedSegments = allSegments.filter(
      (s) => s.unlocked && playableSet.has(s.segmentId),
    ).length;
    return { unlockedSegments, totalSegments: playableIds.length };
  }

  async function finalizeValidSegmentUnlock(
    res: express.Response,
    user: { id: number; completedAt: Date | null },
    segmentId: number,
    segmentAsset: MapSegmentAsset,
    campaignId: number,
    quizOutcome?: { quizAnswerCorrect: boolean; quizBonusPoints: number },
  ) {
    await storage.addUserScore(user.id, segmentId, 10, false, campaignId);
    const segment = await storage.unlockSegment(user.id, segmentId, campaignId);
    const { unlockedSegments, totalSegments } = await playableUnlockTotals(user.id, campaignId);
    let redemptionCode: string | null = null;
    if (unlockedSegments === totalSegments) {
      redemptionCode = await storage.createRedemptionCode(user.id, campaignId);
      if (!user.completedAt) {
        await db.update(users).set({ completedAt: new Date() }).where(eq(users.id, user.id));
      }
    }
    return res.status(200).json({
      segment,
      unlockedSegments,
      totalSegments,
      completed: unlockedSegments === totalSegments,
      redemptionCode,
      modalContent: segmentAsset.modalContent ?? null,
      segmentTitle: segmentAsset.title ?? null,
      ...(quizOutcome
        ? {
            quizAnswerCorrect: quizOutcome.quizAnswerCorrect,
            quizBonusPoints: quizOutcome.quizBonusPoints,
          }
        : {}),
    });
  }

  apiRouter.use(async (req, res, next) => {
    if (shouldSkipCampaignTenantResolution(req)) return next();
    try {
      const requestedSlug = String(req.header("x-campaign-slug") || req.query.campaignSlug || "").trim();
      const slug = requestedSlug || process.env.DEFAULT_CAMPAIGN_SLUG || "default";
      const campaign = await storage.getCampaignBySlug(slug);
      if (!campaign) {
        return res.status(404).json({
          message: "Campaña no encontrada",
          code: "CAMPAIGN_NOT_FOUND",
          slug,
        });
      }
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

  /** Lectura pública de segmentos del mapa (jugador). Sin código ni datos del quiz que revelen la respuesta. */
  function mapAssetPublic(asset: MapSegmentAsset): MapSegmentAsset {
    return {
      ...asset,
      securityCode: "",
      quizQuestionHtml: null,
      quizOptions: null,
      quizCorrectIndex: null,
    };
  }

  /** Normaliza opciones guardadas en jsonb (array, objeto indexado o string JSON). */
  function normalizeQuizOptions(raw: unknown): string[] {
    if (raw == null) return [];
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t.startsWith("[") && t.endsWith("]")) {
        try {
          return normalizeQuizOptions(JSON.parse(t) as unknown);
        } catch {
          return t ? [t] : [];
        }
      }
      return t ? [t] : [];
    }
    if (Array.isArray(raw)) {
      return raw
        .map((x) => (x == null ? "" : typeof x === "string" ? x : String(x)))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    if (typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const keys = Object.keys(o).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a.localeCompare(b);
      });
      return keys
        .map((k) => o[k])
        .map((x) => (x == null ? "" : typeof x === "string" ? x : String(x)))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return [];
  }

  function resolveSegmentQuiz(asset: MapSegmentAsset): { active: boolean; options: string[] } {
    const options = normalizeQuizOptions(asset.quizOptions);
    if (!asset.quizEnabled || asset.isTrap) {
      return { active: false, options };
    }
    const ci = asset.quizCorrectIndex;
    const active =
      options.length >= 2 &&
      typeof ci === "number" &&
      Number.isInteger(ci) &&
      ci >= 0 &&
      ci < options.length;
    return { active, options };
  }

  apiRouter.get("/map-assets", async (req, res) => {
    try {
      const assets = await storage.getAllMapSegmentAssets((req as CampaignRequest).campaignId);
      return res.status(200).json({ assets: assets.map((a) => mapAssetPublic(a)) });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.get("/map-assets/:segmentId", async (req, res) => {
    try {
      const segmentId = parseInt(req.params.segmentId, 10);
      if (Number.isNaN(segmentId) || segmentId < 1) {
        return res.status(400).json({ message: "ID de segmento inválido" });
      }
      const asset = await storage.getMapSegmentAsset(segmentId, (req as CampaignRequest).campaignId);
      if (!asset) {
        return res.status(200).json({ asset: null });
      }
      return res.status(200).json({ asset: mapAssetPublic(asset) });
    } catch (error) {
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
      if (RESERVED_CAMPAIGN_ROUTE_SEGMENT_SET.has(body.slug)) {
        return res.status(400).json({
          message:
            "Ese slug está reservado (coincide con rutas de la app: map, auth, register, etc.). Elige otro.",
        });
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

  apiRouter.delete("/admin/campaigns/:slug", async (req, res) => {
    try {
      const slug = z.string().min(1).parse(req.params.slug);
      const confirm = String(
        req.query.confirmSlug ??
          (req.body && typeof req.body === "object" && "confirmSlug" in req.body
            ? (req.body as { confirmSlug?: unknown }).confirmSlug
            : "") ??
          "",
      ).trim();
      if (confirm !== slug) {
        return res.status(400).json({
          message: "Confirma el slug exacto de la campaña (confirmSlug en el cuerpo o query).",
          code: "CONFIRM_SLUG_MISMATCH",
        });
      }
      const result = await storage.deleteCampaignBySlug(slug);
      if (!result.ok) {
        if (result.reason === "reserved") {
          return res.status(400).json({
            message: 'La campaña "default" no se puede eliminar (reservada para el sistema).',
            code: "CAMPAIGN_DELETE_RESERVED",
          });
        }
        return res.status(404).json({ message: "Campaña no encontrada", code: "CAMPAIGN_NOT_FOUND" });
      }
      return res.status(200).json({ success: true, slug });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Solicitud inválida", errors: error.errors });
      }
      console.error("delete campaign:", error);
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

      try {
        await storage.ensureUserPlayState(user.id, (req as CampaignRequest).campaignId);
      } catch (ensureErr) {
        console.error("[api] GET /user/.../segments ensureUserPlayState:", ensureErr);
        return res.status(500).json({
          message: "No se pudo inicializar el progreso del mapa en el servidor",
          code: "ENSURE_PLAY_STATE_FAILED",
        });
      }

      const segments = await storage.getSegmentsByUserId(user.id, (req as CampaignRequest).campaignId);
      return res.status(200).json({ segments });
    } catch (error) {
      console.error("[api] GET /user/:documentNumber/segments:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.get("/user/:documentNumber/quiz-stats", async (req, res) => {
    try {
      const { documentNumber } = req.params;
      const campaignId = (req as CampaignRequest).campaignId;
      const user = await storage.getUserByDocumentNumber(documentNumber, campaignId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      const quizStats = await storage.getQuizStatsForUser(user.id, campaignId);
      const quizBonusPoints = await storage.sumQuizPointsForUser(user.id, campaignId);
      return res.status(200).json({
        quizCorrectAnswers: quizStats.correctAnswers,
        quizWrongAnswers: quizStats.wrongAnswers,
        quizBonusPoints,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.post("/unlock-segment", async (req, res) => {
    try {
      const body = z
        .object({
          documentNumber: z.string(),
          segmentId: z.number(),
          securityCode: z.string().optional(),
          quizChallengeToken: z.string().optional(),
          quizSelectedSlot: z.number().int().min(0).optional(),
        })
        .parse(req.body);
      const { documentNumber, segmentId, securityCode, quizChallengeToken, quizSelectedSlot } = body;

      const campaignId = (req as CampaignRequest).campaignId!;
      const user = await storage.getUserByDocumentNumber(documentNumber, campaignId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const segmentAsset = await storage.getMapSegmentAsset(segmentId, campaignId);
      if (!segmentAsset) {
        return res.status(404).json({
          message: "No se encontró configuración para este segmento",
        });
      }

      if (!securityCode) {
        return res.status(403).json({
          message: "Se requiere un código de seguridad para desbloquear el segmento",
        });
      }

      if (segmentAsset.securityCode !== securityCode) {
        return res.status(403).json({
          message: "Código de seguridad inválido para este segmento",
        });
      }

      if (segmentAsset.isTrap) {
        const existingScore = await storage.getUserScoreBySegment(user.id, segmentId, campaignId);

        if (existingScore) {
          return res.status(200).json({
            isTrap: true,
            alreadyScanned: true,
            trapPoints: 0,
            message: "Este QR ya fue escaneado anteriormente",
            trapMessage: segmentAsset.trapMessage || null,
            segmentId,
            timestamp: existingScore.scannedAt,
          });
        }

        const trapScore = await storage.addUserScore(user.id, segmentId, -5, true, campaignId);
        await storage.addTrapPoints(user.id, segmentId, 1, campaignId);

        const totalScore = await storage.calculateTotalScore(user.id, campaignId);

        return res.status(200).json({
          isTrap: true,
          trapPoints: 5,
          totalScore,
          message: "¡Situación de riesgo reportada! -5 puntos",
          trapMessage: segmentAsset.trapMessage || null,
          segmentId,
          timestamp: trapScore.scannedAt,
        });
      }

      const quizAttempt = await storage.getSegmentQuizAttempt(user.id, segmentId, campaignId);

      const existingScore = await storage.getUserScoreBySegment(user.id, segmentId, campaignId);

      const quizState = resolveSegmentQuiz(segmentAsset);
      if (segmentAsset.quizEnabled && !segmentAsset.isTrap && !quizState.active) {
        return res.status(503).json({
          message:
            "La pregunta de este segmento no está bien configurada (faltan opciones o la respuesta correcta). Contacta al organizador.",
          code: "QUIZ_CONFIG_INVALID",
        });
      }

      const quizActive = quizState.active;

      if (quizActive) {
        // Un intento de trivia por segmento/usuario; si ya hay fila, no volver a mostrar la pregunta.
        if (quizAttempt) {
          if (existingScore) {
            const segment = await storage.unlockSegment(user.id, segmentId, campaignId);
            const { unlockedSegments, totalSegments } = await playableUnlockTotals(user.id, campaignId);
            return res.status(200).json({
              alreadyScanned: true,
              segment,
              unlockedSegments,
              totalSegments,
              completed: unlockedSegments === totalSegments,
              message: "Este QR ya fue escaneado anteriormente",
              modalContent: segmentAsset.modalContent ?? null,
              segmentTitle: segmentAsset.title ?? null,
              timestamp: existingScore.scannedAt,
              quizAnswerCorrect: quizAttempt.isCorrect,
              quizBonusPoints: quizAttempt.pointsAwarded,
            });
          }
          // Recuperación: intento guardado pero sin puntuación (p. ej. error tras upsert).
          return finalizeValidSegmentUnlock(res, user, segmentId, segmentAsset, campaignId, {
            quizAnswerCorrect: quizAttempt.isCorrect,
            quizBonusPoints: quizAttempt.pointsAwarded,
          });
        }

        const opts = quizState.options;

        if (quizChallengeToken === undefined || quizSelectedSlot === undefined) {
          const order = shuffleOrder(opts.length);
          const labels = order.map((i) => opts[i]);
          const challengeToken = mintQuizChallengeToken({
            campaignId,
            userId: user.id,
            segmentId,
            order,
            exp: quizChallengeExpiry(),
          });
          return res.status(200).json({
            needsQuiz: true,
            challengeToken,
            quizQuestionHtml: segmentAsset.quizQuestionHtml ?? "",
            quizOptionLabels: labels,
            segmentId,
          });
        }

        const payload = verifyQuizChallengeToken(quizChallengeToken);
        if (
          !payload ||
          payload.userId !== user.id ||
          payload.segmentId !== segmentId ||
          payload.campaignId !== campaignId
        ) {
          return res.status(400).json({
            message: "Sesión de pregunta inválida o expirada. Vuelve a escanear el código.",
            code: "QUIZ_CHALLENGE_INVALID",
          });
        }

        if (quizSelectedSlot < 0 || quizSelectedSlot >= payload.order.length) {
          return res.status(400).json({ message: "Respuesta inválida" });
        }

        const originalIndex = payload.order[quizSelectedSlot]!;
        const correctIdx = segmentAsset.quizCorrectIndex!;
        const bonusPoints = segmentAsset.quizPoints ?? 5;

        if (originalIndex !== correctIdx) {
          await storage.upsertSegmentQuizAttempt({
            userId: user.id,
            segmentId,
            campaignId,
            isCorrect: false,
            pointsAwarded: 0,
            selectedIndex: originalIndex,
          });
          if (existingScore) {
            const segment = await storage.unlockSegment(user.id, segmentId, campaignId);
            const { unlockedSegments, totalSegments } = await playableUnlockTotals(user.id, campaignId);
            return res.status(200).json({
              alreadyScanned: true,
              segment,
              unlockedSegments,
              totalSegments,
              completed: unlockedSegments === totalSegments,
              message: "Este QR ya fue escaneado anteriormente",
              modalContent: segmentAsset.modalContent ?? null,
              segmentTitle: segmentAsset.title ?? null,
              timestamp: existingScore.scannedAt,
              quizAnswerCorrect: false,
              quizBonusPoints: 0,
            });
          }
          return finalizeValidSegmentUnlock(res, user, segmentId, segmentAsset, campaignId, {
            quizAnswerCorrect: false,
            quizBonusPoints: 0,
          });
        }

        await storage.upsertSegmentQuizAttempt({
          userId: user.id,
          segmentId,
          campaignId,
          isCorrect: true,
          pointsAwarded: bonusPoints,
          selectedIndex: originalIndex,
        });

        if (existingScore) {
          const segment = await storage.unlockSegment(user.id, segmentId, campaignId);
          const { unlockedSegments, totalSegments } = await playableUnlockTotals(user.id, campaignId);
          return res.status(200).json({
            alreadyScanned: true,
            segment,
            unlockedSegments,
            totalSegments,
            completed: unlockedSegments === totalSegments,
            message: "Este QR ya fue escaneado anteriormente",
            modalContent: segmentAsset.modalContent ?? null,
            segmentTitle: segmentAsset.title ?? null,
            timestamp: existingScore.scannedAt,
            quizAnswerCorrect: true,
            quizBonusPoints: bonusPoints,
          });
        }

        return finalizeValidSegmentUnlock(res, user, segmentId, segmentAsset, campaignId, {
          quizAnswerCorrect: true,
          quizBonusPoints: bonusPoints,
        });
      } else if (existingScore) {
        const segment = await storage.unlockSegment(user.id, segmentId, campaignId);
        const { unlockedSegments, totalSegments } = await playableUnlockTotals(user.id, campaignId);
        return res.status(200).json({
          alreadyScanned: true,
          segment,
          unlockedSegments,
          totalSegments,
          completed: unlockedSegments === totalSegments,
          message: "Este QR ya fue escaneado anteriormente",
          modalContent: segmentAsset.modalContent ?? null,
          segmentTitle: segmentAsset.title ?? null,
          timestamp: existingScore.scannedAt,
        });
      }

      return finalizeValidSegmentUnlock(res, user, segmentId, segmentAsset, campaignId);
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

      const { unlockedSegments, totalSegments } = await playableUnlockTotals(
        user.id,
        (req as CampaignRequest).campaignId,
      );

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
      console.error("[api] GET /user/:documentNumber/prize:", error);
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
      console.error("GET /admin/map-assets:", error);
      if (tryRespondQuizSchemaMissing(res, error)) return;
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
      const assetData = insertMapSegmentAssetsWithQuizSchema.parse(req.body);
      
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
      const updatedData = z
        .object({
          imageUrl: z.string().optional(),
          redirectUrl: z.string().nullable().optional(),
          title: z.string().optional(),
          description: z.string().nullable().optional(),
          securityCode: z.string().optional(),
          isTrap: z.boolean().optional(),
          trapMessage: z.string().nullable().optional(),
          modalContent: z.string().nullable().optional(),
          quizEnabled: z.boolean().optional(),
          quizQuestionHtml: z.string().nullable().optional(),
          quizOptions: z.array(z.string()).nullable().optional(),
          quizCorrectIndex: z.number().int().min(0).nullable().optional(),
          quizPoints: z.number().int().min(0).max(1000).optional(),
        })
        .superRefine((data, ctx) => refineMapAssetQuiz(data, ctx))
        .parse(req.body);
      
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
          mapSegmentAspectRatio: "1/1",
          mapSegmentImageFit: "cover",
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
          completionCtaEnabled: false,
          completionCtaButtonText: 'Ir al premio',
          completionCtaUrl: '',
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
  const uploadLimits = {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024), // 10MB
  };
  const uploadFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
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
  };

  const upload = useS3Uploads()
    ? multer({
        storage: multer.memoryStorage(),
        limits: uploadLimits,
        fileFilter: uploadFileFilter,
      })
    : multer({
        storage: multer.diskStorage({
          destination: (_req, _file, cb) => {
            try {
              fs.mkdirSync(UPLOADS_DIR, { recursive: true });
              cb(null, UPLOADS_DIR);
            } catch (err) {
              cb(err as Error, UPLOADS_DIR);
            }
          },
          filename: (_req, file, cb) => cb(null, adminUploadBasename(file.originalname)),
        }),
        limits: uploadLimits,
        fileFilter: uploadFileFilter,
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

      const campaignId = (req as CampaignRequest).campaignId;
      if (campaignId == null) {
        return res.status(500).json({ message: "Campaña no resuelta para el upload" });
      }

      let publicUrl: string;
      let filenameForDb: string;

      if (useS3Uploads()) {
        const buf = "buffer" in file && Buffer.isBuffer((file as { buffer?: Buffer }).buffer)
          ? (file as { buffer: Buffer }).buffer
          : undefined;
        if (!buf) {
          return res.status(500).json({ message: "Buffer de archivo no disponible" });
        }
        const basename = adminUploadBasename(file.originalname);
        const objectKey = s3ObjectKeyForUpload(campaignId, basename);
        await s3PutUploadObject(objectKey, buf, file.mimetype);
        publicUrl = publicUrlForS3ObjectKey(objectKey);
        filenameForDb = objectKey;
      } else {
        publicUrl = publicUrlForUploadedFile(file.filename);
        filenameForDb = file.filename;
      }

      const asset = await storage.createUploadedAsset(
        {
          filename: filenameForDb,
          originalName: file.originalname,
          mime: file.mimetype,
          size: file.size ?? 0,
          publicUrl,
        },
        campaignId,
      );

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
          
          // Calcular puntaje total real (QR + bonus quiz)
          const totalScore = await storage.calculateTotalScore(
            userProgress.user.id,
            (_req as CampaignRequest).campaignId,
          );
          const quizStats = await storage.getQuizStatsForUser(
            userProgress.user.id,
            (_req as CampaignRequest).campaignId,
          );
          
          // Obtener información de la sede
          const venue = userProgress.user.venueId ? 
            await storage.getVenueById(userProgress.user.venueId, (_req as CampaignRequest).campaignId) : null;
          
          return {
            ...userProgress,
            totalScore,
            correctCodes,
            trapCodes: totalTrapPoints,
            quizCorrectAnswers: quizStats.correctAnswers,
            quizWrongAnswers: quizStats.wrongAnswers,
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
      if (tryRespondQuizSchemaMissing(res, error)) return;
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.get("/admin/export/ranking-xlsx", async (req, res) => {
    try {
      const raw = req.query.venueId;
      let venueId: number | null = null;
      if (raw !== undefined && raw !== null && String(raw).trim() !== "" && String(raw) !== "all") {
        const n = parseInt(String(raw), 10);
        if (Number.isNaN(n) || n < 1) {
          return res.status(400).json({ message: "Parámetro venueId inválido" });
        }
        const venue = await storage.getVenueById(n, (req as CampaignRequest).campaignId);
        if (!venue) {
          return res.status(404).json({ message: "Sede no encontrada" });
        }
        venueId = n;
      }

      const data = await storage.getRankingExportData(venueId, (req as CampaignRequest).campaignId);
      const slug = (req as CampaignRequest).campaignSlug ?? "campaign";
      const safeSlug = String(slug).replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 48) || "campaign";
      const venueSuffix = venueId == null ? "todas-sedes" : `sede-${venueId}`;

      const aoa: (string | number)[][] = [
        data.headers.map((h) => sanitizeExcelCell(h) as string),
        ...data.rows.map((row) => row.map(sanitizeExcelCell)),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ranking");

      const rawBuf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer | Uint8Array;
      const out = Buffer.isBuffer(rawBuf) ? rawBuf : Buffer.from(rawBuf);
      if (out.length < 4 || out[0] !== 0x50 || out[1] !== 0x4b) {
        throw new Error("Salida XLSX inválida (cabecera ZIP)");
      }

      const fileBase = `ranking-${safeSlug}-${venueSuffix}`;
      res.status(200);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.xlsx"`);
      res.setHeader("Content-Length", String(out.length));
      res.end(out);
    } catch (error) {
      console.error("Error export ranking xlsx:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error al generar el archivo" });
      }
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
