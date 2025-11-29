# Email Architecture Proposal - Clean & Scalable

## Current Problems
1. **Admin-level SMTP** - Creates confusion, not per-user
2. **Parallel systems** - Gmail OAuth + SMTP fallback creates complexity
3. **Not scalable** - Can't support multiple companies with different domains
4. **Not plug-and-play** - Requires admin configuration

## Proposed Architecture

### Core Principle
**Each user/company manages their own email accounts** - no admin-level configuration needed.

### Email Account Types
1. **Gmail OAuth** (already works)
   - User connects their Gmail account
   - Stored: OAuth tokens in user metadata
   - Use: Gmail API

2. **Custom Domain SMTP** (per-user)
   - User adds their domain email (e.g., `sales@company.com`)
   - Stored: SMTP credentials encrypted in database
   - Use: SMTP via nodemailer

### Database Schema
```sql
CREATE TABLE user_email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('gmail_oauth', 'smtp')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- For Gmail OAuth
  gmail_token TEXT,
  gmail_refresh_token TEXT,
  gmail_token_expiry TIMESTAMP WITH TIME ZONE,
  
  -- For SMTP
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password_encrypted TEXT, -- Encrypted!
  smtp_secure BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, email_address)
);
```

### User Flow
1. **Settings Page** → "Email Accounts" section
2. **Add Gmail Account** → OAuth flow (already works)
3. **Add Custom Domain Email** → Form with:
   - Email address
   - Display name
   - SMTP host (e.g., `smtp.gmail.com`, `smtp.sendgrid.net`)
   - SMTP port (587, 465, etc.)
   - SMTP username
   - SMTP password (encrypted)
   - Test connection button
4. **Set Default** → Choose which account to use by default
5. **Select in Campaign** → Choose which email account to send from

### Email Service Architecture
```typescript
// Unified email service
async function sendEmail(
  contact: EmailContact,
  campaign: EmailCampaign,
  emailAccount: UserEmailAccount, // User's selected account
  trackingToken?: string
): Promise<void> {
  if (emailAccount.account_type === 'gmail_oauth') {
    return sendViaGmailAPI(emailAccount, contact, campaign, trackingToken);
  } else {
    return sendViaSMTP(emailAccount, contact, campaign, trackingToken);
  }
}
```

### Benefits
✅ **Plug-and-play** - Each company configures their own emails  
✅ **Scalable** - No admin bottleneck  
✅ **Flexible** - Support Gmail, custom domains, any SMTP provider  
✅ **Secure** - SMTP passwords encrypted per-user  
✅ **Nimble** - Companies can add/remove accounts instantly  
✅ **Cost-effective** - No central email service costs  

### Migration Path
1. Create `user_email_accounts` table
2. Migrate existing Gmail OAuth connections to new table
3. Remove admin-level SMTP env vars
4. Update Settings UI
5. Update email service to use user accounts
6. Update campaign sending to use selected account

## Implementation Status

✅ **Architecture Approved** - Proceeding with implementation

See `EMAIL_ACCOUNT_IMPLEMENTATION_PLAN.md` for detailed development plan.

## Next Steps
1. ✅ Create database migration for user_email_accounts table
2. ✅ Build encryption utility for SMTP passwords
3. ✅ Create API endpoints for email account management
4. ✅ Build Settings UI for email account management
5. ✅ Update email service to use user accounts
6. ✅ Remove admin-level SMTP system
7. ✅ Test with Gmail OAuth and custom domain SMTP

