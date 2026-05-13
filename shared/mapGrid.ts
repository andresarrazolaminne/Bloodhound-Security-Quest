/**
 * Celdas del mapa según system_config.mapGridSize (p. ej. "3x3" → 9).
 * Debe coincidir con la lógica de progreso en servidor y seed de map_segments.
 */
export function mapGridCellCount(mapGridSize: string | null | undefined): number {
  const raw = (mapGridSize ?? "3x3").trim();
  const dims = raw.split("x").map((s) => Number.parseInt(String(s).trim(), 10));
  if (dims.length === 2 && dims.every((n) => Number.isFinite(n) && n > 0)) {
    return dims[0] * dims[1];
  }
  return 9;
}

/**
 * IDs de segmentos jugables: siempre 1..N según el grid, más cualquier segmentId
 * definido en assets no trampa (por si hay índices fuera del rango).
 */
export function playableSegmentIdsForCampaign(
  assets: ReadonlyArray<{ segmentId: number; isTrap?: boolean | null }>,
  mapGridSize: string | null | undefined,
): number[] {
  const gridN = mapGridCellCount(mapGridSize);
  const fromGrid = Array.from({ length: gridN }, (_, i) => i + 1);
  const fromAssets = assets
    .filter((a) => !a.isTrap)
    .map((a) => a.segmentId)
    .filter((id) => typeof id === "number" && Number.isFinite(id) && id >= 1);
  return [...new Set([...fromGrid, ...fromAssets])].sort((a, b) => a - b);
}
