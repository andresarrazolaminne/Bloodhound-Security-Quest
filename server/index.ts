import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { tryAutoApplyMultitenantMigration, verifyMultitenantSchema } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const logBodies = process.env.NODE_ENV !== "production";

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (logBodies && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL?.trim()) {
      log("FATAL: En producción debe definirse DATABASE_URL.");
      process.exit(1);
    }
    const adminTok = process.env.ADMIN_API_TOKEN?.trim();
    if (!adminTok || adminTok === "admin123") {
      log(
        "FATAL: En producción define ADMIN_API_TOKEN con un secreto fuerte (nunca el valor por defecto admin123).",
      );
      process.exit(1);
    }
  }

  // Antes de aceptar tráfico: migrar en desarrollo (NODE_ENV !== "production").
  // app.get("env") puede ser "production" con NODE_ENV mal puesto; usamos process.env.
  if (process.env.NODE_ENV !== "production") {
    const migrated = await tryAutoApplyMultitenantMigration(true);
    if (migrated) {
      log("Migración multitenant aplicada al arrancar (modo no producción).");
    }
  }

  const server = await registerRoutes(app);

  const schema = await verifyMultitenantSchema();
  if (!schema.ok) {
    log(`ADVERTENCIA: ${schema.detail ?? "esquema multitenant incompleto"}`);
    log("La API devolverá 503 en rutas con tenant. Revisa DATABASE_URL o ejecuta npm run db:apply-multitenant.");
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    } else {
      console.error("[express]", status, message);
    }
    if (res.headersSent) return;
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT ?? 5000);
  const listenOptions: {
    port: number;
    host: string;
    reusePort?: boolean;
  } = {
    port,
    host: "0.0.0.0",
  };

  // Windows does not support reusePort for this server mode.
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
