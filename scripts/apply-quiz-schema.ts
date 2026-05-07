/**
 * Aplica scripts/apply-quiz-schema.sql (columnas quiz + user_segment_quiz_attempts).
 * Carga .env / .env.local. Uso: npm run db:apply-quiz-schema
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
    console.error("Falta DATABASE_URL.");
    console.error('  PowerShell: $env:DATABASE_URL="postgresql://..."; npm run db:apply-quiz-schema');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, "apply-quiz-schema.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("No se encuentra:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const pool = new pg.Pool({ connectionString });

  try {
    console.log("Aplicando esquema de quiz (map_segment_assets + user_segment_quiz_attempts)…");
    await pool.query(sql);
    console.log("OK.");
  } catch (e) {
    console.error("Error al aplicar SQL:");
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
