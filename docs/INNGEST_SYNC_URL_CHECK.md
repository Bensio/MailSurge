# Inngest Sync URL Check

## Problem
Getting "We could not reach your URL" when trying to sync Inngest.

## Solution: Verify URL Format

### Step 1: Check Current URL in Inngest

1. Go to https://app.inngest.com
2. Open your app
3. Go to **Settings** → **App URL** (or **Sync URL**)
4. **Verify the URL is exactly:**
   ```
   https://mail-surge.vercel.app/api/inngest
   ```

**Must have:**
- ✅ `https://` at the start (NOT `http://`)
- ✅ Full domain: `mail-surge.vercel.app` (NOT a preview URL)
- ✅ Path: `/api/inngest` (NOT just `/api` or `/`)
- ✅ NO trailing slash
- ✅ NO spaces

### Step 2: Test the Endpoint Manually

Open in your browser:
```
https://mail-surge.vercel.app/api/inngest
```

**You should see:**
- A JSON response with function information
- Something like: `{"functions":[...], "authentication_succeeded": true}`

**If you see an error:**
- Check Vercel logs for `/api/inngest`
- Make sure the function is deployed

### Step 3: Check Vercel Logs

1. Go to **Vercel** → Your Project → **Functions** → `/api/inngest`
2. Click **"Logs"** tab
3. Try syncing in Inngest again
4. **Look for:**
   - `[Inngest] ===== FUNCTION CALLED =====` - Shows the endpoint was hit
   - `[Inngest] Method: GET` or `PUT` - Shows what request was made
   - Any errors

### Step 4: Common Issues

**Issue: Using Preview URL**
- ❌ Wrong: `https://mail-surge-abc123.vercel.app/api/inngest`
- ✅ Correct: `https://mail-surge.vercel.app/api/inngest`

**Issue: Missing Path**
- ❌ Wrong: `https://mail-surge.vercel.app`
- ✅ Correct: `https://mail-surge.vercel.app/api/inngest`

**Issue: Wrong Protocol**
- ❌ Wrong: `http://mail-surge.vercel.app/api/inngest`
- ✅ Correct: `https://mail-surge.vercel.app/api/inngest`

**Issue: Trailing Slash**
- ❌ Wrong: `https://mail-surge.vercel.app/api/inngest/`
- ✅ Correct: `https://mail-surge.vercel.app/api/inngest`

### Step 5: If Still Not Working

1. **Copy the exact URL from Inngest settings**
2. **Paste it into your browser** - Does it work?
3. **Check Vercel deployment** - Is it deployed and running?
4. **Check environment variables** - Are `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` set?
5. **Redeploy Vercel** - Sometimes a fresh deployment helps

### Step 6: Manual Sync via API

If the UI won't work, use the API:

```bash
curl -X PUT "https://api.inngest.com/v1/apps/YOUR_APP_ID/sync" \
  -H "Authorization: Bearer YOUR_SIGNING_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mail-surge.vercel.app/api/inngest"
  }'
```

Replace:
- `YOUR_APP_ID` - Your Inngest app ID (from URL: `https://app.inngest.com/apps/APP_ID`)
- `YOUR_SIGNING_KEY` - Your signing key from Inngest

