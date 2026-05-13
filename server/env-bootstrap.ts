/**
 * Debe ser el primer import de `index.ts`.
 * Carga .env antes de que otros módulos lean process.env (p. ej. `db.ts` crea el pool al importarse).
 */
import { config as loadDotenv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

const _cwd = process.cwd();
function tryLoadEnv(rel: string, override: boolean) {
  const abs = path.join(_cwd, rel);
  if (fs.existsSync(abs)) loadDotenv({ path: abs, override });
}
tryLoadEnv(".env", false);
tryLoadEnv(path.join("scripts", "lightsail", ".env"), false);
tryLoadEnv(".env.local", true);
