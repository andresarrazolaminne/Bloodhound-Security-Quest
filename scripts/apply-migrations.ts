/**
 * Aplica todos los archivos .sql en migrations/ en orden lexicográfico (0001_, 0002_, …).
 * Idempotente si cada script usa IF NOT EXISTS u operaciones seguras.
 * Carga .env / .env.local y opcionalmente scripts/lightsail/.env.
 * Uso: npm run db:apply-migrations
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
loadEnv({ path: path.join(repoRoot, "scripts", "lightsail", ".env"), override: true });

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("Falta DATABASE_URL.");
    console.error(
      '  PowerShell: $env:DATABASE_URL="postgresql://..."; npm run db:apply-migrations',
    );
    process.exit(1);
  }

  const migrationsDir = path.join(repoRoot, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.error("No existe la carpeta:", migrationsDir);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No hay archivos .sql en migrations/.");
    return;
  }

  const pool = new pg.Pool({ connectionString });

  try {
    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, "utf8");
      console.log("Aplicando:", file);
      await pool.query(sql);
    }
    console.log("Migraciones aplicadas:", files.join(", "));
  } catch (e) {
    console.error("Error:");
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
