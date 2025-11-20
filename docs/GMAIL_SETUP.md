# Gmail OAuth Setup Guide

## Step-by-Step Instructions

### 1. Go to Google Cloud Console

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google account
3. Create a new project or select an existing one:
   - Click the project dropdown at the top
   - Click "New Project"
   - Name it "MailSurge" (or any name)
   - Click "Create"

### 2. Enable Gmail API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click **Enable**

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   - User Type: **External** (unless you have a Google Workspace)
   - App name: "MailSurge"
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
   - Scopes: Click **Add or Remove Scopes**
     - Search for "gmail.send" and check it
     - Search for "gmail.readonly" and check it
     - Click **Update** → **Save and Continue**
   - Test users: Add your email address
   - Click **Save and Continue** → **Back to Dashboard**

4. Now create OAuth Client ID:
   - Application type: **Web application**
   - Name: "MailSurge Web Client"
   - Authorized redirect URIs: 
     - `http://localhost:3000/api/auth/callback` (for development)
     - `https://your-domain.vercel.app/api/auth/callback` (for production, if deployed)
   - Click **Create**

5. **Copy the credentials:**
   - **Client ID** (looks like: `123456789-abc...xyz.apps.googleusercontent.com`)
   - **Client Secret** (looks like: `GOCSPX-abc...xyz`)

### 4. Update .env File

Add these lines to your `.env` file:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here
VITE_GOOGLE_CLIENT_SECRET=your-client-secret-here
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

**Important:** Replace `your-client-id-here` and `your-client-secret-here` with the actual values from Google Cloud Console.

### 5. Restart Servers

After updating `.env`, restart both servers:

```bash
# Stop current servers (Ctrl+C)
# Then restart:
npm run dev:all
```

### 6. Test Connection

1. Go to Settings page in MailSurge
2. Click "Connect Gmail"
3. You'll be redirected to Google to authorize
4. Click "Allow" to grant permissions
5. You'll be redirected back to MailSurge
6. Gmail should now show as "connected"

## Troubleshooting

### "redirect_uri_mismatch" Error

- Make sure the redirect URI in Google Cloud Console **exactly matches**:
  - `http://localhost:3000/api/auth/callback` (for local dev)
- Check for trailing slashes or typos
- Wait a few minutes after updating - Google caches OAuth settings

### "Access blocked" Error

- Make sure you added your email as a test user in OAuth consent screen
- If in production, you may need to verify your app with Google

### Still Not Working?

1. Check browser console for errors
2. Verify `.env` file has correct values (no quotes, no spaces)
3. Make sure you restarted the servers after updating `.env`
4. Check that Gmail API is enabled in Google Cloud Console

## Security Notes

- Never commit your `.env` file to git (it's already in `.gitignore`)
- The Client Secret should be kept private
- In production, use environment variables in Vercel dashboard, not `.env` file




