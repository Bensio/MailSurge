# Fix Grayed Out Sync Button in Inngest

## Problem

The "Sync app" button is grayed out and you can't sync manually or via Vercel.

## Solution: Fix the App URL Format

The App URL field needs to be in the **exact format**:

### ✅ Correct Format:
```
https://mail-surge.vercel.app/api/inngest
```

### ❌ Wrong Formats (will gray out the button):
- `mail-surge.vercel.app` (missing https:// and path)
- `https://mail-surge.vercel.app` (missing /api/inngest path)
- `mail-surge.vercel.app/api/inngest` (missing https://)
- `https://mail-surge.vercel.app/api/inngest/` (trailing slash)

## Step-by-Step Fix

### 1. Check the App URL Field

In the sync page, the "App URL" field should contain:
```
https://mail-surge.vercel.app/api/inngest
```

**Not just:** `mail-surge.vercel.app`

### 2. Verify Signing Key

1. The signing key should be visible (not empty)
2. Make sure it matches what's in Vercel:
   - Go to Vercel → Settings → Environment Variables
   - Check `INNGEST_SIGNING_KEY`
   - It should match the signing key shown in Inngest

### 3. If Still Grayed Out

Try these in order:

**Option A: Clear and Re-enter**
1. Clear the App URL field completely
2. Type: `https://mail-surge.vercel.app/api/inngest`
3. Make sure there are no spaces before or after
4. Check if the button becomes enabled

**Option B: Check for Validation Errors**
1. Look for any red error messages below the fields
2. Common errors:
   - "Invalid URL format"
   - "URL must start with https://"
   - "URL must include the serve path"

**Option C: Use Curl Command Instead**
1. Click the "Curl command" tab
2. Copy the curl command shown
3. Run it in your terminal
4. This bypasses the UI validation

**Option D: Check Browser Console**
1. Press F12 to open developer tools
2. Go to Console tab
3. Look for JavaScript errors
4. These might explain why the button is disabled

## Alternative: Set URL via API

If the UI won't let you sync, you can use the Inngest API directly:

```bash
curl -X PUT "https://api.inngest.com/v1/apps/YOUR_APP_ID/sync" \
  -H "Authorization: Bearer YOUR_SIGNING_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mail-surge.vercel.app/api/inngest"
  }'
```

Replace:
- `YOUR_APP_ID` - Your Inngest app ID
- `YOUR_SIGNING_KEY` - Your signing key

## Most Common Issue

**99% of the time, it's the URL format.**

Make absolutely sure the App URL is:
```
https://mail-surge.vercel.app/api/inngest
```

With:
- ✅ `https://` at the start
- ✅ Full domain
- ✅ `/api/inngest` path
- ✅ No trailing slash
- ✅ No spaces

## Still Not Working?

1. **Try a different browser** - Sometimes browser extensions interfere
2. **Clear browser cache** - Old JavaScript might be cached
3. **Check Inngest status** - Visit https://status.inngest.com
4. **Contact Inngest support** - They can help debug the sync issue

