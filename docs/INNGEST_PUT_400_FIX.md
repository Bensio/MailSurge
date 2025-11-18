# Fix PUT 400 Error in Inngest

## Problem

You see:
- PUT requests returning `400` (Bad Request)
- `authentication_succeeded: false`
- "We could not reach your URL" error

## Root Cause

The `authentication_succeeded: false` means the **signing key doesn't match**. This causes PUT requests (used for syncing) to fail with 400.

## Solution: Verify Signing Key

### Step 1: Get Signing Key from Inngest

1. **If you can access your app in Inngest:**
   - Go to your app → **Settings** → **Keys**
   - Copy the **Signing Key** (long string)

2. **If you can't see your app:**
   - Go to https://app.inngest.com
   - Look for "Apps" in sidebar
   - Click on your app (or create a new one)
   - Go to **Settings** → **Keys**
   - Copy the **Signing Key**

### Step 2: Verify in Vercel

1. Go to **Vercel** → Your Project → **Settings** → **Environment Variables**
2. Find `INNGEST_SIGNING_KEY`
3. **Compare it with the signing key from Inngest**
4. They must match **exactly** (case-sensitive, no spaces)

### Step 3: Fix if Different

1. **If they don't match:**
   - Copy the signing key from Inngest
   - Paste it into Vercel's `INNGEST_SIGNING_KEY`
   - Save

2. **If `INNGEST_SIGNING_KEY` is missing:**
   - Add it in Vercel
   - Paste the signing key from Inngest
   - Save

### Step 4: Redeploy (CRITICAL)

**After changing environment variables, you MUST redeploy:**

1. Go to **Vercel** → **Deployments**
2. Click **three dots** (⋯) on latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete (1-2 minutes)

### Step 5: Test Again

1. Visit: `https://mail-surge.vercel.app/api/inngest`
2. You should see: `"authentication_succeeded": true`
3. Try syncing in Inngest again

## Check Vercel Logs

After redeploying, check the logs:

1. Go to **Vercel** → **Functions** → `/api/inngest`
2. Click **"Logs"** tab
3. Look for:
   - `[Inngest] Request:` - Shows incoming requests
   - `[Inngest] Handler error:` - Shows any errors
   - `[Inngest] Response sent successfully` - Shows successful responses

## Common Issues

1. **Signing Key Mismatch:**
   - Most common cause of `authentication_succeeded: false`
   - Keys must match exactly

2. **Not Redeploying:**
   - Environment variable changes require redeploy
   - Just saving isn't enough

3. **Using Event Key Instead:**
   - Make sure you're using **Signing Key**, not Event Key
   - They're different!

4. **Extra Spaces:**
   - No leading/trailing spaces
   - Copy-paste directly

## After Fixing

Once `authentication_succeeded: true`:
- PUT requests should return `200` instead of `400`
- Inngest should be able to sync your app
- You should see app information in Inngest dashboard

