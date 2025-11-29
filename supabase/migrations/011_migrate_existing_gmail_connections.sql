-- Migrate existing Gmail OAuth connections from user_metadata to user_email_accounts table
-- This preserves all existing Gmail connections when upgrading to the new system

DO $$
DECLARE
  user_record RECORD;
  gmail_email TEXT;
  account_count INTEGER;
BEGIN
  -- Loop through all users who have Gmail tokens in their metadata
  FOR user_record IN 
    SELECT 
      id,
      raw_user_meta_data,
      raw_app_meta_data
    FROM auth.users
    WHERE (
      raw_user_meta_data->>'gmail_token' IS NOT NULL 
      OR raw_app_meta_data->>'gmail_token' IS NOT NULL
    )
  LOOP
    -- Get Gmail email from metadata
    gmail_email := COALESCE(
      user_record.raw_user_meta_data->>'gmail_email',
      user_record.raw_user_meta_data->>'email'
    );
    
    -- Skip if no email found
    IF gmail_email IS NULL OR gmail_email = '' THEN
      CONTINUE;
    END IF;
    
    -- Check if account already exists
    SELECT COUNT(*) INTO account_count
    FROM user_email_accounts
    WHERE user_id = user_record.id 
      AND email_address = gmail_email;
    
    -- Only migrate if account doesn't already exist
    IF account_count = 0 THEN
      -- Insert into user_email_accounts
      INSERT INTO user_email_accounts (
        user_id,
        account_type,
        email_address,
        display_name,
        is_default,
        google_token,
        google_refresh_token,
        google_token_expiry
      )
      VALUES (
        user_record.id,
        'google_oauth',
        gmail_email,
        'Gmail Account',
        -- Set as default if this is the first account for this user
        NOT EXISTS (
          SELECT 1 FROM user_email_accounts 
          WHERE user_id = user_record.id
        ),
        COALESCE(
          user_record.raw_user_meta_data->>'gmail_token',
          user_record.raw_app_meta_data->>'gmail_token'
        ),
        COALESCE(
          user_record.raw_user_meta_data->>'gmail_refresh_token',
          user_record.raw_app_meta_data->>'gmail_refresh_token'
        ),
        CASE 
          WHEN user_record.raw_user_meta_data->>'gmail_token_expiry' IS NOT NULL THEN
            to_timestamp((user_record.raw_user_meta_data->>'gmail_token_expiry')::bigint / 1000)
          ELSE NULL
        END
      )
      ON CONFLICT (user_id, email_address) DO NOTHING;
      
      RAISE NOTICE 'Migrated Gmail account for user %: %', user_record.id, gmail_email;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration completed';
END $$;

