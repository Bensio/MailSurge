# Inngest Setup Guide

Inngest is used for reliable background email sending, avoiding Vercel's serverless function timeout limitations.

## Why Inngest?

- **Vercel Free Tier**: 10 second timeout (too short for email campaigns)
- **Vercel Pro Tier**: 60 second timeout (still limited for large campaigns)
- **Inngest**: No timeout limits, reliable background processing, automatic retries

## Setup Steps

### 1. Create Inngest Account

1. Go to [https://www.inngest.com](https://www.inngest.com)
2. Sign up for a free account (Hobby plan includes 50,000 executions/month)
3. Create a new app called "MailSurge"

### 2. Get Your Inngest Keys

1. In your Inngest dashboard, go to **Settings** → **Keys**
2. Copy your **Event Key** (for sending events)
3. Copy your **Signing Key** (for the serve endpoint)

### 3. Add Environment Variables to Vercel

Add these to your Vercel project settings:

```
INNGEST_EVENT_KEY=your_event_key_here
INNGEST_SIGNING_KEY=your_signing_key_here
```

**Important**: The `INNGEST_SIGNING_KEY` is used by the `/api/inngest` endpoint to verify requests from Inngest.

### 4. Configure Inngest App URL

1. In your Inngest dashboard, go to **Settings** → **App URL**
2. Set the app URL to your Vercel deployment URL:
   ```
   https://your-domain.vercel.app/api/inngest
   ```
   Or for production:
   ```
   https://your-custom-domain.com/api/inngest
   ```

### 5. Deploy to Vercel

After adding the environment variables, redeploy your Vercel project:

```bash
git add .
git commit -m "Add Inngest integration for email sending"
git push origin main
```

Vercel will automatically redeploy with the new environment variables.

### 6. Test the Integration

1. Go to your Inngest dashboard
2. Navigate to **Functions** → **send-campaign-emails**
3. Create a test campaign in MailSurge and click "Send"
4. Check the Inngest dashboard to see the function execution

## How It Works

1. **User clicks "Send"** → Frontend calls `/api/campaigns/[id]/send`
2. **Send endpoint** → Sends an event to Inngest with campaign details
3. **Inngest** → Processes the event and calls `/api/inngest` with the function
4. **Inngest function** → Sends emails one by one with delays, updating status in Supabase
5. **Status updates** → Frontend polls for updates or uses real-time subscriptions

## Monitoring

- **Inngest Dashboard**: View function executions, logs, and errors
- **Vercel Logs**: View API endpoint logs
- **Supabase**: Check campaign and contact statuses

## Troubleshooting

### Emails not sending

1. Check Inngest dashboard for function executions
2. Verify `INNGEST_EVENT_KEY` is set in Vercel
3. Verify `INNGEST_SIGNING_KEY` is set in Vercel
4. Check that the App URL in Inngest matches your Vercel deployment URL

### Function not found

1. Ensure `/api/inngest.ts` is deployed
2. Check that the Inngest App URL is correct
3. Verify the function is registered in the serve handler

### Timeout errors

Inngest should not timeout, but if you see errors:
1. Check Inngest dashboard for execution logs
2. Verify Gmail API credentials are correct
3. Check Supabase connection

## Free Tier Limits

- **50,000 executions/month** (plenty for testing and small campaigns)
- **5 concurrent steps**
- **50 real-time connections**

For production with high volume, consider upgrading to the Pro plan ($75/month).

