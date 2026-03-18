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

export function withApiBase(apiPath: string): string {
  if (!UI_BASE_PATH) return apiPath;

  // Evitar doble prefijo si ya viene prefijado.
  if (apiPath.startsWith(`${UI_BASE_PATH}/api`)) return apiPath;

  if (apiPath.startsWith("/api")) return `${UI_BASE_PATH}${apiPath}`;
  return apiPath;
}

export function getUiBaseUrl(): string {
  return UI_BASE_PATH
    ? `${window.location.origin}${UI_BASE_PATH}`
    : window.location.origin;
}

