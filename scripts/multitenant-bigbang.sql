-- Big-bang multitenant migration for campaign-based isolation.
-- Run inside a maintenance window and after taking a DB backup.

BEGIN;

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO campaigns (slug, name, is_active)
VALUES ('default', 'Default Campaign', TRUE)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE system_config ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);
ALTER TABLE uploaded_assets ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);
ALTER TABLE map_segments ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);
ALTER TABLE map_segment_assets ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);
ALTER TABLE trap_points ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);
ALTER TABLE user_scores ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id);

UPDATE system_config SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;
UPDATE uploaded_assets SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;
UPDATE venues SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;
UPDATE users SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;
UPDATE map_segments SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;
UPDATE prizes SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;
UPDATE map_segment_assets SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;
UPDATE trap_points SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;
UPDATE user_scores SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'default') WHERE campaign_id IS NULL;

ALTER TABLE system_config ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE uploaded_assets ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE venues ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE map_segments ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE prizes ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE map_segment_assets ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE trap_points ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE user_scores ALTER COLUMN campaign_id SET NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_document_number_unique;
DROP INDEX IF EXISTS users_document_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_campaign_document_unique ON users(campaign_id, document_number);

ALTER TABLE map_segment_assets DROP CONSTRAINT IF EXISTS map_segment_assets_segment_id_unique;
DROP INDEX IF EXISTS map_segment_assets_segment_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS map_segment_campaign_segment_unique ON map_segment_assets(campaign_id, segment_id);

COMMIT;
