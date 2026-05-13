/**
 * Sube un archivo de prueba al prefijo S3 y lo deja en el bucket (no borra).
 * Usa las mismas variables que test:s3-credentials.
 *
 * Uso: npm run test:s3-upload-sample
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.local"), override: true });
loadEnv({ path: path.join(repoRoot, "scripts", "lightsail", ".env"), override: true });

function normalizePrefix(p: string | undefined): string {
  if (!p || !p.trim()) return "";
  const s = p.replace(/^\/+|\/+$/g, "");
  return s ? `${s}/` : "";
}

async function main() {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = (process.env.S3_REGION || process.env.AWS_REGION)?.trim();
  const prefix = normalizePrefix(process.env.S3_PREFIX ?? "bloodhound");
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    console.error("Faltan S3_BUCKET, S3_REGION (o AWS_REGION), AWS_ACCESS_KEY_ID o AWS_SECRET_ACCESS_KEY.");
    process.exit(1);
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const filename = `sample-upload-${Date.now()}.txt`;
  const key = `${prefix}${filename}`;
  const body = `Archivo de prueba Bloodhound\nISO: ${new Date().toISOString()}\n`;
  const publicVirtualHosted = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(body, "utf8"),
      ContentType: "text/plain; charset=utf-8",
      CacheControl: "max-age=3600",
    }),
  );

  console.log("Subido OK.");
  console.log("Clave (Key):", key);
  console.log("URL (virtual-hosted, lectura pública si aplica política GetObject):");
  console.log(publicVirtualHosted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
