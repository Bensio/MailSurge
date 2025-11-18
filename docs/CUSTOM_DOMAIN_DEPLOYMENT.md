# Custom Domain Deployment Guide

This guide walks you through deploying MailSurge to a custom domain (e.g., `mailsurge.com` or `app.yourdomain.com`).

## Overview

MailSurge is currently set up for:
- **Local Development**: `localhost:3000` (frontend) + `localhost:3001` (API)
- **Vercel Deployment**: Uses Vercel serverless functions for API routes

For custom domain hosting, you'll need to:
1. Choose a hosting platform (Vercel recommended)
2. Configure your custom domain
3. Update all environment variables
4. Update Google OAuth redirect URIs
5. Update any hardcoded URLs in the codebase

---

## Step 1: Choose a Hosting Platform

### Option A: Vercel (Recommended) ⭐

**Pros:**
- Already configured (`vercel.json` exists)
- Free tier available
- Automatic HTTPS/SSL
- Easy custom domain setup
- Serverless functions for API routes
- Global CDN

**Cons:**
- Serverless function timeout limits (10s on free tier, 60s on Pro)
- May need to refactor long-running email sending to background jobs

### Option B: Traditional VPS (DigitalOcean, AWS EC2, etc.)

**Pros:**
- Full control
- No timeout limits
- Can run `server.js` directly

**Cons:**
- Need to manage server, SSL, updates
- More complex setup
- Need to configure reverse proxy (nginx)

**For this guide, we'll focus on Vercel as it's the easiest path.**

---

## Step 2: Prepare Your Domain

1. **Purchase a domain** (if you haven't already)
   - Popular registrars: Namecheap, Google Domains, Cloudflare, GoDaddy

2. **DNS Configuration** (we'll do this after Vercel setup)

---

## Step 3: Deploy to Vercel

### 3.1 Initial Deployment

1. **Push your code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click **Add New Project**
   - Import your MailSurge repository

3. **Configure Build Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Add Environment Variables** (in Vercel Dashboard → Settings → Environment Variables):

   **For Production:**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=https://your-custom-domain.com/api/auth/callback
   
   # Frontend variables (VITE_ prefix)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GOOGLE_CLIENT_ID=your-client-id
   VITE_GOOGLE_REDIRECT_URI=https://your-custom-domain.com/api/auth/callback
   ```

   ⚠️ **Important**: 
   - Replace `your-custom-domain.com` with your actual domain
   - Use the same values for both `GOOGLE_*` and `VITE_GOOGLE_*` variables
   - `VITE_GOOGLE_CLIENT_SECRET` is NOT needed (secret should only be server-side)

5. **Deploy**:
   - Click **Deploy**
   - Wait for build to complete
   - You'll get a Vercel URL like `mailsurge.vercel.app`

---

## Step 4: Configure Custom Domain

1. **In Vercel Dashboard**:
   - Go to your project → **Settings** → **Domains**
   - Click **Add Domain**
   - Enter your domain (e.g., `mailsurge.com` or `app.yourdomain.com`)
   - Follow Vercel's instructions

2. **Configure DNS** (at your domain registrar):
   
   **For root domain** (`mailsurge.com`):
   ```
   Type: A
   Name: @
   Value: 76.76.21.21 (Vercel's IP - check Vercel dashboard for current IP)
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

   **For subdomain** (`app.yourdomain.com`):
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```

3. **Wait for DNS propagation** (5-60 minutes)

4. **Verify SSL**: Vercel automatically provisions SSL certificates via Let's Encrypt

---

## Step 5: Update Google OAuth Settings

This is **critical** - OAuth will fail if redirect URIs don't match exactly.

1. **Go to Google Cloud Console**:
   - [console.cloud.google.com](https://console.cloud.google.com)
   - Navigate to your project
   - Go to **APIs & Services** → **Credentials**

2. **Edit your OAuth 2.0 Client ID**:
   - Click on your OAuth client
   - Under **Authorized redirect URIs**, add:
     ```
     https://your-custom-domain.com/api/auth/callback
     ```
   - **Keep** the localhost URI for local development:
     ```
     http://localhost:3000/api/auth/callback
     ```
   - Click **Save**

3. **Update OAuth Consent Screen** (if needed):
   - Go to **APIs & Services** → **OAuth consent screen**
   - Add your production domain to **Authorized domains**

---

## Step 6: Update Code for Production

The codebase has some hardcoded `localhost` references that need to be made dynamic. Here are the key files to update:

### Files That Need Updates:

1. **`server.js`** (for local dev only - not used in Vercel):
   - CORS settings already configured for localhost
   - This file is only for local development

2. **`api/auth/callback.ts`** (Vercel serverless function):
   - Currently redirects to `/settings?gmail=connected` (relative URL - good!)
   - ✅ No changes needed

3. **`src/lib/gmail.ts`**:
   - Uses `import.meta.env.VITE_GOOGLE_REDIRECT_URI` with localhost fallback
   - ✅ Will use environment variable in production

4. **`src/pages/Settings.tsx`**:
   - Has hardcoded localhost in documentation
   - ⚠️ Should be updated to show dynamic URL

5. **`server.js`** (local dev server):
   - Has hardcoded localhost redirects in error pages
   - ⚠️ Should use environment variable

---

## Step 7: Test Your Deployment

1. **Visit your custom domain**: `https://your-custom-domain.com`

2. **Test Authentication**:
   - Sign up for a new account
   - Sign in

3. **Test Gmail OAuth**:
   - Go to Settings
   - Click "Connect Gmail"
   - Should redirect to Google, then back to your custom domain

4. **Test Campaign Creation**:
   - Create a test campaign
   - Upload contacts
   - Try sending (if Gmail is connected)

---

## Step 8: Environment-Specific Configuration

### Development (Local)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
FRONTEND_URL=http://localhost:3000
```

**Note**: The `FRONTEND_URL` variable is used by `server.js` for local development redirects. It's optional and defaults to `http://localhost:3000` if not set.

### Production (Vercel)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-custom-domain.com/api/auth/callback

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_REDIRECT_URI=https://your-custom-domain.com/api/auth/callback
```

---

## Step 9: Update Supabase Settings (Optional)

1. **Add your domain to Supabase**:
   - Go to Supabase Dashboard → **Settings** → **API**
   - Under **Site URL**, add: `https://your-custom-domain.com`
   - Under **Redirect URLs**, add: `https://your-custom-domain.com/**`

---

## Troubleshooting

### OAuth Redirect URI Mismatch

**Error**: `redirect_uri_mismatch`

**Solution**:
1. Check that redirect URI in Google Cloud Console **exactly matches** your domain
2. No trailing slashes
3. Must be `https://` (not `http://`)
4. Wait 5-10 minutes after updating (Google caches OAuth settings)

### CORS Errors

**Error**: `Access to fetch blocked by CORS policy`

**Solution**:
- Vercel serverless functions handle CORS automatically
- If using custom server, update CORS in `server.js` to include your domain

### Environment Variables Not Working

**Error**: Variables show as `undefined`

**Solution**:
1. In Vercel, ensure variables are set for **Production** environment
2. Variables starting with `VITE_` are exposed to frontend
3. Non-`VITE_` variables are server-side only
4. Redeploy after adding variables

### SSL Certificate Issues

**Error**: `NET::ERR_CERT_AUTHORITY_INVALID`

**Solution**:
- Vercel automatically provisions SSL
- Wait 5-10 minutes after adding domain
- Check DNS is correctly configured

### Build Failures

**Error**: Build fails on Vercel

**Solution**:
1. Check build logs in Vercel dashboard
2. Ensure `package.json` has correct build script
3. Check Node.js version (should be 18+)
4. Ensure all dependencies are in `package.json` (not just `devDependencies`)

---

## Alternative: Deploy to VPS

If you prefer a traditional VPS setup:

### Requirements:
- Ubuntu 20.04+ server
- Node.js 18+
- PM2 (process manager)
- Nginx (reverse proxy)
- SSL certificate (Let's Encrypt)

### Steps:

1. **Install dependencies**:
   ```bash
   sudo apt update
   sudo apt install nodejs npm nginx certbot python3-certbot-nginx
   ```

2. **Clone and build**:
   ```bash
   git clone https://github.com/your-username/mailsurge.git
   cd mailsurge
   npm install
   npm run build
   ```

3. **Set up environment variables**:
   ```bash
   nano .env
   # Add all production environment variables
   ```

4. **Configure Nginx**:
   ```nginx
   server {
       listen 80;
       server_name your-custom-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
       }
   }
   ```

5. **Set up SSL**:
   ```bash
   sudo certbot --nginx -d your-custom-domain.com
   ```

6. **Run with PM2**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name mailsurge-api
   pm2 serve dist 3000 --name mailsurge-frontend --spa
   pm2 save
   pm2 startup
   ```

---

## Security Checklist

- [ ] All environment variables set in Vercel (not committed to git)
- [ ] `SUPABASE_SERVICE_KEY` is server-side only (never exposed to frontend)
- [ ] `GOOGLE_CLIENT_SECRET` is server-side only
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] OAuth redirect URIs match exactly
- [ ] Supabase RLS policies enabled
- [ ] Domain added to Supabase allowed origins
- [ ] Regular dependency updates
- [ ] Monitoring/error tracking set up (optional)

---

## Next Steps

After deployment:

1. **Set up monitoring**:
   - Vercel Analytics (built-in)
   - Error tracking (Sentry, LogRocket)
   - Uptime monitoring (UptimeRobot, Pingdom)

2. **Optimize performance**:
   - Enable Vercel Edge Caching
   - Optimize images
   - Enable compression

3. **Scale as needed**:
   - Upgrade Vercel plan if hitting limits
   - Consider background job queue for email sending
   - Add rate limiting

---

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Test OAuth redirect URI matches exactly
5. Review this guide's troubleshooting section

---

## Summary

**Quick Checklist:**

1. ✅ Deploy to Vercel
2. ✅ Add custom domain in Vercel
3. ✅ Configure DNS at registrar
4. ✅ Update Google OAuth redirect URI
5. ✅ Set all environment variables in Vercel
6. ✅ Test authentication and OAuth
7. ✅ Update Supabase allowed origins (optional)

Your app should now be live at `https://your-custom-domain.com`! 🎉

