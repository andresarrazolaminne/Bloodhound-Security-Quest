/**
 * Renombra una campaña con slug `map` (colisión con la ruta /{campaign}/map).
 * Uso: npx tsx scripts/fix-colliding-map-campaign-slug.ts
 * Requiere DATABASE_URL.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { campaigns } from "@shared/schema";
import { db } from "../server/db";

const OLD_SLUG = "map";
const NEW_SLUG = "legacy-map";

async function main() {
  const rows = await db.select().from(campaigns).where(eq(campaigns.slug, OLD_SLUG));
  if (rows.length === 0) {
    console.log(`No hay campaña con slug '${OLD_SLUG}'.`);
    return;
  }
  const [taken] = await db.select().from(campaigns).where(eq(campaigns.slug, NEW_SLUG)).limit(1);
  if (taken) {
    console.error(`Ya existe la slug '${NEW_SLUG}'. Cambia NEW_SLUG en el script o resuelve el conflicto.`);
    process.exit(1);
  }
  const row = rows[0];
  await db
    .update(campaigns)
    .set({ slug: NEW_SLUG, updatedAt: new Date() })
    .where(eq(campaigns.id, row.id));
  console.log(`OK: campaña id=${row.id} renombrada '${OLD_SLUG}' → '${NEW_SLUG}'.`);
  console.log("Vuelve a elegir el tenant en admin si usabas esa campaña.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
