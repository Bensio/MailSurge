-- Diagnostic query to identify exactly which migrations are missing
-- Run this to see detailed status of each migration

-- Check Migration 007: Reminder System
SELECT 
  'Migration 007: Reminder System' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reminder_rules') 
      THEN '✅ reminder_rules table exists'
    ELSE '❌ reminder_rules table MISSING'
  END as reminder_rules_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reminder_queue') 
      THEN '✅ reminder_queue table exists'
    ELSE '❌ reminder_queue table MISSING'
  END as reminder_queue_status;

-- Check Migration 008: Email Tracking
SELECT 
  'Migration 008: Email Tracking' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'opened_at') 
      THEN '✅ opened_at column exists'
    ELSE '❌ opened_at column MISSING'
  END as opened_at_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'open_count') 
      THEN '✅ open_count column exists'
    ELSE '❌ open_count column MISSING'
  END as open_count_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'tracking_token') 
      THEN '✅ tracking_token column exists'
    ELSE '❌ tracking_token column MISSING'
  END as tracking_token_status;

-- List all tables to verify
SELECT 
  'All Tables' as info,
  table_name,
  'Table exists' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- List all contacts columns to verify
SELECT 
  'Contacts Columns' as info,
  column_name,
  data_type,
  'Column exists' as status
FROM information_schema.columns 
WHERE table_name = 'contacts'
AND table_schema = 'public'
ORDER BY column_name;

-- Quick fix: Show what needs to be run
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reminder_rules')
      THEN '🔴 RUN: 007_add_reminder_system.sql'
    ELSE '✅ Migration 007 already applied'
  END as action_007,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'tracking_token')
      THEN '🔴 RUN: 008_add_email_tracking.sql'
    ELSE '✅ Migration 008 already applied'
  END as action_008;

