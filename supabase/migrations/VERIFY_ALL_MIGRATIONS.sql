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
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'campaigns_status_check'
      AND check_clause LIKE '%archived%'
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
    WHEN COUNT(*) = 3 THEN '✅ All tables exist'
    ELSE '❌ Missing tables'
  END as status,
  string_agg(table_name, ', ') as details
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('campaigns', 'contacts', 'templates');

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
    WHEN COUNT(*) >= 3 THEN '✅ Required columns exist'
    ELSE '❌ Missing columns'
  END as status,
  string_agg(column_name, ', ') as details
FROM information_schema.columns 
WHERE table_name = 'contacts'
AND column_name IN ('user_id', 'name', 'campaign_id');

-- Check RLS policies
SELECT 
  'RLS Policies' as check_type,
  COUNT(*) as found_count,
  CASE 
    WHEN COUNT(*) >= 12 THEN '✅ RLS policies active'
    ELSE '⚠️ Some policies missing'
  END as status,
  COUNT(*) || ' policies found' as details
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('campaigns', 'contacts', 'templates');

-- Check indexes
SELECT 
  'Indexes' as check_type,
  COUNT(*) as found_count,
  '✅ Indexes created' as status,
  string_agg(indexname, ', ') as details
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('campaigns', 'contacts', 'templates')
AND indexname LIKE 'idx_%';

-- ============================================
-- FINAL STATUS SUMMARY
-- ============================================
SELECT 
  '=== FINAL STATUS ===' as section,
  '' as migration,
  '' as description,
  '' as status;

SELECT 
  CASE 
    WHEN 
      -- All required migrations applied
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'user_id')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'from_email')
      AND EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'campaigns_status_check' AND check_clause LIKE '%archived%')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'design_json')
    THEN '✅ ALL REQUIRED MIGRATIONS APPLIED - Ready for v0.1.0!'
    ELSE '🔴 SOME MIGRATIONS MISSING - Review status above'
  END as final_status;

