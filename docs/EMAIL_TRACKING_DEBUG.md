# Email Tracking Debug Guide

## How Email Open Tracking Works

1. **When email is sent**: A unique tracking token is generated and stored in the `contacts.tracking_token` field
2. **Tracking pixel injected**: A 1x1 transparent image is added to the email HTML: `<img src="https://your-domain.com/api/track/open/TOKEN" />`
3. **When email is opened**: The email client loads the image, making a GET request to the tracking endpoint
4. **Tracking recorded**: The endpoint updates `opened_at` and `open_count` in the database

## Common Issues

### Issue 1: Gmail Blocks Images by Default

**Problem**: Gmail (and many email clients) block images by default for privacy/security.

**Solution**: 
- The recipient must click "Display images" or "Load images" in Gmail
- This is a Gmail security feature, not a bug in our system
- Once images are enabled, tracking will work

**How to test**:
1. Send a test email to yourself
2. Open it in Gmail
3. Look for "Display images below" or "Load images" message
4. Click it
5. Check MailSurge - the open should be recorded

### Issue 2: Wrong Base URL

**Problem**: The tracking pixel URL might be pointing to the wrong domain.

**Check**:
1. Open the email in Gmail
2. Right-click on the email → "Show original" or "View source"
3. Search for `api/track/open/`
4. Check if the URL is correct (should be your production domain)

**Fix**: Set `TRACKING_BASE_URL` environment variable in Vercel:
```
TRACKING_BASE_URL=https://your-production-domain.com
```

### Issue 3: Tracking Token Not Stored

**Problem**: The tracking token might not be saved to the database.

**Check**:
1. Go to Supabase Dashboard → Table Editor → `contacts`
2. Find the contact you sent to
3. Check if `tracking_token` field has a value
4. If empty, the token wasn't generated/stored

**Fix**: Check Inngest logs to see if token generation is working.

### Issue 4: CORS Issues

**Problem**: Email client can't load the image due to CORS.

**Status**: ✅ Fixed - CORS headers are now set in the tracking endpoint.

## Debugging Steps

### Step 1: Verify Tracking Token Exists

```sql
-- Run in Supabase SQL Editor
SELECT id, email, tracking_token, opened_at, open_count 
FROM contacts 
WHERE email = 'your-test-email@example.com'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected**: `tracking_token` should have a 64-character hex string.

### Step 2: Check Email Source

1. Open the email in Gmail
2. Click the three dots (⋮) → "Show original"
3. Search for `api/track/open/`
4. Copy the full URL
5. Test it in a browser - should return a 1x1 pixel image

### Step 3: Test Tracking Endpoint Directly

Replace `YOUR_TOKEN` with the actual token from the database:

```bash
curl https://your-domain.com/api/track/open/YOUR_TOKEN
```

**Expected**: Should return a PNG image (binary data).

### Step 4: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Functions
2. Click on `api/track/open/[token]`
3. Check logs for tracking requests
4. Look for errors or warnings

### Step 5: Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables, ensure:

```
TRACKING_BASE_URL=https://your-production-domain.com
```

Or if using VERCEL_URL:
- Make sure it's set correctly
- Note: VERCEL_URL might be a preview URL, not production

## Testing Tracking

### Method 1: Manual Test

1. Send a test email to yourself
2. Open it in Gmail
3. **Enable images** (click "Display images")
4. Wait 5-10 seconds
5. Refresh MailSurge campaign page
6. Check if "Opened" status appears

### Method 2: Direct URL Test

1. Get tracking token from database
2. Open in browser: `https://your-domain.com/api/track/open/TOKEN`
3. Check database - `opened_at` should be updated
4. Refresh MailSurge - should show as opened

### Method 3: Check Email HTML

1. View email source in Gmail
2. Search for `<img` tags
3. Should see: `<img src="https://your-domain.com/api/track/open/TOKEN" width="1" height="1" style="display:none;" alt="" />`

## Why Tracking Might Not Work

1. **Images blocked**: Gmail blocks images by default (most common)
2. **Wrong URL**: Tracking pixel URL points to wrong domain
3. **Token mismatch**: Token in email doesn't match database
4. **Email client**: Some email clients strip tracking pixels
5. **Privacy settings**: User has image blocking enabled
6. **Preview mode**: Email opened in preview pane (may not load images)

## Expected Behavior

- ✅ **First open**: `opened_at` is set, `open_count` = 1
- ✅ **Subsequent opens**: `opened_at` stays same, `open_count` increments
- ✅ **Multiple opens**: Each open increments the count
- ✅ **UI shows**: Eye icon with count and first open time

## Quick Fix Checklist

- [ ] Set `TRACKING_BASE_URL` environment variable in Vercel
- [ ] Verify tracking token exists in database
- [ ] Check email source contains tracking pixel
- [ ] Test tracking URL directly in browser
- [ ] Ensure images are enabled in Gmail
- [ ] Check Vercel function logs for errors
- [ ] Wait a few seconds after opening email (async update)

