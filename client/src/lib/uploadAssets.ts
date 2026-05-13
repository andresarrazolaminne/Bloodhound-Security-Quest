import { getApiCampaignSlug, withApiBase } from "./paths";

function adminFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const slug = getApiCampaignSlug();
  if (slug) headers["x-campaign-slug"] = slug;
  const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("adminApiToken") : null;
  if (token) headers["x-admin-auth"] = token;
  return headers;
}

export type UploadedAssetDTO = {
  id: number;
  filename: string;
  originalName: string;
  mime: string;
  size: number;
  publicUrl: string;
};

export async function listUploadedAssets(): Promise<UploadedAssetDTO[]> {
  const res = await fetch(withApiBase("/api/admin/uploads"), {
    method: "GET",
    credentials: "include",
    headers: adminFetchHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error listando assets: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { assets: UploadedAssetDTO[] };
  return json.assets ?? [];
}

export async function uploadAsset(file: File): Promise<UploadedAssetDTO> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(withApiBase("/api/admin/uploads"), {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: adminFetchHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error subiendo asset: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { asset: UploadedAssetDTO };
  return json.asset;
}

export async function deleteUploadedAsset(id: number): Promise<void> {
  const res = await fetch(withApiBase(`/api/admin/uploads/${id}`), {
    method: "DELETE",
    credentials: "include",
    headers: adminFetchHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error eliminando asset: ${res.status} ${text}`);
  }
}
