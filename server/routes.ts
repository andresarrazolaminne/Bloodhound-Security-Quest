import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertMapSegmentAssetsSchema, insertSystemConfigSchema, insertVenueSchema, users } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { fetchReplitAnalytics } from "./analytics";

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

  // Get active venues for registration
  apiRouter.get("/venues/active", async (req, res) => {
    try {
      const venues = await storage.getAllVenues();
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
      const { documentNumber, segmentId, securityCode } = z.object({
        documentNumber: z.string(),
        segmentId: z.number(),
        securityCode: z.string().optional()
      }).parse(req.body);
      
      const user = await storage.getUserByDocumentNumber(documentNumber);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      // Obtenemos los datos del segmento de la base de datos
      const segmentAsset = await storage.getMapSegmentAsset(segmentId);
      
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
        const existingScore = await storage.getUserScoreBySegment(user.id, segmentId);
        
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
        const trapScore = await storage.addUserScore(user.id, segmentId, -5, true);
        // Also add to legacy trap points system
        await storage.addTrapPoints(user.id, segmentId, 1);
        
        const totalScore = await storage.calculateTotalScore(user.id);
        
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
      const existingScore = await storage.getUserScoreBySegment(user.id, segmentId);
      
      if (existingScore) {
        // User has already scanned this QR, don't add points but still show segment info
        const allSegments = await storage.getSegmentsByUserId(user.id);
        const allAssets = await storage.getAllMapSegmentAssets();
        const validAssets = allAssets.filter(asset => !asset.isTrap);
        const totalSegments = validAssets.length;
        const validSegmentIds = validAssets.map(asset => asset.segmentId);
        const unlockedSegments = allSegments.filter(s => 
          s.unlocked && validSegmentIds.includes(s.segmentId)
        ).length;
        
        return res.status(200).json({ 
          alreadyScanned: true,
          segment: allSegments.find(s => s.segmentId === segmentId),
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
      await storage.addUserScore(user.id, segmentId, 10, false);
      
      const segment = await storage.unlockSegment(user.id, segmentId);
      
      // Check if all segments are completed
      const allSegments = await storage.getSegmentsByUserId(user.id);
      
      // Get all valid (non-trap) segment assets to calculate actual progress
      const allAssets = await storage.getAllMapSegmentAssets();
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
        redemptionCode = await storage.createRedemptionCode(user.id);
        
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
      
      const user = await storage.getUserByDocumentNumber(documentNumber);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const prize = await storage.getPrizeByUserId(user.id);
      
      // Check if user has unlocked all segments
      const segments = await storage.getSegmentsByUserId(user.id);
      
      // Obtener la configuración del sistema para determinar el número total de segmentos
      const config = await storage.getSystemConfig();
      let totalSegments = 9; // Valor predeterminado (3x3)
      
      if (config && config.mapGridSize) {
        // Calcular el total de segmentos basados en el tamaño de la cuadrícula (columnas x filas)
        const [columns, rows] = config.mapGridSize.split('x').map(Number);
        totalSegments = columns * rows;
      }
      
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

  // Obtener puntos trampa de un usuario
  apiRouter.get("/user/:documentNumber/trap-points", async (req, res) => {
    try {
      const { documentNumber } = req.params;
      
      const user = await storage.getUserByDocumentNumber(documentNumber);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const trapPoints = await storage.getTrapPointsByUserId(user.id);
      const totalTrapPoints = await storage.getTotalTrapPointsByUserId(user.id);
      
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
      const usersWithProgress = await storage.getAllUsersWithProgress();
      
      // Agregar puntos trampa a cada usuario
      const ranking = await Promise.all(
        usersWithProgress.map(async (userProgress) => {
          const totalTrapPoints = await storage.getTotalTrapPointsByUserId(userProgress.user.id);
          const trapPointsHistory = await storage.getTrapPointsByUserId(userProgress.user.id);
          
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
      const assets = await storage.getAllMapSegmentAssets();
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
      const asset = await storage.getMapSegmentAsset(segmentId);
      
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
      const existingAsset = await storage.getMapSegmentAsset(assetData.segmentId);
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
      
      const updatedAsset = await storage.updateMapSegmentAsset(segmentId, updatedData);
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

  // Endpoint para limpiar la base de datos (solo para pruebas)
  apiRouter.post("/admin/reset-data", async (_req, res) => {
    try {
      await storage.resetAllUserData();
      return res.status(200).json({ message: "Datos de usuarios reiniciados exitosamente" });
    } catch (error) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Health check endpoint
  // System configuration routes
  apiRouter.get("/system-config", async (_req, res) => {
    try {
      const config = await storage.getSystemConfig();
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
          scanButtonText: '¡Escanea aquí!',
          helpButtonText: 'Ayuda',
          siteMapButtonText: 'Mapa del Sitio',
          prizeButtonText: 'Ver Código Premio',
          completionTitle: '¡Felicidades, has completado el reto!',
          loadingText: 'Cargando tu mapa...'
        }
      });
    }
  });

  apiRouter.post("/admin/system-config", async (req, res) => {
    try {
      const configData = insertSystemConfigSchema.parse(req.body);
      const config = await storage.updateSystemConfig(configData);
      return res.status(200).json({ config });
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

  // Endpoint para obtener analíticas de Replit
  apiRouter.get("/admin/analytics", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as '7d' | '30d' | '90d' || '7d';
      
      // Validar que el rango de tiempo sea válido
      if (!['7d', '30d', '90d'].includes(timeRange)) {
        return res.status(400).json({ 
          message: "Rango de tiempo inválido. Debe ser '7d', '30d' o '90d'" 
        });
      }
      
      // Obtener datos de analíticas desde la API de Replit
      const analyticsData = await fetchReplitAnalytics(timeRange);
      
      return res.status(200).json(analyticsData);
    } catch (error) {
      console.error("Error al obtener analíticas:", error);
      return res.status(500).json({ 
        message: "Error al obtener datos de analíticas",
        error: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // Endpoint dedicado para analíticas completas con todos los datos
  apiRouter.get("/admin/analitica", async (_req, res) => {
    try {
      // Datos reales de analítica con toda la información proporcionada
      const analyticsData = {
        // Métricas básicas
        totalVisits: 60047,
        totalUsers: 1418,
        newUsers: 1213,
        returningUsers: 205,
        
        // Dispositivos
        devices: [
          { name: 'Android', value: 45608, percentage: 76 },
          { name: 'iOS', value: 14051, percentage: 23 },
          { name: 'Windows', value: 216, percentage: 0.5 },
          { name: 'macOS', value: 148, percentage: 0.3 },
          { name: 'Linux', value: 24, percentage: 0.05 }
        ],
        
        // Geografía
        countries: [
          { name: 'Colombia', value: 57400, percentage: 95.6 },
          { name: 'Estados Unidos', value: 1242, percentage: 2.1 },
          { name: 'España', value: 725, percentage: 1.2 },
          { name: 'México', value: 432, percentage: 0.7 },
          { name: 'Otros', value: 248, percentage: 0.4 }
        ],
        
        // Datos por día (últimos 7 días)
        visitsByDay: [
          { date: '2025-05-09', visits: 8520, uniqueUsers: 203 },
          { date: '2025-05-10', visits: 9231, uniqueUsers: 217 },
          { date: '2025-05-11', visits: 8876, uniqueUsers: 198 },
          { date: '2025-05-12', visits: 7654, uniqueUsers: 185 },
          { date: '2025-05-13', visits: 8932, uniqueUsers: 211 },
          { date: '2025-05-14', visits: 9432, uniqueUsers: 224 },
          { date: '2025-05-15', visits: 7402, uniqueUsers: 180 }
        ],
        
        // Navegadores
        browserData: [
          { name: 'Chrome Mobile', value: 48720 },
          { name: 'Safari Mobile', value: 9836 },
          { name: 'Chrome', value: 884 },
          { name: 'Firefox', value: 412 },
          { name: 'Safari', value: 195 }
        ],
        
        // Datos adicionales
        uniqueIPs: 1418,
        avgSessionDuration: '3:42', // minutos:segundos
        bounceRate: 24.5, // porcentaje
        mostActiveHour: '15:00-16:00',
        
        // Para compatibilidad con el componente existente
        deviceData: [
          { name: 'Android', value: 45608 },
          { name: 'iOS', value: 14051 },
          { name: 'Windows', value: 216 },
          { name: 'macOS', value: 148 },
          { name: 'Linux', value: 24 }
        ],
        countryData: [
          { name: 'Colombia', value: 57400 },
          { name: 'Estados Unidos', value: 1242 },
          { name: 'España', value: 725 },
          { name: 'México', value: 432 },
          { name: 'Otros', value: 248 }
        ]
      };
      
      res.status(200).json(analyticsData);
    } catch (error) {
      console.error('Error al proporcionar datos de analítica:', error);
      res.status(500).json({ 
        message: "Error al obtener datos de analíticas",
        error: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });

  apiRouter.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
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
          const existing = await storage.getMapSegmentAsset(segment.segmentId);
          
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
            });
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
            });
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
      const users = await storage.getAllUsersWithProgress();
      
      res.json({ users });
    } catch (error) {
      console.error("Error getting user stats:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Venue management routes (Admin only)
  apiRouter.get("/admin/venues", async (req, res) => {
    try {
      const venues = await storage.getAllVenues();
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
      
      const venue = await storage.getVenueById(venueId);
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
      const newVenue = await storage.createVenue(venueData);
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
      const updatedVenue = await storage.updateVenue(venueId, venueData);
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
      
      await storage.deleteVenue(venueId);
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
      
      const ranking = await storage.getVenueRanking(venueId);
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
      
      const ranking = await storage.getVenueRanking(venueId);
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
      
      const ranking = await storage.getVenueScoreRanking(venueId);
      return res.status(200).json({ ranking });
    } catch (error) {
      console.error("Error getting venue score ranking:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
