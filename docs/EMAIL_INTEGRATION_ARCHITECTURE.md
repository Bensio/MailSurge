# Email Integration System - Implementation Plan

## Overview
Build a plug-and-play email sending system that allows users to connect their business email domains to our web application with minimal friction, supporting both OAuth and custom domain configurations via ESP (Email Service Provider).

## Architecture Components

### 1. Authentication & Connection Layer

#### OAuth Integration (Google Workspace & Microsoft 365)

**Google Workspace OAuth:**
- Implement Google OAuth 2.0 flow for Gmail API access
- Scopes needed: `gmail.send`, `gmail.readonly` (for tracking)
- Use Google Cloud Console to set up OAuth credentials
- Handle refresh tokens for long-term access
- Support multiple Google accounts per user

**Microsoft 365 OAuth:**
- Implement Microsoft OAuth 2.0 flow for Graph API access
- Scopes needed: `Mail.Send`, `Mail.Read`
- Register app in Azure AD
- Handle refresh tokens
- Support multiple Microsoft accounts per user

**Unified OAuth Connection UI:**
- "Connect with Google Workspace" button
- "Connect with Microsoft 365" button
- Auto-detect which option based on user's email domain if possible
- Show connected accounts with status indicators

#### Domain Verification System (Custom Domains)

**DNS Record Generation:**
- Generate unique verification TXT record
- Generate SPF record instructions
- Generate DKIM keys and DNS records
- Generate DMARC record recommendations
- Provide copy-paste DNS instructions

**Verification Checker:**
- Poll DNS records to confirm setup
- Provide real-time feedback on verification status
- Clear error messages for common misconfigurations
- Auto-verify when DNS records are detected

### 2. Email Service Provider (ESP) Integration

**ESP Options (choose one or support multiple):**
- **SendGrid** - Good developer experience, generous free tier (100 emails/day free)
- **Postmark** - Excellent deliverability, transactional focus (100 emails/month free)
- **AWS SES** - Cost-effective at scale ($0.10 per 1,000 emails)
- **Mailgun** - Good balance of features and pricing (5,000 emails/month free for 3 months)

**ESP Configuration:**
- Set up domain authentication API endpoints
- Implement webhook handlers for:
  - Delivery confirmations
  - Bounce handling
  - Spam complaints
  - Opens/clicks (optional, we have our own tracking)

**Recommendation: Start with SendGrid**
- Easiest to implement
- Good free tier for testing
- Can migrate to others later if needed

### 3. Database Schema

```sql
CREATE TABLE user_email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('google_oauth', 'microsoft_oauth', 'esp_domain')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- For Google OAuth
  google_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMP WITH TIME ZONE,
  
  -- For Microsoft OAuth
  microsoft_token TEXT,
  microsoft_refresh_token TEXT,
  microsoft_token_expiry TIMESTAMP WITH TIME ZONE,
  
  -- For ESP (SendGrid/Postmark/etc.)
  esp_provider TEXT CHECK (esp_provider IN ('sendgrid', 'postmark', 'ses', 'mailgun')),
  esp_api_key_encrypted TEXT, -- Encrypted API key
  domain_name TEXT, -- e.g., company.com
  domain_verified BOOLEAN DEFAULT false,
  domain_verification_token TEXT,
  dkim_public_key TEXT,
  spf_record TEXT,
  dmarc_record TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, email_address)
);

-- Indexes
CREATE INDEX idx_user_email_accounts_user ON user_email_accounts(user_id);
CREATE INDEX idx_user_email_accounts_default ON user_email_accounts(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_user_email_accounts_domain ON user_email_accounts(domain_name) WHERE domain_name IS NOT NULL;
```

### 4. Email Sending Service

**Unified Email Service:**
```typescript
async function sendEmail(
  contact: EmailContact,
  campaign: EmailCampaign,
  emailAccount: UserEmailAccount,
  trackingToken?: string
): Promise<void> {
  switch (emailAccount.account_type) {
    case 'google_oauth':
      return sendViaGoogleAPI(emailAccount, contact, campaign, trackingToken);
    case 'microsoft_oauth':
      return sendViaMicrosoftGraphAPI(emailAccount, contact, campaign, trackingToken);
    case 'esp_domain':
      return sendViaESP(emailAccount, contact, campaign, trackingToken);
  }
}
```

**ESP Integration:**
- Use ESP's API (not SMTP) for better deliverability
- Handle rate limits gracefully
- Track sending quotas
- Use ESP webhooks for delivery status

### 5. User Flow

1. **Settings → Email Accounts**
2. **Add Account Options:**
   - Connect Google Workspace (OAuth)
   - Connect Microsoft 365 (OAuth)
   - Add Custom Domain (ESP setup)
3. **For Custom Domain:**
   - Enter domain name
   - Get DNS records to add
   - Verify domain ownership
   - Configure ESP API key
   - Test connection
4. **Set Default Account**
5. **Select Account in Campaign**

## Implementation Phases

### Phase 1: OAuth Foundations
- Google OAuth (already partially done, enhance)
- Microsoft OAuth (new)
- Database schema for OAuth accounts
- Token refresh logic

### Phase 2: ESP Integration
- Choose ESP (recommend SendGrid to start)
- ESP API integration
- Domain verification system
- DNS record generation
- Webhook handlers

### Phase 3: Unified Service
- Refactor email service to support all three methods
- Update campaign sending
- Account management UI

### Phase 4: Polish
- Status indicators
- Error handling
- Usage tracking
- Documentation

## Benefits

✅ **Professional** - Uses industry-standard ESPs for deliverability  
✅ **Scalable** - ESPs handle infrastructure, we focus on features  
✅ **Cost-effective** - Free tiers available, pay-as-you-scale  
✅ **Plug-and-play** - Companies connect their domains easily  
✅ **Flexible** - Support OAuth (Google/Microsoft) and custom domains  
✅ **Reliable** - ESPs have better deliverability than direct SMTP  

## Cost Analysis

**SendGrid:**
- Free: 100 emails/day
- Essentials ($19.95/mo): 50,000 emails/month
- Pro ($89.95/mo): 100,000 emails/month

**Postmark:**
- Free: 100 emails/month
- Paid: $15/month for 10,000 emails

**AWS SES:**
- $0.10 per 1,000 emails
- Very cost-effective at scale

**Recommendation:** Start with SendGrid free tier, migrate to AWS SES at scale.

