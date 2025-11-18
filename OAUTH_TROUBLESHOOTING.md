# OAuth "unauthorized_client" Error Fix

## The Problem
You're getting `unauthorized_client` error when trying to exchange the authorization code for tokens.

## Root Cause
Google OAuth is rejecting the token exchange because:
1. **Redirect URI mismatch** (most common)
2. Wrong Client ID or Secret
3. Authorization code expired

## Fix Steps

### Step 1: Verify Redirect URI in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, check you have:
   ```
   http://localhost:3000/api/auth/callback
   ```
   **CRITICAL:**
   - Must be EXACTLY this (no trailing slash)
   - Must match the case
   - No typos
   - Must be `http://` not `https://` for localhost

4. If it's missing or different:
   - Click **+ ADD URI**
   - Enter: `http://localhost:3000/api/auth/callback`
   - Click **Save**
   - **Wait 2-3 minutes** for changes to propagate

### Step 2: Verify Client ID and Secret

1. In Google Cloud Console → Credentials
2. Click on your OAuth 2.0 Client ID
3. Copy the **Client ID** and **Client Secret**
4. Compare with your `.env` file:
   ```env
   VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
   VITE_GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
   ```
5. Make sure they match exactly (no extra spaces, no quotes)

### Step 3: Clear and Retry

1. **Wait 2-3 minutes** after making changes in Google Cloud Console
2. **Restart your servers**:
   ```bash
   # Stop servers (Ctrl+C)
   npm run dev:all
   ```
3. **Try connecting Gmail again**
4. If you get `invalid_grant`, that's normal - just try again (codes expire quickly)

## Verification Checklist

- [ ] Redirect URI in Google Console: `http://localhost:3000/api/auth/callback`
- [ ] No trailing slash in redirect URI
- [ ] Client ID matches `.env` file
- [ ] Client Secret matches `.env` file
- [ ] Waited 2-3 minutes after updating Google Console
- [ ] Restarted servers after updating `.env`
- [ ] OAuth consent screen is configured
- [ ] Your email is added as a test user

## Still Not Working?

1. **Double-check the redirect URI** - This is the #1 cause
2. **Check server console** - Look for "Using redirect URI:" log
3. **Try in incognito mode** - Clear any cached OAuth state
4. **Verify OAuth consent screen** - Make sure it's configured and published (or in testing mode with your email as test user)

## Success Indicators

When it works, you'll see in server console:
- "Token exchange successful!"
- "Success! Redirecting to settings..."
- Browser redirects to Settings page
- Gmail shows as "connected" ✅



