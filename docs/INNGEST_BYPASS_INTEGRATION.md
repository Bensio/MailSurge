# Bypass Inngest Integration - Manual Setup

## Problem

- Can't find Settings in Inngest
- Can't disconnect Vercel integration
- Stuck with wrong URL
- Integration UI is broken

## Solution: Skip Integration, Use Manual Sync

### Step 1: Create New App (Separate from Integration)

1. Go to: https://app.inngest.com
2. Look for:
   - **"Apps"** in the sidebar → Click it
   - Or **"+"** button somewhere
   - Or try: https://app.inngest.com/apps/new
3. Create a new app called `MailSurge-Manual` (or any name)
4. This creates a separate app, independent of the integration

### Step 2: Get Keys from New App

1. Click on your new app
2. Look for **"Keys"** or **"Settings"** or **"Configuration"**
3. Copy:
   - **Event Key**
   - **Signing Key**

### Step 3: Set URL Using Curl Command

Instead of using the UI, use the API directly:

```bash
curl -X PUT "https://api.inngest.com/v1/apps/YOUR_APP_ID/sync" \
  -H "Authorization: Bearer YOUR_SIGNING_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mail-surge.vercel.app/api/inngest"
  }'
```

**But first, you need the App ID:**
- Look in the URL when viewing your app: `https://app.inngest.com/apps/APP_ID_HERE`
- Or check the app details page

### Step 4: Alternative - Use Inngest CLI

If the web UI is broken, use the CLI:

1. **Install Inngest CLI:**
   ```bash
   npm install -g inngest-cli
   ```

2. **Login:**
   ```bash
   inngest login
   ```

3. **List your apps:**
   ```bash
   inngest apps list
   ```

4. **Sync manually:**
   ```bash
   inngest sync --url https://mail-surge.vercel.app/api/inngest
   ```

### Step 5: Update Vercel with New Keys

1. Go to **Vercel** → Settings → Environment Variables
2. Update `INNGEST_EVENT_KEY` with Event Key from new app
3. Update `INNGEST_SIGNING_KEY` with Signing Key from new app
4. Save

### Step 6: Redeploy Vercel

1. Vercel → Deployments → Redeploy
2. Wait 1-2 minutes

### Step 7: Test

Visit: `https://mail-surge.vercel.app/api/inngest`

Should see: `"authentication_succeeded": true`

## If You Can't Find Anything in Inngest UI

### Option A: Contact Inngest Support

1. Go to: https://www.inngest.com/support
2. Or email: support@inngest.com
3. Explain: "Vercel integration set wrong URL, can't change it, UI has no settings"
4. Ask them to:
   - Reset your integration
   - Or give you the app ID
   - Or help you disconnect it

### Option B: Create New Inngest Account

1. Sign up for a new Inngest account with a different email
2. Start fresh with manual setup
3. No integration, just manual app creation

### Option C: Check Different Views

The UI might be in a different mode:
- Look for a **"Developer"** or **"Admin"** toggle
- Check if there's a **hamburger menu** (☰) with more options
- Try different pages: Dashboard, Apps, Functions, Settings

## Quick Test: Is Endpoint Working?

Before worrying about Inngest UI, verify your endpoint works:

1. Visit: `https://mail-surge.vercel.app/api/inngest`
2. If you see JSON (even with `authentication_succeeded: false`), the endpoint works
3. The issue is just the signing key mismatch

## Most Likely Solution

Since the UI is broken, try this:

1. **Get signing key from anywhere you can see it** (even the broken integration)
2. **Update Vercel** with that key
3. **Redeploy**
4. **Test** - if auth succeeds, you're good!

The integration might be broken, but if the signing key matches, authentication will work.

