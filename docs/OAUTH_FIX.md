# Fix OAuth 400 Error - "Access blocked: Authorization Error"

## Problem
You're seeing: "Access blocked: Authorization Error" or "Error 400: invalid_request"

This happens when Google OAuth consent screen isn't properly configured.

## Solution

### Step 1: Configure OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **OAuth consent screen**

4. **Configure the consent screen:**
   - **User Type**: Select **External** (unless you have Google Workspace)
   - Click **Create**

5. **Fill in App Information:**
   - **App name**: `MailSurge` (or any name)
   - **User support email**: Your email address
   - **App logo**: (Optional - can skip)
   - **App domain**: (Can leave blank for now)
   - **Developer contact information**: Your email address
   - Click **Save and Continue**

6. **Add Scopes:**
   - Click **Add or Remove Scopes**
   - Search for and add:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`
   - Click **Update**
   - Click **Save and Continue**

7. **Add Test Users (IMPORTANT!):**
   - Click **Add Users**
   - Add your email: `Viksne.jaanis@gmail.com`
   - Click **Add**
   - Click **Save and Continue**

8. **Summary:**
   - Review everything
   - Click **Back to Dashboard**

### Step 2: Verify Redirect URI

1. Go to **APIs & Services** → **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, make sure you have:
   ```
   http://localhost:3000/api/auth/callback
   ```
   - **Exactly** this URL (no trailing slash, no typos)
4. Click **Save**

### Step 3: Wait a Few Minutes

Google sometimes takes a few minutes to propagate OAuth settings. Wait 2-3 minutes after making changes.

### Step 4: Try Again

1. Restart your servers (if needed)
2. Go to Settings in MailSurge
3. Click "Connect Gmail"
4. You should now see the consent screen instead of an error

## Common Issues

### "redirect_uri_mismatch"
- Make sure redirect URI in Google Console **exactly matches** `http://localhost:3000/api/auth/callback`
- No trailing slash, no typos
- Wait a few minutes after updating

### "Access blocked" even after adding test user
- Make sure you added your email as a **Test User** in OAuth consent screen
- Make sure the app is in **Testing** mode (not Published)
- Wait a few minutes for changes to propagate

### Still not working?
- Check browser console for detailed error messages
- Verify all steps above were completed
- Try in an incognito/private window
- Clear browser cookies for localhost

## For Production

When deploying to production:
1. Change OAuth consent screen to **Published** (after verification)
2. Add production redirect URI: `https://your-domain.vercel.app/api/auth/callback`
3. Update `.env` in Vercel with production redirect URI






