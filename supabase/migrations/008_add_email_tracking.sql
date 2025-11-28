-- Add email open tracking to contacts table
-- This allows tracking when recipients open emails

-- Add tracking fields
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE;

-- Create index for tracking token lookups (for fast tracking endpoint queries)
CREATE INDEX IF NOT EXISTS idx_contacts_tracking_token ON contacts(tracking_token) WHERE tracking_token IS NOT NULL;

-- Create index for open tracking queries
CREATE INDEX IF NOT EXISTS idx_contacts_opened ON contacts(campaign_id, opened_at) WHERE opened_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN contacts.opened_at IS 'Timestamp of first email open';
COMMENT ON COLUMN contacts.open_count IS 'Total number of times email was opened';
COMMENT ON COLUMN contacts.tracking_token IS 'Unique token for tracking pixel URL';

