-- Add from_email column to campaigns table
-- This allows users to select which email address to send from

ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS from_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.from_email IS 'Email address to send campaign from (must match connected Gmail account)';



