-- Añade columnas de pregunta tipo test en map_segment_assets y la tabla de intentos.
-- Idempotente (IF NOT EXISTS). Ejecutar en BDs multitenant que aún no tengan el quiz.
BEGIN;

ALTER TABLE map_segment_assets ADD COLUMN IF NOT EXISTS quiz_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE map_segment_assets ADD COLUMN IF NOT EXISTS quiz_question_html TEXT;
ALTER TABLE map_segment_assets ADD COLUMN IF NOT EXISTS quiz_options JSONB;
ALTER TABLE map_segment_assets ADD COLUMN IF NOT EXISTS quiz_correct_index INTEGER;
ALTER TABLE map_segment_assets ADD COLUMN IF NOT EXISTS quiz_points INTEGER NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS user_segment_quiz_attempts (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  segment_id INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  selected_index INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT user_segment_quiz_campaign_user_segment_unique UNIQUE (campaign_id, user_id, segment_id)
);

CREATE INDEX IF NOT EXISTS user_segment_quiz_attempts_campaign_user_idx
  ON user_segment_quiz_attempts(campaign_id, user_id);

COMMIT;
