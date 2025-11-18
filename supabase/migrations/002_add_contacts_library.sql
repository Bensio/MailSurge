-- Add user_id to contacts table to allow contacts without campaigns
-- Make campaign_id nullable so contacts can exist in a library
-- Add name field for contact names

-- Add user_id column
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add name column (optional)
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Make campaign_id nullable
ALTER TABLE contacts 
  ALTER COLUMN campaign_id DROP NOT NULL;

-- Update existing contacts to set user_id from their campaign
UPDATE contacts 
SET user_id = (
  SELECT user_id FROM campaigns WHERE campaigns.id = contacts.campaign_id
)
WHERE user_id IS NULL;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

-- Drop old unique constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_campaign_email_unique'
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_campaign_email_unique;
  END IF;
END $$;

-- Update unique constraint to allow same email for different campaigns
-- But prevent duplicates within the same campaign
CREATE UNIQUE INDEX IF NOT EXISTS contacts_campaign_email_unique 
  ON contacts(campaign_id, email) 
  WHERE campaign_id IS NOT NULL;

-- Allow same email for user in library (no campaign)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_email_unique 
  ON contacts(user_id, email) 
  WHERE campaign_id IS NULL;

-- Update RLS policies to handle library contacts (contacts without campaigns)
-- Drop old policies that only check campaign_id
DROP POLICY IF EXISTS "Users can view contacts in own campaigns" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in own campaigns" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in own campaigns" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in own campaigns" ON contacts;

-- Drop new policies if they already exist (in case migration was partially run)
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

-- New policies that handle both campaign contacts and library contacts
CREATE POLICY "Users can view own contacts" ON contacts FOR SELECT USING (
  user_id = auth.uid() OR
  campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert own contacts" ON contacts FOR INSERT WITH CHECK (
  user_id = auth.uid() AND (
    campaign_id IS NULL OR
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can update own contacts" ON contacts FOR UPDATE USING (
  user_id = auth.uid() OR
  campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete own contacts" ON contacts FOR DELETE USING (
  user_id = auth.uid() OR
  campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
);

