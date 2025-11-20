# Quick Fix: OAuth 400 Error

## The Problem
"Access blocked: Authorization Error" or "Error 400: invalid_request"

This means your OAuth consent screen needs to be configured and your email needs to be added as a test user.

## Quick Fix (5 minutes)

### 1. Go to OAuth Consent Screen

1. Open: https://console.cloud.google.com/apis/credentials/consent
2. Select your project
3. Click **OAuth consent screen** (or **CONFIGURE CONSENT SCREEN** if not configured)

### 2. Configure Basic Info

- **User Type**: Select **External**
- Click **Create**

Fill in:
- **App name**: `MailSurge` (or any name)
- **User support email**: Your email (`Viksne.jaanis@gmail.com`)
- **Developer contact**: Your email
- Click **Save and Continue**

### 3. Add Scopes

- Click **Add or Remove Scopes**
- In the filter, search for: `gmail.send`
- Check: `https://www.googleapis.com/auth/gmail.send`
- Search for: `gmail.readonly`
- Check: `https://www.googleapis.com/auth/gmail.readonly`
- Click **Update**
- Click **Save and Continue**

### 4. Add Test Users (CRITICAL!)

- Click **+ ADD USERS**
- Enter: `Viksne.jaanis@gmail.com`
- Click **Add**
- Click **Save and Continue**

### 5. Review and Finish

- Review the summary
- Click **Back to Dashboard**

### 6. Verify Redirect URI

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, verify you have:
   ```
   http://localhost:3000/api/auth/callback
   ```
   (Exactly this, no trailing slash)
4. If missing, add it and click **Save**

### 7. Wait 2-3 Minutes

Google needs a few minutes to update OAuth settings.

### 8. Try Again

1. Go to MailSurge Settings
2. Click "Connect Gmail"
3. You should now see the Google consent screen (not an error)

## Still Not Working?

- Make sure you're using the **exact** email: `Viksne.jaanis@gmail.com` (case-sensitive)
- Wait 5 minutes after making changes
- Try in an incognito/private browser window
- Clear browser cookies for `localhost:3000`

## Success!

Once it works, you'll see:
- Google asking you to allow MailSurge access
- Click "Allow"
- You'll be redirected back to MailSurge
- Gmail will show as "connected" ✅




