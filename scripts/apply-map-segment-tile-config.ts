/**
 * Aplica columnas map_segment_aspect_ratio y map_segment_image_fit en system_config.
 * Carga .env / .env.local y opcionalmente scripts/lightsail/.env.
 * Uso: DATABASE_URL="postgresql://..." npm run db:apply-map-segment-tile-config
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
      '  PowerShell: $env:DATABASE_URL="postgresql://..."; npm run db:apply-map-segment-tile-config',
    );
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, "apply-map-segment-tile-config.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("No se encuentra:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const pool = new pg.Pool({ connectionString });

  try {
    console.log("Aplicando columnas map_segment_* en system_config…");
    await pool.query(sql);
    console.log("SQL aplicado.");

    const verify = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'system_config'
       AND column_name IN ('map_segment_aspect_ratio', 'map_segment_image_fit')
       ORDER BY column_name`,
    );
    const names = verify.rows.map((r) => r.column_name);
    if (names.length !== 2) {
      console.error("Verificación fallida. Columnas encontradas:", names.join(", ") || "(ninguna)");
      process.exit(1);
    }
    console.log("Verificación OK:", names.join(", "));
  } catch (e) {
    console.error("Error:");
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
