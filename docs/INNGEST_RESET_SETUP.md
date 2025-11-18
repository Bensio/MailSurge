# Reset Inngest Setup - Fix Wrong URL

## Problem

- Connected Inngest to Vercel with wrong URL (preview URL instead of production)
- Can't change the URL anywhere
- Authentication failing
- "Unattached Syncs" errors

## Solution: Disconnect and Set Up Manually

### Step 1: Disconnect Vercel Integration

1. Go to **Inngest Dashboard**: https://app.inngest.com
2. Look for **Settings** → **Integrations** (or "Vercel" in sidebar)
3. Find the Vercel integration
4. **Disconnect** or **Remove** it
5. This will clear the wrong URL

### Step 2: Create New App Manually

1. In Inngest, click **"+ Create App"** or go to: https://app.inngest.com/apps/new
2. Name it: `MailSurge`
3. Click **"Create"**

### Step 3: Get Your Keys

1. In the new app, go to **Settings** → **Keys**
2. Copy:
   - **Event Key**
   - **Signing Key** (this is critical!)

### Step 4: Set App URL Manually

1. Still in Settings, find **"App URL"** or **"Sync URL"**
2. Enter: `https://mail-surge.vercel.app/api/inngest`
   - Must include `https://`
   - Must include `/api/inngest`
   - **NO trailing slash**
   - Use **production** URL, not preview
3. **Save**

### Step 5: Update Vercel Environment Variables

1. Go to **Vercel** → Your Project → **Settings** → **Environment Variables**
2. Update `INNGEST_EVENT_KEY`:
   - Paste the **Event Key** from Inngest
   - Save
3. Update `INNGEST_SIGNING_KEY` (for both Production and Preview):
   - Paste the **Signing Key** from Inngest
   - Make sure both Production and Preview have the same key
   - Save

### Step 6: Redeploy Vercel

**CRITICAL:** After changing environment variables:

1. Go to **Vercel** → **Deployments**
2. Click **three dots** (⋯) on latest deployment
3. Click **"Redeploy"**
4. Wait 1-2 minutes for deployment to complete

### Step 7: Test

1. Visit: `https://mail-surge.vercel.app/api/inngest`
2. You should see: `"authentication_succeeded": true`
3. Go back to Inngest and try syncing again

## Alternative: If You Can't Disconnect Integration

If you can't find where to disconnect:

1. **Create a completely new Inngest account** (if needed)
2. Or **contact Inngest support** to reset the integration
3. Or **manually set the URL via API** (see below)

## Manual URL Update via API

If you have the app ID and signing key, you can update the URL via API:

```bash
curl -X PUT "https://api.inngest.com/v1/apps/YOUR_APP_ID/sync" \
  -H "Authorization: Bearer YOUR_SIGNING_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mail-surge.vercel.app/api/inngest"
  }'
```

But you need the app ID first, which you can't see if the integration is broken.

## Why This Happens

- Vercel integration auto-detects the URL
- Sometimes it picks the preview URL instead of production
- Once set, it's hard to change in the integration UI
- Manual setup gives you full control

## After Fixing

Once you:
1. ✅ Disconnect the broken integration
2. ✅ Create new app manually
3. ✅ Set correct production URL
4. ✅ Update Vercel with correct keys
5. ✅ Redeploy

You should see:
- `authentication_succeeded: true`
- App information populated in Inngest
- No more "Unattached Syncs" errors

