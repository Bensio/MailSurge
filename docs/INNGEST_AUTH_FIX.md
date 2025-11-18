# Fix Inngest Authentication Issue

## Problem

When you visit `https://mail-surge.vercel.app/api/inngest`, you see:
```json
{
  "authentication_succeeded": false,
  "has_event_key": true,
  "has_signing_key": true,
  "function_count": 1
}
```

This means:
- ✅ Endpoint is working
- ✅ Environment variables are set
- ❌ **Signing key doesn't match** (authentication failed)

## Solution

### Step 1: Get the Correct Signing Key

1. Go to **Inngest Dashboard** → **Settings** → **Keys**
2. Find the **Signing Key** (it's a long string, different from Event Key)
3. **Copy it exactly** (it's case-sensitive)

### Step 2: Update Vercel Environment Variable

1. Go to **Vercel** → Your Project → **Settings** → **Environment Variables**
2. Find `INNGEST_SIGNING_KEY`
3. Click to edit it
4. **Paste the signing key from Inngest** (make sure it matches exactly)
5. Save

### Step 3: Redeploy

**Important**: After changing environment variables, you MUST redeploy:

1. Go to **Vercel** → **Deployments**
2. Click the **three dots** (⋯) on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

OR

1. Make a small change to any file (add a space, comment, etc.)
2. Commit and push:
   ```bash
   git commit --allow-empty -m "Trigger redeploy for Inngest signing key"
   git push origin main
   ```

### Step 4: Verify

1. Wait 1-2 minutes after redeploy
2. Visit: `https://mail-surge.vercel.app/api/inngest`
3. You should now see: `"authentication_succeeded": true`

## Common Mistakes

1. **Using Event Key instead of Signing Key:**
   - ❌ Wrong: Using `INNGEST_EVENT_KEY` value for `INNGEST_SIGNING_KEY`
   - ✅ Right: Use the **Signing Key** from Inngest Dashboard

2. **Not Redeploying:**
   - Environment variable changes require a redeploy
   - Just saving in Vercel UI isn't enough

3. **Extra Spaces:**
   - Make sure there are no leading/trailing spaces
   - Copy-paste directly, don't type it

4. **Wrong Key:**
   - Make sure you're copying from the right place
   - Inngest Dashboard → Settings → Keys → **Signing Key** (not Event Key)

## After Fixing

Once `authentication_succeeded: true`, Inngest should be able to:
- Sync your functions
- Invoke your functions
- Show app information in the dashboard

The "Add app via Vercel" button should work, and you should see all the app information populated instead of "UNKNOWN".

