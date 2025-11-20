# Migration 006: Add design_json Column

## ⚠️ Required Migration

You need to run this migration to enable campaign editing functionality.

## How to Run

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/006_add_design_json.sql`
6. Paste it into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)

## What This Migration Does

- Adds `design_json` column to the `campaigns` table
- This column stores the Unlayer email editor design JSON
- Allows campaigns to be edited in the visual editor after creation
- Creates an index for better query performance

## After Running the Migration

- Campaign creation will work properly
- Campaign editing will work (design will load when editing)
- No code changes needed - just run the migration

## Temporary Workaround

If you can't run the migration immediately, the code will automatically retry without `design_json`, but campaign editing won't work until the migration is run.

