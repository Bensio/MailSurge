# Vercel Environment Variables Setup Guide

## Google OAuth Redirect URI

**Yes, use the Vercel-generated URL!**

Your Vercel URL: `https://mail-surge-git-main-janis-projects-ecdca553.vercel.app`

So your redirect URI should be:
```
https://mail-surge-git-main-janis-projects-ecdca553.vercel.app/api/auth/callback
```

## Step-by-Step Setup

### Step 1: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://mail-surge-git-main-janis-projects-ecdca553.vercel.app/api/auth/callback
   ```
5. **Keep** the localhost URI for local development:
   ```
   http://localhost:3000/api/auth/callback
   ```
6. Click **Save**
7. Wait 5-10 minutes for changes to propagate

### Step 2: Set Environment Variables in Vercel

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these variables (replace with your actual values):

#### Server-Side Variables (No VITE_ prefix)

```
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=https://mail-surge-git-main-janis-projects-ecdca553.vercel.app/api/auth/callback
```

#### Frontend Variables (VITE_ prefix - exposed to browser)

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here
VITE_GOOGLE_REDIRECT_URI=https://mail-surge-git-main-janis-projects-ecdca553.vercel.app/api/auth/callback
```

**Important Notes:**
- `VITE_GOOGLE_CLIENT_SECRET` is **NOT needed** (secrets should never be exposed to frontend)
- Use the **same Client ID** for both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`
- Use the **same redirect URI** for both `GOOGLE_REDIRECT_URI` and `VITE_GOOGLE_REDIRECT_URI`
- Select **all environments** (Production, Preview, Development) for each variable

### Step 3: Complete Environment Variables List

Here's the complete list you need in Vercel:

```
# Supabase (Server-side)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Supabase (Frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth (Server-side)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://mail-surge-git-main-janis-projects-ecdca553.vercel.app/api/auth/callback

# Google OAuth (Frontend)
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_REDIRECT_URI=https://mail-surge-git-main-janis-projects-ecdca553.vercel.app/api/auth/callback
```

### Step 4: After Adding Variables

1. **Redeploy** your project:
   - Go to **Deployments** tab
   - Click the three dots (⋯) on the latest deployment
   - Click **Redeploy**

2. **Test Gmail Connection**:
   - Go to your app
   - Navigate to Settings
   - Click "Connect Gmail"
   - Should redirect to Google and back to your app

## Custom Domain (When You Get One)

When you add a custom domain (e.g., `mailsurge.com`), update:

1. **Google Cloud Console**: Add new redirect URI
   ```
   https://mailsurge.com/api/auth/callback
   ```

2. **Vercel Environment Variables**: Update both redirect URIs
   ```
   GOOGLE_REDIRECT_URI=https://mailsurge.com/api/auth/callback
   VITE_GOOGLE_REDIRECT_URI=https://mailsurge.com/api/auth/callback
   ```

3. **Redeploy** after updating

## Local Development

Keep your local `.env` file with localhost URLs:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
FRONTEND_URL=http://localhost:3000
```

## Quick Checklist

- [ ] Updated Google Cloud Console with Vercel redirect URI
- [ ] Added all environment variables in Vercel
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Redeployed after adding variables
- [ ] Tested Gmail connection
- [ ] Verified email sending works

## Troubleshooting

### "redirect_uri_mismatch" Error

- Check redirect URI in Google Cloud Console matches **exactly** (no trailing slash)
- Must be `https://` (not `http://`)
- Wait 5-10 minutes after updating

### "Gmail not connected" Error

- Check `VITE_GOOGLE_CLIENT_ID` is set in Vercel
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Verify Gmail OAuth redirect URI matches in both places

### Environment Variables Not Working

- Ensure variables are set for **Production** environment
- Variables with `VITE_` prefix are exposed to frontend
- Redeploy after adding variables

