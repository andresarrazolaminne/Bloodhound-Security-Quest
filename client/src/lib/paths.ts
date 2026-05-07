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
const ADMIN_TENANT_KEY = "adminTenantSlug";

/** Primer segmento de ruta reservado (no es slug de campaña para jugadores). */
export const RESERVED_ROUTE_SEGMENTS = new Set(["admin", "admin-login"]);

export function getAdminTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_TENANT_KEY);
}

export function setAdminTenantSlug(slug: string) {
  sessionStorage.setItem(ADMIN_TENANT_KEY, slug);
}

export function clearAdminTenantSlug() {
  sessionStorage.removeItem(ADMIN_TENANT_KEY);
}

export function isGlobalAdminPath(pathname: string = typeof window !== "undefined" ? window.location.pathname : ""): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const login = withUiBase("/admin-login");
  const panel = withUiBase("/admin");
  return normalized === login || normalized === panel || normalized.startsWith(`${panel}/`);
}

/**
 * Slug efectivo de campaña: en jugador la URL manda (evita pedir datos de otro tenant si localStorage
 * aún no se sincronizó); en admin, la selección del panel.
 */
export function getResolvedCampaignSlug(): string | null {
  if (typeof window === "undefined") return null;
  if (isGlobalAdminPath()) {
    return getAdminTenantSlug();
  }
  const fromPath = getCampaignSlugFromPath(window.location.pathname);
  if (fromPath) {
    return fromPath;
  }
  return getActiveCampaignSlug();
}

/** Slug enviado a la API (query + header). */
export function getApiCampaignSlug(): string | null {
  return getResolvedCampaignSlug();
}

export function getCampaignSlugFromPath(pathname: string = window.location.pathname): string | null {
  const normalized = pathname.replace(/\/+$/, "");
  if (!UI_BASE_PATH) {
    const parts = normalized.split("/").filter(Boolean);
    const first = parts[0] || null;
    if (first && RESERVED_ROUTE_SEGMENTS.has(first)) return null;
    return first;
  }
  if (!normalized.startsWith(UI_BASE_PATH)) return null;
  const rest = normalized.slice(UI_BASE_PATH.length);
  const parts = rest.split("/").filter(Boolean);
  const first = parts[0] || null;
  if (first && RESERVED_ROUTE_SEGMENTS.has(first)) return null;
  return first;
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
  const slug = campaignSlug ?? getResolvedCampaignSlug();
  const base = withUiBase("/");
  if (!slug) return withUiBase(path);
  let p = path;
  if (!p.startsWith("/")) p = `/${p}`;
  if (p === "/") return `${base}${slug}/`;
  return `${base}${slug}${p}`;
}

export function withApiBase(apiPath: string): string {
  const slug = getApiCampaignSlug();
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

/** URL absoluta de una ruta de jugador bajo un slug (p. ej. QR unlock). */
export function getPlayerUrl(path: string, campaignSlug: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${withUiCampaign(p, campaignSlug)}`;
}

