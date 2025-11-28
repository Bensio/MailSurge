# Email Open Tracking System

## Overview

MailSurge now includes email open tracking that works with **any email provider** (Gmail, Outlook, custom SMTP, etc.). The system uses tracking pixels (1x1 transparent images) to detect when recipients open emails.

## How It Works

### 1. **Tracking Pixel Injection**
- When an email is sent, a unique tracking token is generated
- A 1x1 transparent PNG pixel is injected into the HTML email
- The pixel URL points to: `/api/track/open/[token]`

### 2. **Open Detection**
- When the recipient opens the email, their email client loads the tracking pixel
- This triggers a request to our tracking endpoint
- The endpoint records the open event in the database

### 3. **Database Storage**
- `opened_at`: Timestamp of first open
- `open_count`: Total number of times the email was opened
- `tracking_token`: Unique token for each email send

## Architecture

### Provider-Agnostic Design

The tracking system is designed to work with **any email provider**:

```
┌─────────────────┐
│  Email Provider │  (Gmail, Outlook, SMTP, etc.)
│                 │
│  Sends email    │
│  with tracking  │
│  pixel          │
└────────┬────────┘
         │
         │ Recipient opens email
         │
         ▼
┌─────────────────┐
│  Tracking Pixel │  /api/track/open/[token]
│  Endpoint       │
│                 │
│  Records open   │
│  in database    │
└─────────────────┘
```

### Key Components

1. **`api/lib/tracking.ts`**: Provider-agnostic tracking utilities
   - `generateTrackingToken()`: Creates unique tokens
   - `injectTrackingPixel()`: Injects pixel into HTML
   - Works with any email provider

2. **`api/track/open/[token].ts`**: Tracking endpoint
   - Returns 1x1 transparent PNG
   - Records opens in database
   - Works regardless of email provider

3. **Database Migration**: `008_add_email_tracking.sql`
   - Adds `opened_at`, `open_count`, `tracking_token` to contacts table
   - Indexed for fast lookups

## Current Implementation (Gmail)

The tracking system is fully integrated with Gmail:

- Tracking tokens are generated when emails are sent
- Pixels are automatically injected into HTML emails
- Opens are recorded when recipients view emails

## Future-Proofing for Other Providers

### Adding a New Email Provider

To add support for a new email provider (e.g., Outlook, SendGrid, Mailgun):

1. **Create provider-specific email sending function**:
   ```typescript
   async function sendEmailViaProvider(
     contact: Contact,
     campaign: Campaign,
     html: string,
     // ... provider-specific config
   ) {
     // Use tracking utility (works with any provider)
     const trackingToken = generateTrackingToken();
     const htmlWithTracking = injectTrackingPixel(html, trackingToken);
     
     // Send via provider's API
     await provider.sendEmail({
       to: contact.email,
       html: htmlWithTracking,
       // ...
     });
   }
   ```

2. **Store tracking token**:
   ```typescript
   await supabase
     .from('contacts')
     .update({ tracking_token: trackingToken })
     .eq('id', contact.id);
   ```

3. **That's it!** The tracking pixel endpoint works automatically.

### Why This Works

- **Tracking pixels are standard HTML**: All email clients support images
- **No provider-specific APIs needed**: We don't rely on Gmail's tracking features
- **Universal endpoint**: `/api/track/open/[token]` works for any provider
- **Database is provider-agnostic**: Same schema works for all providers

## UI Integration

### Contacts Table

The contacts table now shows:
- **Opened status**: Eye icon with open count
- **First open time**: When the email was first opened
- **Open count**: Total number of opens

### Example Display

```
Email          | Status | Sent At      | Opened
---------------|--------|--------------|------------------
john@example.com| sent   | Jan 15, 2024 | 👁️ 3x
                                    Jan 15, 2024 2:30 PM
```

## Limitations

1. **Image blocking**: Some email clients block images by default
   - Users must enable images to trigger tracking
   - This is standard across all email tracking systems

2. **Privacy concerns**: Some users disable image loading for privacy
   - Tracking won't work for these users
   - This is expected behavior

3. **Preview panes**: Some email clients load images in preview panes
   - May count as an "open" even if user didn't fully read
   - This is standard behavior for all tracking systems

## Testing

### Test Tracking Locally

1. Send a test email
2. Open the email in your email client
3. Enable images if blocked
4. Check the contacts table - you should see the open recorded

### Verify Tracking Token

```sql
SELECT email, tracking_token, opened_at, open_count 
FROM contacts 
WHERE status = 'sent';
```

## Environment Variables

No new environment variables needed! The tracking system uses:
- `VERCEL_URL` (auto-set by Vercel) for production
- `NEXT_PUBLIC_APP_URL` (optional) for custom domains

## Security

- Tracking tokens are cryptographically random (32 bytes)
- Tokens are unique per email send
- No sensitive data in tracking URLs
- Endpoint gracefully handles invalid tokens

## Performance

- Tracking endpoint is lightweight (returns 1x1 PNG)
- Database queries are indexed for fast lookups
- No impact on email sending performance
- Tracking happens asynchronously (doesn't block email delivery)

