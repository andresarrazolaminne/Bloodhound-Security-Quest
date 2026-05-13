-- Proporción de fichas del mapa y object-fit (idempotente; PG 11+)
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "map_segment_aspect_ratio" text NOT NULL DEFAULT '1/1';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "map_segment_image_fit" text NOT NULL DEFAULT 'cover';
