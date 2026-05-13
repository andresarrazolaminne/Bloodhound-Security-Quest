/**
 * Prueba credenciales IAM contra S3: ListPrefix, PutObject, GetObject, DeleteObject.
 * No commitees claves. Usa .env local o variables de entorno.
 *
 * Requerido:
 *   S3_BUCKET, S3_REGION (o AWS_REGION), S3_PREFIX
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * Opcional: S3_PUBLIC_BASE_URL (muestra URL de prueba en navegador)
 *
 * Uso: npm run test:s3-credentials
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

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

  if (!bucket) {
    console.error("Falta S3_BUCKET (ej. fow-tod-data)");
    process.exit(1);
  }
  if (!region) {
    console.error("Falta S3_REGION o AWS_REGION (ej. us-east-1)");
    process.exit(1);
  }
  if (!accessKeyId || !secretAccessKey) {
    console.error(
      "Faltan AWS_ACCESS_KEY_ID y/o AWS_SECRET_ACCESS_KEY del usuario IAM con permisos en el prefijo.",
    );
    process.exit(1);
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const testKey = `${prefix}.bloodhound-credential-test-${Date.now()}.txt`;
  const body = `bloodhound s3 test ${new Date().toISOString()}\n`;

  console.log("Bucket:", bucket);
  console.log("Region:", region);
  console.log("Prefix:", prefix || "(raíz)");
  console.log("");

  try {
    console.log("1) ListObjectsV2 (prefijo)…");
    const listOut = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        MaxKeys: 5,
      }),
    );
    console.log("   OK. Claves de muestra:", listOut.KeyCount ?? 0);
    if (listOut.Contents?.length) {
      for (const o of listOut.Contents.slice(0, 5)) {
        console.log("   -", o.Key);
      }
    }
  } catch (e) {
    console.error("   FALLA (¿s3:ListBucket o condición de prefijo en IAM?):", e);
    process.exit(1);
  }

  try {
    console.log("2) PutObject…", testKey);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: Buffer.from(body, "utf8"),
        ContentType: "text/plain",
      }),
    );
    console.log("   OK.");
  } catch (e) {
    console.error("   FALLA (¿s3:PutObject en arn:.../prefijo/*?):", e);
    process.exit(1);
  }

  try {
    console.log("3) GetObject…");
    const getOut = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: testKey }),
    );
    const text = await getOut.Body?.transformToString();
    if (text !== body) {
      console.error("   FALLA: cuerpo distinto.");
      process.exit(1);
    }
    console.log("   OK.");
  } catch (e) {
    console.error("   FALLA (¿s3:GetObject en la política IAM?):", e);
    process.exit(1);
  }

  const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (publicBase) {
    console.log("4) URL pública (lectura bucket policy):");
    console.log("   ", `${publicBase}/${testKey}`);
  }

  try {
    console.log("5) DeleteObject (limpia prueba)…");
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    console.log("   OK.");
  } catch (e) {
    console.error("   FALLA (¿s3:DeleteObject?):", e);
    console.error("   Borra manualmente en la consola:", testKey);
    process.exit(1);
  }

  console.log("");
  console.log("Todas las comprobaciones pasaron.");
}

main();
