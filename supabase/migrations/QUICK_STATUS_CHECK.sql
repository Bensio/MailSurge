-- Quick status check for all migrations
-- This will show exactly which ones are missing

SELECT 'MIGRATION STATUS CHECK' as info;

-- Migration 001
SELECT 
  '001: Initial Schema' as migration,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'templates')
    THEN '✅ Applied'
    ELSE '❌ MISSING'
  END as status;

-- Migration 002
SELECT 
  '002: Contacts Library' as migration,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'user_id')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'name')
    THEN '✅ Applied'
    ELSE '❌ MISSING'
  END as status;

-- Migration 003
SELECT 
  '003: From Email' as migration,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'from_email')
    THEN '✅ Applied'
    ELSE '❌ MISSING'
  END as status;

-- Migration 004 - Check differently
SELECT 
  '004: Archived Status' as migration,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'campaigns'
      AND tc.constraint_type = 'CHECK'
      AND cc.check_clause LIKE '%archived%'
    )
    THEN '✅ Applied'
    ELSE '❌ MISSING - Check campaigns status constraint'
  END as status;

-- Migration 006
SELECT 
  '006: Design JSON' as migration,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'design_json')
    THEN '✅ Applied'
    ELSE '❌ MISSING'
  END as status;

-- Migration 007
SELECT 
  '007: Reminder System' as migration,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_rules')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_queue')
    THEN '✅ Applied'
    ELSE '❌ MISSING'
  END as status;

-- Migration 008
SELECT 
  '008: Email Tracking' as migration,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'opened_at')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'tracking_token')
    THEN '✅ Applied'
    ELSE '❌ MISSING'
  END as status;

-- Check campaigns status constraint directly
SELECT 
  'Campaigns Status Constraint Details' as info,
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
AND constraint_name LIKE '%campaigns%status%';

-- Alternative check for archived status
SELECT 
  'Alternative: Check campaigns table definition' as info,
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'campaigns'
AND column_name = 'status';

