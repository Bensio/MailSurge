# Migration 010 Required: user_email_accounts Table

## Issue
The `user_email_accounts` table does not exist in your database, causing errors when trying to load email accounts.

## Solution
You need to run migration `010_add_user_email_accounts.sql` on your Supabase database.

## Steps to Apply Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase/migrations/010_add_user_email_accounts.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** to execute the migration

### Option 2: Via Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

This will apply all pending migrations.

### Option 3: Manual SQL Execution

1. Connect to your Supabase database
2. Run the SQL from `supabase/migrations/010_add_user_email_accounts.sql`

## What This Migration Does

- Creates the `user_email_accounts` table
- Adds support for Google OAuth, Microsoft OAuth, and ESP (SendGrid/Postmark/etc.) accounts
- Sets up Row Level Security (RLS) policies
- Creates necessary indexes
- Adds triggers for `updated_at` timestamp

## Verification

After running the migration, verify it worked:

```sql
SELECT * FROM user_email_accounts LIMIT 1;
```

If this query runs without errors, the migration was successful.

## Next Steps

After the migration is applied:
1. Refresh the Settings page
2. The Email Accounts section should now work
3. You can connect Gmail accounts or add ESP accounts

