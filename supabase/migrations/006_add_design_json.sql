-- Add design_json column to campaigns table for storing Unlayer design JSON
-- This allows campaigns to be edited in the visual editor after creation
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS design_json JSONB;

-- Add index for design_json queries (optional, but useful if we search by design)
CREATE INDEX IF NOT EXISTS idx_campaigns_design_json ON campaigns USING GIN (design_json);

-- Add comment
COMMENT ON COLUMN campaigns.design_json IS 'Unlayer email editor design JSON for visual editing';

