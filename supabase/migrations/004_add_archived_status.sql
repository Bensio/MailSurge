-- Add 'archived' status to campaigns table
-- This allows users to archive completed campaigns

ALTER TABLE campaigns 
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns 
  ADD CONSTRAINT campaigns_status_check 
  CHECK (status IN ('draft', 'sending', 'paused', 'completed', 'failed', 'archived'));



