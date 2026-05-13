/**
 * Primer segmento de ruta de jugador/admin que NO debe usarse como slug de campaña:
 * colisionan con rutas como /{slug}/map, /{slug}/auth, etc.
 */
export const RESERVED_CAMPAIGN_ROUTE_SEGMENTS = [
  "admin",
  "admin-login",
  "auth",
  "register",
  "map",
  "unlock",
  "ranking",
] as const;

export const RESERVED_CAMPAIGN_ROUTE_SEGMENT_SET = new Set<string>(
  RESERVED_CAMPAIGN_ROUTE_SEGMENTS as unknown as string[],
);
