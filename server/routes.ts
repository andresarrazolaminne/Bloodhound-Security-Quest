import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertMapSegmentAssetsSchema } from "@shared/schema";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = express.Router();
  app.use("/api", apiRouter);

  // User routes
  apiRouter.post("/login", async (req, res) => {
    try {
      const documentNumber = z.string().min(1).parse(req.body.documentNumber);
      
      const user = await storage.getUserByDocumentNumber(documentNumber);
      
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
      const existingUser = await storage.getUserByDocumentNumber(userData.documentNumber);
      if (existingUser) {
        return res.status(409).json({ message: "Usuario ya existe" });
      }
      
      const newUser = await storage.createUser(userData);
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

  // Map segment routes
  apiRouter.get("/user/:documentNumber/segments", async (req, res) => {
    try {
      const { documentNumber } = req.params;
      
      const user = await storage.getUserByDocumentNumber(documentNumber);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const segments = await storage.getSegmentsByUserId(user.id);
      return res.status(200).json({ segments });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.post("/unlock-segment", async (req, res) => {
    try {
      const { documentNumber, segmentId } = z.object({
        documentNumber: z.string(),
        segmentId: z.number()
      }).parse(req.body);
      
      const user = await storage.getUserByDocumentNumber(documentNumber);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const segment = await storage.unlockSegment(user.id, segmentId);
      
      // Check if all segments are completed
      const allSegments = await storage.getSegmentsByUserId(user.id);
      const totalSegments = 9; // Total number of segments in the map
      const unlockedSegments = allSegments.filter(s => s.unlocked).length;
      
      let redemptionCode = null;
      if (unlockedSegments === totalSegments) {
        // Create redemption code if all segments are unlocked
        redemptionCode = await storage.createRedemptionCode(user.id);
      }
      
      return res.status(200).json({ 
        segment, 
        unlockedSegments,
        totalSegments,
        completed: unlockedSegments === totalSegments,
        redemptionCode
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
      
      const user = await storage.getUserByDocumentNumber(documentNumber);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const prize = await storage.getPrizeByUserId(user.id);
      
      // Check if user has unlocked all segments
      const segments = await storage.getSegmentsByUserId(user.id);
      const totalSegments = 9;
      const unlockedSegments = segments.filter(s => s.unlocked).length;
      const completed = unlockedSegments === totalSegments;
      
      // Generate redemption code if completed and not already generated
      let redemptionCode = prize?.redemptionCode;
      if (completed && !redemptionCode) {
        redemptionCode = await storage.createRedemptionCode(user.id);
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
      
      const prize = await storage.getPrizeByRedemptionCode(redemptionCode);
      if (!prize) {
        return res.status(404).json({ message: "Código de redención inválido" });
      }
      
      if (prize.redeemed) {
        return res.status(400).json({ 
          message: "Premio ya reclamado", 
          redeemedAt: prize.redeemedAt 
        });
      }
      
      const updatedPrize = await storage.redeemPrize(prize.userId);
      
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

  // Admin Dashboard routes for map segment assets
  apiRouter.get("/admin/map-assets", async (req, res) => {
    try {
      const assets = await storage.getAllMapSegmentAssets();
      return res.status(200).json({ assets });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  apiRouter.get("/admin/map-assets/:segmentId", async (req, res) => {
    try {
      const segmentId = parseInt(req.params.segmentId);
      const asset = await storage.getMapSegmentAsset(segmentId);
      
      if (!asset) {
        return res.status(404).json({ message: "Asset no encontrado" });
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
      const existingAsset = await storage.getMapSegmentAsset(assetData.segmentId);
      if (existingAsset) {
        return res.status(409).json({ 
          message: "Ya existe un asset para este segmento", 
          existingAsset 
        });
      }
      
      const newAsset = await storage.createMapSegmentAsset(assetData);
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
      const existingAsset = await storage.getMapSegmentAsset(segmentId);
      if (!existingAsset) {
        return res.status(404).json({ message: "Asset no encontrado" });
      }
      
      // Validar los datos para actualizar
      const updatedData = z.object({
        imageUrl: z.string().optional(),
        redirectUrl: z.string().nullable().optional(),
        title: z.string().optional(),
        description: z.string().nullable().optional()
      }).parse(req.body);
      
      const updatedAsset = await storage.updateMapSegmentAsset(segmentId, updatedData);
      return res.status(200).json({ asset: updatedAsset });
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

  apiRouter.delete("/admin/map-assets/:segmentId", async (req, res) => {
    try {
      const segmentId = parseInt(req.params.segmentId);
      
      // Verificar si el asset existe
      const existingAsset = await storage.getMapSegmentAsset(segmentId);
      if (!existingAsset) {
        return res.status(404).json({ message: "Asset no encontrado" });
      }
      
      await storage.deleteMapSegmentAsset(segmentId);
      return res.status(200).json({ message: "Asset eliminado exitosamente" });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Health check endpoint
  apiRouter.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
