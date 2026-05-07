/**
 * Uso: npx tsx scripts/debug-user-tenant.ts [documentNumber]
 * Requiere DATABASE_URL (.env o entorno).
 */
import "dotenv/config";
import { storage } from "../server/storage";

const doc = (process.argv[2] || "79953471").trim();

async function main() {
  const defaultCampaign = await storage.getCampaignBySlug("default");
  console.log("Campaña 'default':", defaultCampaign ?? "(no existe fila)");

  const userDefaultSlug = await storage.getUserByDocumentNumber(doc, defaultCampaign?.id);
  const userResolvedDefault = await storage.getUserByDocumentNumber(doc);

  console.log(`Usuario ${doc} en campaignId default (${defaultCampaign?.id}):`, userDefaultSlug ?? "(null)");
  console.log(`Usuario ${doc} getUserByDocumentNumber(doc) (resolve interno):`, userResolvedDefault ?? "(null)");

  const campaigns = await storage.listCampaigns();
  console.log("Campañas:", campaigns.map((c) => `${c.slug}#${c.id}`).join(", "));
  for (const c of campaigns) {
    const u = await storage.getUserByDocumentNumber(doc, c.id);
    if (u) console.log(`  → encontrado en [${c.slug}] user id=${u.id} campaignId=${u.campaignId}`);
    else if (["map", "default"].includes(c.slug)) {
      console.log(`  → NO en [${c.slug}]`);
    }
  }

  if (defaultCampaign && userDefaultSlug) {
    const segs = await storage.getSegmentsByUserId(userDefaultSlug.id, defaultCampaign.id);
    console.log("Segmentos (default):", segs.length, segs.map((s) => s.segmentId));
    const assets = await storage.getAllMapSegmentAssets(defaultCampaign.id);
    console.log("Map assets (default):", assets.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
