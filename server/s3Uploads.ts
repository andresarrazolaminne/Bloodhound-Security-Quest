import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export function useS3Uploads(): boolean {
  return process.env.UPLOADS_BACKEND?.trim().toLowerCase() === "s3";
}

function normalizePrefix(raw: string | undefined): string {
  const p = (raw ?? "bloodhound").trim().replace(/^\/+|\/+$/g, "");
  return p ? `${p}/` : "";
}

export function getS3Config(): {
  bucket: string;
  region: string;
  prefix: string;
  client: S3Client;
} {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = (process.env.S3_REGION || process.env.AWS_REGION)?.trim();
  if (!bucket) throw new Error("UPLOADS_BACKEND=s3 requiere S3_BUCKET");
  if (!region) throw new Error("UPLOADS_BACKEND=s3 requiere S3_REGION o AWS_REGION");

  const client = new S3Client({
    region,
  });
  return {
    bucket,
    region,
    prefix: normalizePrefix(process.env.S3_PREFIX),
    client,
  };
}

/**
 * Clave de objeto: {prefix}{campaignId}/{filename}
 * `filename` debe ser solo el basename (ej. nanoid + ext).
 */
export function s3ObjectKeyForUpload(campaignId: number, filename: string): string {
  const safeBase = filename.replace(/^\/+/, "").replace(/\.\./g, "");
  if (safeBase.includes("/")) {
    throw new Error("Nombre de archivo inválido para S3");
  }
  const prefix = normalizePrefix(process.env.S3_PREFIX);
  return `${prefix}${campaignId}/${safeBase}`;
}

/**
 * URL pública para el navegador. Preferir S3_PUBLIC_BASE_URL = origen del bucket sin path
 * (ej. https://bucket.s3.region.amazonaws.com) para evitar duplicar el prefijo.
 */
export function publicUrlForS3ObjectKey(key: string): string {
  const base = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (base) {
    const encoded = key.split("/").map(encodeURIComponent).join("/");
    return `${base}/${encoded}`;
  }
  const { bucket, region } = getS3Config();
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `https://${bucket}.s3.${region}.amazonaws.com/${encoded}`;
}

export async function s3PutUploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { bucket, client } = getS3Config();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function s3DeleteObjectKey(key: string): Promise<void> {
  const { bucket, client } = getS3Config();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
