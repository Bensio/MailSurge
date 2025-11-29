-- Add user email accounts table
-- Supports Google OAuth, Microsoft OAuth, and ESP (SendGrid/Postmark/etc.) domain accounts

CREATE TABLE user_email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('google_oauth', 'microsoft_oauth', 'esp_domain')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- For Google OAuth
  google_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMP WITH TIME ZONE,
  
  -- For Microsoft OAuth
  microsoft_token TEXT,
  microsoft_refresh_token TEXT,
  microsoft_token_expiry TIMESTAMP WITH TIME ZONE,
  
  -- For ESP (SendGrid/Postmark/AWS SES/Mailgun)
  esp_provider TEXT CHECK (esp_provider IN ('sendgrid', 'postmark', 'ses', 'mailgun')),
  esp_api_key_encrypted TEXT, -- Encrypted API key
  domain_name TEXT, -- e.g., company.com
  domain_verified BOOLEAN DEFAULT false,
  domain_verification_token TEXT,
  dkim_public_key TEXT,
  spf_record TEXT,
  dmarc_record TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, email_address)
);

-- Indexes for performance
CREATE INDEX idx_user_email_accounts_user ON user_email_accounts(user_id);
CREATE INDEX idx_user_email_accounts_default ON user_email_accounts(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_user_email_accounts_domain ON user_email_accounts(domain_name) WHERE domain_name IS NOT NULL;
CREATE INDEX idx_user_email_accounts_type ON user_email_accounts(user_id, account_type);

-- Row Level Security
ALTER TABLE user_email_accounts ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own email accounts
CREATE POLICY "Users can view own email accounts" 
  ON user_email_accounts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own email accounts" 
  ON user_email_accounts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email accounts" 
  ON user_email_accounts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email accounts" 
  ON user_email_accounts FOR DELETE 
  USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_email_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_email_accounts_updated_at
  BEFORE UPDATE ON user_email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_email_accounts_updated_at();

-- Add constraint: Only one default account per user
CREATE UNIQUE INDEX idx_user_email_accounts_single_default 
  ON user_email_accounts(user_id) 
  WHERE is_default = true;

