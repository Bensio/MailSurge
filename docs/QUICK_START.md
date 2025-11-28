# MailSurge Quick Start Guide

Get MailSurge up and running in minutes!

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- Either:
  - Gmail account (for OAuth), OR
  - Gmail account with App Password (for SMTP), OR
  - Any SMTP provider credentials

## Step 1: Clone and Install

```bash
git clone <your-repo>
cd MailSurge
npm install
```

## Step 2: Set Up Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. Get your project URL and anon key from Settings → API
3. Create a `.env` file in the root:

```env
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

**Get Service Key:**
- Supabase Dashboard → Settings → API
- Copy the `service_role` key (NOT the anon key)
- ⚠️ Keep this secret! Never commit it to git.

## Step 3: Choose Email Method

### Option A: SMTP (Easiest - Recommended for Plug-and-Play)

1. Create a Gmail App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Enable 2-Step Verification if needed
   - Create app password for "Mail"
   - Copy the 16-character password

2. Add to `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=MailSurge
```

**That's it!** All users can now send emails without any setup.

### Option B: Gmail OAuth (For Personal Gmail Accounts)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable Gmail API
3. Create OAuth 2.0 credentials
4. Add redirect URI: `http://localhost:3000/api/auth/callback` (or your production URL)
5. Add to `.env`:
```env
VITE_GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

Users will need to connect their Gmail in Settings.

### Option C: Both (Best of Both Worlds)

Set up both SMTP and Gmail OAuth. The system will:
- Use Gmail OAuth for users who connect their account
- Fall back to SMTP for users who don't

## Step 4: Optional - Inngest (For Background Email Sending)

1. Sign up at [Inngest](https://inngest.com) (free tier available)
2. Create an app and get your keys
3. Add to `.env`:
```env
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key
```

4. Connect Inngest to your Vercel deployment:
   - Inngest Dashboard → Add App → Vercel
   - Follow the integration steps

## Step 5: Run the App

```bash
npm run dev:all
```

This starts:
- Frontend on http://localhost:3000
- API server on http://localhost:3001

## Step 6: Verify Setup

1. Open http://localhost:3000
2. Sign up/login
3. Go to Settings
4. Check "System Status" card - should show ✅ All systems operational
5. If using Gmail OAuth, click "Connect Gmail"
6. Add a test email in Settings

## Step 7: Create Your First Campaign

1. Go to Campaigns → New Campaign
2. Design your email
3. Add contacts
4. Click "Test Send" to verify
5. Click "Send Campaign" when ready!

## Troubleshooting

### "System Status" shows errors
- Check that all required `.env` variables are set
- Verify Supabase service key is correct
- Ensure at least one email method (SMTP or Gmail OAuth) is configured

### Emails not sending
- Check System Status in Settings
- Verify SMTP credentials or Gmail OAuth connection
- Check Inngest dashboard for background job status
- Review browser console and server logs

### Gmail OAuth not working
- Verify redirect URI matches exactly in Google Cloud Console
- Check that OAuth consent screen is configured
- Add your email as a test user in Google Cloud Console
- Wait 2-3 minutes after making changes

## Next Steps

- Read [SMTP_SETUP.md](./SMTP_SETUP.md) for detailed SMTP configuration
- Read [INNGEST_SETUP.md](./INNGEST_SETUP.md) for Inngest integration
- Check [EMAIL_TRACKING.md](./EMAIL_TRACKING.md) for tracking setup

## Support

- Check the `/docs` folder for detailed guides
- Review error messages in Settings → System Status
- Check server logs for detailed error information

