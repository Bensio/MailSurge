-- MailSurge v0.1.0 - Complete Migration Verification Script
-- Run this in Supabase SQL Editor to check migration status

-- ============================================
-- MIGRATION 001: Initial Schema
-- ============================================
SELECT 
  '001_initial_schema' as migration,
  'Tables, RLS, Indexes' as description,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'campaigns'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'contacts'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'templates'
    ) THEN '✅ Applied'
    ELSE '❌ Not Applied'
  END as status;

-- ============================================
-- MIGRATION 002: Contacts Library
-- ============================================
SELECT 
  '002_contacts_library' as migration,
  'user_id, name columns, library support' as description,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      AND column_name = 'name'
    ) THEN '✅ Applied'
    ELSE '❌ Not Applied'
  END as status;

-- ============================================
-- MIGRATION 003: From Email
-- ============================================
SELECT 
  '003_from_email' as migration,
  'from_email column in campaigns' as description,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaigns' 
      AND column_name = 'from_email'
    ) THEN '✅ Applied'
    ELSE '❌ Not Applied'
  END as status;

-- ============================================
-- MIGRATION 004: Archived Status
-- ============================================
SELECT 
  '004_archived_status' as migration,
  'archived status in campaigns' as description,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'campaigns'
      AND tc.constraint_type = 'CHECK'
      AND cc.check_clause LIKE '%archived%'
    ) THEN '✅ Applied'
    ELSE '❌ Not Applied'
  END as status;

-- ============================================
-- MIGRATION 005: Remove Duplicates (Optional)
-- ============================================
SELECT 
  '005_remove_duplicates' as migration,
  'Optional cleanup script' as description,
  '⚠️ Optional - Run only if duplicates exist' as status;

-- ============================================
-- MIGRATION 006: Design JSON (CRITICAL)
-- ============================================
SELECT 
  '006_design_json' as migration,
  'design_json column for campaign editing' as description,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaigns' 
      AND column_name = 'design_json'
    ) AND EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'campaigns' 
      AND indexname = 'idx_campaigns_design_json'
    ) THEN '✅ Applied'
    ELSE '🔴 CRITICAL - Not Applied'
  END as status;

-- ============================================
-- MIGRATION 007: Reminder System
-- ============================================
SELECT 
  '007_reminder_system' as migration,
  'reminder_rules and reminder_queue tables' as description,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'reminder_rules'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'reminder_queue'
    ) THEN '✅ Applied'
    ELSE '❌ Not Applied'
  END as status;

-- ============================================
-- MIGRATION 008: Email Tracking
-- ============================================
SELECT 
  '008_email_tracking' as migration,
  'opened_at, open_count, tracking_token in contacts' as description,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      AND column_name = 'opened_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      AND column_name = 'open_count'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      AND column_name = 'tracking_token'
    ) THEN '✅ Applied'
    ELSE '❌ Not Applied'
  END as status;

-- ============================================
-- DETAILED SCHEMA CHECK
-- ============================================
SELECT 
  '=== DETAILED SCHEMA CHECK ===' as section,
  '' as migration,
  '' as description,
  '' as status;

-- Check all required tables
SELECT 
  'Tables' as check_type,
  COUNT(*) as found_count,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅ All tables exist'
    ELSE '❌ Missing tables'
  END as status,
  string_agg(table_name, ', ') as details
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('campaigns', 'contacts', 'templates', 'reminder_rules', 'reminder_queue');

-- Check campaigns columns
SELECT 
  'Campaigns Columns' as check_type,
  COUNT(*) as found_count,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Required columns exist'
    ELSE '❌ Missing columns'
  END as status,
  string_agg(column_name, ', ') as details
FROM information_schema.columns 
WHERE table_name = 'campaigns'
AND column_name IN ('from_email', 'design_json', 'status');

-- Check contacts columns
SELECT 
  'Contacts Columns' as check_type,
  COUNT(*) as found_count,
  CASE 
    WHEN COUNT(*) >= 6 THEN '✅ Required columns exist'
    ELSE '❌ Missing columns'
  END as status,
  string_agg(column_name, ', ') as details
FROM information_schema.columns 
WHERE table_name = 'contacts'
AND column_name IN ('user_id', 'name', 'campaign_id', 'opened_at', 'open_count', 'tracking_token');

-- Check RLS policies
SELECT 
  'RLS Policies' as check_type,
  COUNT(*) as found_count,
  CASE 
    WHEN COUNT(*) >= 18 THEN '✅ RLS policies active'
    ELSE '⚠️ Some policies missing'
  END as status,
  COUNT(*) || ' policies found' as details
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('campaigns', 'contacts', 'templates', 'reminder_rules', 'reminder_queue');

-- Check indexes
SELECT 
  'Indexes' as check_type,
  COUNT(*) as found_count,
  '✅ Indexes created' as status,
  string_agg(indexname, ', ') as details
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('campaigns', 'contacts', 'templates', 'reminder_rules', 'reminder_queue')
AND indexname LIKE 'idx_%';

-- ============================================
-- FINAL STATUS SUMMARY
-- ============================================
SELECT 
  '=== FINAL STATUS ===' as section,
  '' as migration,
  '' as description,
  '' as status;


-- ============================================
-- FINAL STATUS - DETAILED BREAKDOWN
-- ============================================
SELECT 
  '=== FINAL STATUS DETAILS ===' as section,
  '' as migration,
  '' as description,
  '' as status;

-- Check each migration and list what's missing
SELECT 
  'Missing Migrations' as category,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns')
      OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts')
      OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'templates')
    THEN '❌ 001_initial_schema.sql'
    ELSE '✅ 001_initial_schema.sql'
  END as migration_001,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'user_id')
      OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'name')
    THEN '❌ 002_add_contacts_library.sql'
    ELSE '✅ 002_add_contacts_library.sql'
  END as migration_002,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'from_email')
    THEN '❌ 003_add_from_email.sql'
    ELSE '✅ 003_add_from_email.sql'
  END as migration_003,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'campaigns'
      AND tc.constraint_type = 'CHECK'
      AND cc.check_clause LIKE '%archived%'
    )
    THEN '❌ 004_add_archived_status.sql'
    ELSE '✅ 004_add_archived_status.sql'
  END as migration_004,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'design_json')
    THEN '❌ 006_add_design_json.sql'
    ELSE '✅ 006_add_design_json.sql'
  END as migration_006,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_rules')
      OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_queue')
    THEN '❌ 007_add_reminder_system.sql'
    ELSE '✅ 007_add_reminder_system.sql'
  END as migration_007,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'opened_at')
      OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'tracking_token')
    THEN '❌ 008_add_email_tracking.sql'
    ELSE '✅ 008_add_email_tracking.sql'
  END as migration_008;

-- Final summary with exact list of missing migrations
SELECT 
  '=== SUMMARY ===' as info,
  CASE 
    WHEN 
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'templates')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'user_id')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'from_email')
      AND EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'campaigns'
        AND tc.constraint_type = 'CHECK'
        AND cc.check_clause LIKE '%archived%'
      )
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'design_json')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_rules')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_queue')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'opened_at')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'tracking_token')
    THEN '✅ ALL REQUIRED MIGRATIONS APPLIED - Ready with Reminders & Tracking!'
    ELSE CONCAT(
      '🔴 MISSING MIGRATIONS: ',
      CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN '001 ' ELSE '' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'user_id') THEN '002 ' ELSE '' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'from_email') THEN '003 ' ELSE '' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'campaigns'
        AND tc.constraint_type = 'CHECK'
        AND cc.check_clause LIKE '%archived%'
      ) THEN '004 ' ELSE '' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'design_json') THEN '006 ' ELSE '' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_rules') THEN '007 ' ELSE '' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'tracking_token') THEN '008 ' ELSE '' END
    )
  END as final_status;

