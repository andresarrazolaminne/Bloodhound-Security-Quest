// Centraliza el prefijo del deployment (por ejemplo: /bloodhound)
// para que el frontend funcione en sub-rutas y no "apunte" al root (/).

function normalizeBasePath(input: string | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  let p = raw;
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+$/, ""); // quitar trailing slash

  // Si alguien pone "/", el prefijo efectivo es vacío.
  if (p === "/") return "";
  return p;
}

export const UI_BASE_PATH = normalizeBasePath(
  import.meta.env.VITE_BASE_PATH as string | undefined,
);

const CAMPAIGN_STORAGE_KEY = "activeCampaignSlug";

export function getCampaignSlugFromPath(pathname: string = window.location.pathname): string | null {
  const normalized = pathname.replace(/\/+$/, "");
  if (!UI_BASE_PATH) {
    const parts = normalized.split("/").filter(Boolean);
    return parts[0] || null;
  }
  if (!normalized.startsWith(UI_BASE_PATH)) return null;
  const rest = normalized.slice(UI_BASE_PATH.length);
  const parts = rest.split("/").filter(Boolean);
  return parts[0] || null;
}

export function setActiveCampaignSlug(slug: string) {
  localStorage.setItem(CAMPAIGN_STORAGE_KEY, slug);
}

export function getActiveCampaignSlug(): string | null {
  return localStorage.getItem(CAMPAIGN_STORAGE_KEY);
}

export function withUiBase(path: string): string {
  // Permitir path '' (útil para algunos casos)
  const raw = path ?? "";

  if (!UI_BASE_PATH) {
    // Mantener "/" como "/" (no ''), y lo demás igual.
    return raw === "" ? "/" : raw;
  }

  // Asegurar que empiece con "/"
  let p = raw;
  if (!p.startsWith("/")) p = `/${p}`;

  // Idempotente: si ya está prefijado, no duplicar.
  if (p === UI_BASE_PATH || p.startsWith(`${UI_BASE_PATH}/`)) return p;

  // Caso especial: "/" -> "/bloodhound/"
  if (p === "/") return `${UI_BASE_PATH}/`;

  return `${UI_BASE_PATH}${p}`;
}

export function withUiCampaign(path: string, campaignSlug?: string | null): string {
  const slug = campaignSlug ?? getActiveCampaignSlug();
  const base = withUiBase("/");
  if (!slug) return withUiBase(path);
  let p = path;
  if (!p.startsWith("/")) p = `/${p}`;
  if (p === "/") return `${base}${slug}/`;
  return `${base}${slug}${p}`;
}

export function withApiBase(apiPath: string): string {
  const slug = getActiveCampaignSlug();
  const addCampaignQuery = (value: string) => {
    if (!slug || (!value.startsWith("/api") && !value.includes("/api"))) return value;
    const separator = value.includes("?") ? "&" : "?";
    if (value.includes("campaignSlug=")) return value;
    return `${value}${separator}campaignSlug=${encodeURIComponent(slug)}`;
  };

  if (!UI_BASE_PATH) return addCampaignQuery(apiPath);

  // Evitar doble prefijo si ya viene prefijado.
  if (apiPath.startsWith(`${UI_BASE_PATH}/api`)) {
    return addCampaignQuery(apiPath);
  }

  if (apiPath.startsWith("/api")) return addCampaignQuery(`${UI_BASE_PATH}${apiPath}`);
  return apiPath;
}

export function getUiBaseUrl(): string {
  return UI_BASE_PATH
    ? `${window.location.origin}${UI_BASE_PATH}`
    : window.location.origin;
}

