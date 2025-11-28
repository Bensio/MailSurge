# Migration Quick Start - v0.1.0

**For:** Supabase SQL Editor  
**Time Required:** 10-15 minutes

---

## 🎯 Quick Steps

### Step 1: Run Verification Script First

1. Open Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/VERIFY_ALL_MIGRATIONS.sql`
3. Copy entire file
4. Paste into SQL Editor
5. Click **Run**
6. Review results - see which migrations are missing

---

### Step 2: Execute Missing Migrations

Based on your 6 SQL Editor tabs, here's what to run:

#### ✅ Tab 1: "SQL Email Campaigns, Contacts & Templates Schema"
**File:** `001_initial_schema.sql`  
**Action:** Copy → Paste → Run  
**Verify:** Should create 3 tables (campaigns, contacts, templates)

#### ✅ Tab 2: "SQL Contacts: user library and campaign support"  
**File:** `002_add_contacts_library.sql`  
**Action:** Copy → Paste → Run  
**Verify:** Adds user_id and name columns to contacts

#### ✅ Tab 3: "SQL Add from_email to campaigns"
**File:** `003_add_from_email.sql`  
**Action:** Copy → Paste → Run  
**Verify:** Adds from_email column to campaigns

#### ⚠️ Tab 4: "SQL Missing migration contents"
**Action:** Check what's in this tab - might be Migration 004 or empty

#### ✅ Tab 5: "SQL Remove duplicate library contacts"
**File:** `005_remove_duplicate_library_contacts.sql`  
**Action:** Only run if you have duplicate contacts (optional)

#### 🔴 Tab 6: "SQL Campaigns design_json for Unlayer editor" (CURRENTLY OPEN)
**File:** `006_add_design_json.sql`  
**Action:** Copy → Paste → Run  
**Status:** **CRITICAL - Required for campaign editing**

---

### Step 3: Handle Missing Migration 004

If Migration 004 is not in your tabs:

1. Open `supabase/migrations/004_add_archived_status.sql`
2. Copy entire contents
3. New Query in Supabase SQL Editor
4. Paste and Run

---

### Step 4: Final Verification

Run the verification script again:
```sql
-- Quick check
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'design_json')
    THEN '✅ Migration 006 Applied'
    ELSE '🔴 Migration 006 Missing'
  END as status_006,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'campaigns_status_check' AND check_clause LIKE '%archived%')
    THEN '✅ Migration 004 Applied'
    ELSE '🔴 Migration 004 Missing'
  END as status_004;
```

---

## ✅ Success Criteria

All migrations successful when:
- ✅ Verification script shows all migrations applied
- ✅ No errors in Supabase logs
- ✅ All 3 tables exist (campaigns, contacts, templates)
- ✅ design_json column exists in campaigns
- ✅ from_email column exists in campaigns
- ✅ user_id column exists in contacts
- ✅ archived status allowed in campaigns

---

## 🚨 Common Issues

### "Column already exists"
- ✅ This is OK - migration already applied
- Skip to next migration

### "Table doesn't exist"
- ❌ Run Migration 001 first
- Check table name spelling

### "Constraint already exists"
- ✅ This is OK - constraint already applied
- Migration uses IF NOT EXISTS

---

## 📋 Migration Checklist

- [ ] Migration 001 - Initial Schema
- [ ] Migration 002 - Contacts Library
- [ ] Migration 003 - From Email
- [ ] Migration 004 - Archived Status
- [ ] Migration 005 - Remove Duplicates (optional)
- [ ] Migration 006 - Design JSON (CRITICAL)
- [ ] Verification script passes
- [ ] All tables and columns exist

---

## 🎉 Ready for v0.1.0!

Once all migrations are verified:
- [ ] All 6 migrations executed
- [ ] Verification queries pass
- [ ] No errors
- [ ] Ready to tag v0.1.0

---

**Next:** See `V0.1_PREPARATION.md` for complete preparation guide.

