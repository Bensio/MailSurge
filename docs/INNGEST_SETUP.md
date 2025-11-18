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
3. **Create a new app:**
   - Go to https://app.inngest.com
   - Click "+" or "Create App" button
   - Name it "MailSurge"
   - Click "Create"

**Note:** If you used the Vercel integration and can't see your app, see `docs/INNGEST_MANUAL_SETUP.md` for manual setup instructions.

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

**Important**: Make sure to use the full URL including `https://` and the `/api/inngest` path. The URL should NOT end with a trailing slash.

**Optional**: If you want to explicitly set the serve URL, you can add this environment variable in Vercel:
```
INNGEST_SERVE_URL=https://your-domain.vercel.app
```
Otherwise, the code will automatically use `VERCEL_URL` environment variable.

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

### Deployment Protection Warning

If you see a warning about "Vercel Deployment Protection might block syncing":

1. **Check if Deployment Protection is enabled in Vercel:**
   - Go to your Vercel project → Settings → Deployment Protection
   - If it's enabled, you'll need to get the deployment protection key

2. **Get the Deployment Protection Key:**
   - In Vercel: Project Settings → Deployment Protection
   - Copy the "Deployment Protection Key" (it's a long string)
   - Paste it into the "Deployment protection key" field in Inngest's Vercel integration settings

3. **Alternative: Disable Deployment Protection (not recommended for production)**
   - Only do this if you don't need deployment protection
   - Go to Vercel → Settings → Deployment Protection → Disable

4. **Save the configuration in Inngest:**
   - Click "Save configuration" button in Inngest's Vercel integration page

### "We could not reach your URL" Error

If Inngest shows "We could not reach your URL":

1. **Use Production URL, Not Preview URL:**
   - Preview URLs (with hash like `mail-surge-8soz0nyhu-...`) are temporary
   - Use your production URL: `https://mail-surge.vercel.app/api/inngest`
   - Or your custom domain if you have one

2. **Test the Endpoint Manually:**
   - Open `https://your-production-url.vercel.app/api/inngest` in a browser
   - You should see a response (even an error means it's reachable)
   - If you get "404" or "Cannot GET", the endpoint isn't deployed

3. **Check Vercel Deployment:**
   - Go to Vercel → Deployments
   - Make sure your latest deployment is successful
   - Check if `/api/inngest` is in the deployment

4. **Update Inngest App URL:**
   - In Inngest: Settings → App URL
   - Make sure it's set to your **production** URL, not preview
   - Format: `https://your-production-domain.vercel.app/api/inngest`

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

