# Custom Domain Deployment - Quick Start Checklist

This is a condensed checklist for deploying MailSurge to a custom domain. For detailed instructions, see [CUSTOM_DOMAIN_DEPLOYMENT.md](./CUSTOM_DOMAIN_DEPLOYMENT.md).

## Prerequisites

- [ ] Domain purchased and DNS access
- [ ] GitHub repository with your code
- [ ] Supabase project set up
- [ ] Google Cloud project with Gmail API enabled

---

## Deployment Steps

### 1. Deploy to Vercel

- [ ] Sign up/login at [vercel.com](https://vercel.com)
- [ ] Import your GitHub repository
- [ ] Configure build settings:
  - Framework: Vite
  - Build Command: `npm run build`
  - Output Directory: `dist`

### 2. Set Environment Variables in Vercel

Add these in **Settings → Environment Variables** (for Production):

```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Google OAuth (Server-side)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback

# Google OAuth (Frontend - VITE_ prefix)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback
```

⚠️ **Replace `your-domain.com` with your actual domain!**

### 3. Add Custom Domain in Vercel

- [ ] Go to **Settings → Domains**
- [ ] Click **Add Domain**
- [ ] Enter your domain (e.g., `mailsurge.com`)
- [ ] Follow Vercel's DNS instructions

### 4. Configure DNS at Your Registrar

**For root domain** (`mailsurge.com`):
```
Type: A
Name: @
Value: [IP from Vercel dashboard]

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

- [ ] Wait 5-60 minutes for DNS propagation

### 5. Update Google OAuth Redirect URI

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com)
- [ ] Navigate to **APIs & Services → Credentials**
- [ ] Edit your OAuth 2.0 Client ID
- [ ] Add to **Authorized redirect URIs**:
  ```
  https://your-domain.com/api/auth/callback
  ```
- [ ] **Keep** localhost URI for local development:
  ```
  http://localhost:3000/api/auth/callback
  ```
- [ ] Click **Save**
- [ ] Wait 5-10 minutes for changes to propagate

### 6. Update Supabase (Optional)

- [ ] Go to Supabase Dashboard → **Settings → API**
- [ ] Add your domain to **Site URL**: `https://your-domain.com`
- [ ] Add to **Redirect URLs**: `https://your-domain.com/**`

### 7. Test Your Deployment

- [ ] Visit `https://your-domain.com`
- [ ] Test sign up / sign in
- [ ] Test Gmail OAuth connection
- [ ] Test campaign creation
- [ ] Test email sending (if Gmail connected)

---

## Common Issues

### OAuth Redirect URI Mismatch

**Symptom**: `redirect_uri_mismatch` error

**Fix**:
1. Verify redirect URI in Google Cloud Console matches exactly (no trailing slash)
2. Must be `https://` (not `http://`)
3. Wait 5-10 minutes after updating

### Environment Variables Not Working

**Symptom**: Variables show as `undefined`

**Fix**:
1. Ensure variables are set for **Production** environment in Vercel
2. Variables with `VITE_` prefix are exposed to frontend
3. Redeploy after adding variables

### SSL Certificate Issues

**Symptom**: Browser shows security warning

**Fix**:
- Vercel automatically provisions SSL
- Wait 5-10 minutes after adding domain
- Verify DNS is correctly configured

---

## Local Development After Production Deployment

After deploying to production, update your local `.env` file:

```env
# Keep localhost for local development
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
FRONTEND_URL=http://localhost:3000
```

The `FRONTEND_URL` variable is used by `server.js` for local development redirects.

---

## Summary

**Critical Steps:**
1. ✅ Deploy to Vercel
2. ✅ Add custom domain
3. ✅ Configure DNS
4. ✅ Update Google OAuth redirect URI
5. ✅ Set all environment variables
6. ✅ Test everything

**Time Estimate**: 30-60 minutes (plus DNS propagation wait)

---

## Need Help?

- Check [CUSTOM_DOMAIN_DEPLOYMENT.md](./CUSTOM_DOMAIN_DEPLOYMENT.md) for detailed instructions
- Review Vercel deployment logs
- Check browser console for errors
- Verify all environment variables are set correctly

