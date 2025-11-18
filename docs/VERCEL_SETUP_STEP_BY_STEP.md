# Vercel Setup - Step by Step Guide

This guide walks you through setting up your MailSurge project on Vercel.

## Step 1: Import Your Project

1. **On the Vercel Dashboard**, you should see:
   - "Deploy your first project" heading
   - "Import Project" section with an "Import" button

2. **Click the "Import" button**

3. **Connect Your Git Provider** (if not already connected):
   - You'll see options: GitHub, GitLab, Bitbucket
   - Click **GitHub** (or your provider)
   - Authorize Vercel to access your repositories
   - You may need to install the Vercel GitHub app

4. **Select Your Repository**:
   - Search for "MailSurge" or "Bensio/MailSurge"
   - Click on your repository

## Step 2: Configure Project Settings

After selecting your repo, you'll see a configuration screen:

### Framework Preset
- **Select**: "Vite" (or it may auto-detect)
- If Vite isn't shown, select "Other" and we'll configure manually

### Root Directory
- Leave as **`./`** (default - means root of repository)

### Build and Output Settings

**Build Command:**
```
npm run build
```

**Output Directory:**
```
dist
```

**Install Command:**
```
npm install
```

### Environment Variables
**Don't add them here yet** - we'll do this after the project is created. Click "Deploy" to continue.

## Step 3: Initial Deployment

1. **Click "Deploy"** (or "Create Project")
2. Wait for the build to complete (2-5 minutes)
3. You'll get a URL like: `mailsurge-xxxxx.vercel.app`

**Note**: This first deployment will likely fail because we haven't set environment variables yet. That's okay!

## Step 4: Configure Environment Variables

1. **Go to Project Settings**:
   - Click on your project name
   - Go to **Settings** tab (top navigation)
   - Click **Environment Variables** in the left sidebar

2. **Add Each Variable** (click "Add" for each):

   **Supabase (Required):**
   ```
   Name: SUPABASE_URL
   Value: https://your-project.supabase.co
   Environment: Production, Preview, Development (select all)
   ```

   ```
   Name: SUPABASE_ANON_KEY
   Value: your-anon-key-here
   Environment: Production, Preview, Development
   ```

   ```
   Name: SUPABASE_SERVICE_KEY
   Value: your-service-role-key-here
   Environment: Production, Preview, Development
   ```

   **Google OAuth (Required for email sending):**
   ```
   Name: GOOGLE_CLIENT_ID
   Value: your-client-id-here
   Environment: Production, Preview, Development
   ```

   ```
   Name: GOOGLE_CLIENT_SECRET
   Value: your-client-secret-here
   Environment: Production, Preview, Development
   ```

   ```
   Name: GOOGLE_REDIRECT_URI
   Value: https://your-project.vercel.app/api/auth/callback
   Environment: Production, Preview, Development
   ```

   **Frontend Variables (VITE_ prefix):**
   ```
   Name: VITE_SUPABASE_URL
   Value: https://your-project.supabase.co
   Environment: Production, Preview, Development
   ```

   ```
   Name: VITE_SUPABASE_ANON_KEY
   Value: your-anon-key-here
   Environment: Production, Preview, Development
   ```

   ```
   Name: VITE_GOOGLE_CLIENT_ID
   Value: your-client-id-here
   Environment: Production, Preview, Development
   ```

   ```
   Name: VITE_GOOGLE_REDIRECT_URI
   Value: https://your-project.vercel.app/api/auth/callback
   Environment: Production, Preview, Development
   ```

3. **Important Notes**:
   - Replace `your-project.vercel.app` with your actual Vercel URL
   - Replace all placeholder values with your actual credentials
   - Select all environments (Production, Preview, Development) for each variable
   - Click "Save" after adding each variable

## Step 5: Configure Git Settings

1. **Still in Settings**, click **Git** in the left sidebar

2. **Production Branch**:
   - Set to: **`main`**
   - This ensures only the `main` branch deploys to production

3. **Preview Deployments** (Optional but recommended):
   - Enable "Automatic Preview Deployments"
   - This creates preview URLs for `develop` branch and pull requests

4. **Deployment Protection** (Optional):
   - You can require approval before production deployments
   - Leave disabled for now (you can enable later)

## Step 6: Redeploy with Environment Variables

1. **Go to Deployments tab** (top navigation)
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Or, make a small change and push to trigger a new deployment:
   ```bash
   git checkout main
   # Make a small change (like updating README)
   git commit -m "chore: trigger redeploy with env vars"
   git push origin main
   ```

## Step 7: Test Your Deployment

1. **Visit your Vercel URL**: `https://your-project.vercel.app`
2. **Test the app**:
   - Sign up / Sign in
   - Create a campaign
   - Try connecting Gmail (will need to update Google OAuth redirect URI first)

## Step 8: Update Google OAuth Redirect URI

Before Gmail OAuth will work:

1. **Go to Google Cloud Console**: [console.cloud.google.com](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://your-project.vercel.app/api/auth/callback
   ```
5. **Keep** the localhost URI for local development:
   ```
   http://localhost:3000/api/auth/callback
   ```
6. Click **Save**
7. Wait 5-10 minutes for changes to propagate

## Step 9: Add Custom Domain (When Ready)

1. **In Vercel**, go to **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `mailsurge.com`)
4. Follow Vercel's DNS instructions
5. Update environment variables to use your custom domain:
   - `GOOGLE_REDIRECT_URI`: `https://your-domain.com/api/auth/callback`
   - `VITE_GOOGLE_REDIRECT_URI`: `https://your-domain.com/api/auth/callback`

## Troubleshooting

### Build Fails

**Check:**
- Build logs in Vercel dashboard
- Ensure `package.json` has correct build script
- Check Node.js version (should be 18+)

**Common Issues:**
- Missing environment variables
- TypeScript errors
- Missing dependencies

### Environment Variables Not Working

**Check:**
- Variables are set for correct environment (Production/Preview)
- Variables with `VITE_` prefix are exposed to frontend
- Redeploy after adding variables

### OAuth Not Working

**Check:**
- Redirect URI matches exactly (no trailing slash)
- Google OAuth redirect URI is updated
- Environment variables are set correctly
- Wait 5-10 minutes after updating Google OAuth settings

## Quick Checklist

- [ ] Imported GitHub repository
- [ ] Configured build settings (Vite, `npm run build`, `dist`)
- [ ] Added all environment variables
- [ ] Set production branch to `main`
- [ ] Redeployed with environment variables
- [ ] Updated Google OAuth redirect URI
- [ ] Tested deployment
- [ ] (Optional) Added custom domain

## Next Steps

After setup:
1. Continue development on `develop` branch
2. Merge to `main` when ready to deploy
3. Vercel automatically deploys from `main`
4. Monitor deployments in Vercel dashboard

---

**Need Help?**
- Check Vercel deployment logs
- Review error messages in browser console
- Verify all environment variables are set
- See [CUSTOM_DOMAIN_DEPLOYMENT.md](./CUSTOM_DOMAIN_DEPLOYMENT.md) for custom domain setup

