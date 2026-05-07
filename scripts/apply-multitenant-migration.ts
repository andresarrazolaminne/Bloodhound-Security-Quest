/**
 * Aplica scripts/multitenant-bigbang.sql usando la misma conexión que la app (DATABASE_URL).
 * Carga .env / .env.local en la raíz del repo si existen.
 * Uso (PowerShell):  $env:DATABASE_URL="postgresql://..."; npm run db:apply-multitenant
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.local"), override: true });

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("Falta DATABASE_URL. Ejemplo (PowerShell):");
    console.error('  $env:DATABASE_URL="postgresql://user:pass@host:5432/db"; npm run db:apply-multitenant');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, "multitenant-bigbang.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("No se encuentra:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const pool = new pg.Pool({ connectionString });

  try {
    console.log("Aplicando migración multitenant…");
    await pool.query(sql);
    const r = await pool.query("SELECT id, slug, name FROM campaigns ORDER BY id");
    console.log("OK. Campañas:", r.rows);
  } catch (e) {
    console.error("Error al aplicar SQL:");
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
