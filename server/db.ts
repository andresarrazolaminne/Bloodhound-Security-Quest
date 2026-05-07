import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Create a PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });

// Health check function
export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    console.error("Database connection error:", err);
    return false;
  }
}

/** Comprueba que exista el esquema multitenant (tabla campaigns). */
export async function verifyMultitenantSchema(): Promise<{ ok: boolean; detail?: string }> {
  if (!connectionString) {
    return { ok: false, detail: "DATABASE_URL no está definida" };
  }
  try {
    const r = await pool.query<{ c: string | null }>(
      "SELECT to_regclass('public.campaigns')::text AS c",
    );
    if (!r.rows[0]?.c) {
      return {
        ok: false,
        detail:
          "Falta la tabla public.campaigns. Ejecuta: npm run db:apply-multitenant (con DATABASE_URL)",
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Error al comprobar el esquema",
    };
  }
}

/** Ejecuta scripts/multitenant-bigbang.sql (misma conexión que la app). */
export async function applyMultitenantBigBangSql(): Promise<void> {
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida");
  }
  const sqlPath = path.resolve(import.meta.dirname, "..", "scripts", "multitenant-bigbang.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`No se encuentra el archivo de migración: ${sqlPath}`);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  await pool.query(sql);
}

/**
 * Solo desarrollo: si falta la tabla campaigns, aplica el SQL automáticamente.
 * Desactivar: DISABLE_AUTO_MULTITENANT_MIGRATE=1
 */
export async function tryAutoApplyMultitenantMigration(isDevelopment: boolean): Promise<boolean> {
  if (!isDevelopment) return false;
  if (process.env.DISABLE_AUTO_MULTITENANT_MIGRATE === "1" || process.env.DISABLE_AUTO_MULTITENANT_MIGRATE === "true") {
    return false;
  }
  const before = await verifyMultitenantSchema();
  if (before.ok) return false;
  if (!connectionString) {
    console.error("[db] Auto-migración omitida: DATABASE_URL no definida");
    return false;
  }
  try {
    console.log("[db] Aplicando migración multitenant (modo desarrollo)…");
    await applyMultitenantBigBangSql();
    const after = await verifyMultitenantSchema();
    if (!after.ok) {
      console.error("[db] Tras migrar, el esquema sigue incompleto:", after.detail);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[db] Falló la auto-migración multitenant:", e);
    return false;
  }
}

export { pool };