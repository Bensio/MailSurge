# Email Account Management - Implementation Plan

## Overview
Transform MailSurge from admin-level SMTP to per-user email account management, making it truly plug-and-play for companies.

## Phase 1: Database & Core Infrastructure

### 1.1 Database Migration
**File:** `supabase/migrations/010_add_user_email_accounts.sql`

**Tasks:**
- Create `user_email_accounts` table with:
  - Basic fields (id, user_id, account_type, email_address, display_name, is_default)
  - Gmail OAuth fields (tokens, expiry)
  - SMTP fields (host, port, user, encrypted password, secure flag)
  - Timestamps and constraints
- Add RLS policies (users can only access their own accounts)
- Add indexes (user_id, email_address, is_default)
- Add unique constraint (user_id + email_address)

**Security:**
- SMTP passwords must be encrypted at rest
- Use environment variable for encryption key
- Never log passwords

### 1.2 Encryption Utility
**File:** `api/lib/encryption.ts`

**Tasks:**
- Create encryption/decryption functions for SMTP passwords
- Use AES-256-GCM or similar
- Store encryption key in environment variable
- Handle key rotation gracefully

### 1.3 Migration Script
**File:** `supabase/migrations/011_migrate_existing_gmail_connections.sql`

**Tasks:**
- Migrate existing Gmail OAuth tokens from `user_metadata` to `user_email_accounts`
- Preserve all existing connections
- Set first account as default if user has Gmail connected

## Phase 2: Backend API

### 2.1 Email Account CRUD Endpoints
**File:** `api/campaigns.ts`

**Endpoints to add:**
- `GET /api/campaigns?type=email-accounts` - List user's email accounts
- `POST /api/campaigns?type=email-accounts` - Create new email account
  - Validate SMTP credentials
  - Encrypt password before storing
  - Set as default if first account
- `PUT /api/campaigns?type=email-accounts&id=xxx` - Update email account
  - Re-encrypt password if changed
  - Handle default account switching
- `DELETE /api/campaigns?type=email-accounts&id=xxx` - Delete email account
  - Prevent deletion if it's the only account
  - Auto-assign new default if deleting default

### 2.2 Test Email Account Endpoint
**File:** `api/campaigns.ts`

**Endpoint:**
- `POST /api/campaigns?type=test-email-account` - Test SMTP connection
  - Validate credentials without saving
  - Send test email to user's email
  - Return success/error with details

### 2.3 Update OAuth Callback
**File:** `api/auth/callback.ts`

**Tasks:**
- After successful Gmail OAuth, create entry in `user_email_accounts`
- Store tokens in new table instead of user_metadata
- Set as default if first account
- Update existing account if email already exists

### 2.4 Refactor Email Service
**File:** `api/lib/email-service.ts`

**Changes:**
- Remove admin-level SMTP fallback
- Accept `emailAccountId` or `emailAccount` object
- Fetch account from database if ID provided
- Decrypt SMTP password when needed
- Support both Gmail OAuth and SMTP from user accounts
- Remove dependency on environment variables for SMTP

### 2.5 Update Campaign Sending
**Files:** `api/inngest.ts`, `api/campaigns/[id].ts`

**Tasks:**
- Fetch user's email accounts
- Use campaign's `from_email_account_id` or default account
- Pass email account to email service
- Handle errors gracefully (account deleted, invalid, etc.)

## Phase 3: Frontend UI

### 3.1 Email Account Management Component
**File:** `src/components/Settings/EmailAccounts.tsx`

**Features:**
- List all email accounts (Gmail OAuth + SMTP)
- Show account status (connected, error, needs refresh)
- Show account type badge
- Show default account indicator
- Add/Edit/Delete buttons
- Set as default button

### 3.2 Add Gmail Account UI
**File:** `src/components/Settings/AddGmailAccount.tsx`

**Features:**
- OAuth flow (already exists, just update to use new table)
- Show connected Gmail accounts
- Disconnect button
- Refresh token button

### 3.3 Add SMTP Account Form
**File:** `src/components/Settings/AddSMTPAccount.tsx`

**Features:**
- Form fields:
  - Email address
  - Display name
  - SMTP host
  - SMTP port
  - SMTP username
  - SMTP password (masked input)
- Test connection button
- Common SMTP presets (Gmail, SendGrid, Mailgun, etc.)
- Validation and error messages

### 3.4 Update Settings Page
**File:** `src/pages/Settings.tsx`

**Tasks:**
- Replace old SMTP section with Email Accounts section
- Integrate EmailAccounts component
- Remove SystemStatus SMTP checks
- Keep Gmail OAuth section (update to use new system)

### 3.5 Email Account Selector in Campaigns
**File:** `src/pages/NewCampaign.tsx`, `src/pages/CampaignDetail.tsx`

**Tasks:**
- Add email account selector dropdown
- Show account email and type
- Default to user's default account
- Store `from_email_account_id` in campaign

## Phase 4: Cleanup & Migration

### 4.1 Remove Admin SMTP System
**Files to update:**
- `api/lib/config-validator.ts` - Remove SMTP validation
- `api/lib/email-service.ts` - Remove SMTP fallback
- `api/inngest.ts` - Remove SMTP checks
- `api/campaigns/[id].ts` - Remove SMTP checks
- `src/components/Settings/SystemStatus.tsx` - Remove SMTP status

### 4.2 Documentation Updates
**Files:**
- Delete `docs/SMTP_SETUP.md`
- Update `docs/QUICK_START.md`
- Update `docs/EMAIL_ARCHITECTURE_PROPOSAL.md` (mark as implemented)
- Create `docs/EMAIL_ACCOUNT_SETUP.md` (user guide)

### 4.3 Environment Variables Cleanup
**Remove from Vercel:**
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

**Add to Vercel:**
- `ENCRYPTION_KEY` (for SMTP password encryption)

## Phase 5: Testing & Validation

### 5.1 Unit Tests
- Email account CRUD operations
- Encryption/decryption
- SMTP connection testing
- Gmail OAuth account creation

### 5.2 Integration Tests
- Complete flow: Add Gmail account → Send campaign
- Complete flow: Add SMTP account → Send campaign
- Account switching in campaigns
- Default account assignment
- Error handling (invalid account, deleted account)

### 5.3 Edge Cases
- User with no email accounts (show helpful message)
- User deletes default account (auto-assign new default)
- Gmail token expires (show refresh option)
- SMTP credentials invalid (show error, allow edit)
- Multiple accounts (switching works correctly)

## Phase 6: Polish & UX

### 6.1 Status Indicators
- Connected (green)
- Error (red with message)
- Needs refresh (yellow for Gmail OAuth)
- Testing (loading state)

### 6.2 Usage Stats
- Emails sent per account
- Last used date
- Success rate (optional)

### 6.3 Helpful Messages
- "No email accounts configured" with setup guide
- "Test connection before saving" reminder
- "This will be your default account" notification
- "Account in use by X campaigns" warning on delete

## Implementation Order

1. **Database & Encryption** (Phase 1) - Foundation
2. **Backend API** (Phase 2) - Core functionality
3. **Frontend UI** (Phase 3) - User interface
4. **Cleanup** (Phase 4) - Remove old system
5. **Testing** (Phase 5) - Validation
6. **Polish** (Phase 6) - UX improvements

## Success Criteria

✅ Users can add multiple Gmail accounts via OAuth  
✅ Users can add multiple custom domain SMTP accounts  
✅ Users can set default email account  
✅ Users can select email account when creating campaigns  
✅ All emails send using selected/default account  
✅ SMTP passwords are encrypted at rest  
✅ Old admin SMTP system completely removed  
✅ System remains under 12 Vercel functions  
✅ All existing functionality preserved  

## Estimated Timeline

- Phase 1: 2-3 hours (database, encryption)
- Phase 2: 3-4 hours (backend API)
- Phase 3: 4-5 hours (frontend UI)
- Phase 4: 1-2 hours (cleanup)
- Phase 5: 2-3 hours (testing)
- Phase 6: 1-2 hours (polish)

**Total: ~13-19 hours of development**

