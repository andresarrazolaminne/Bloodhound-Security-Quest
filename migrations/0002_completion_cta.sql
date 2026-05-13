-- Botón CTA opcional en el modal de premio (idempotente; PG 11+)
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "completion_cta_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "completion_cta_button_text" text NOT NULL DEFAULT 'Ir al premio';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "completion_cta_url" text NOT NULL DEFAULT '';
