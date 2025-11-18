# Changes Made for Custom Domain Deployment

This document summarizes the changes made to prepare MailSurge for deployment to a custom domain.

## Files Modified

### 1. `server.js`
**Changes:**
- Updated hardcoded `localhost:3000` redirects to use `FRONTEND_URL` environment variable
- Added fallback to `http://localhost:3000` for local development
- All error page redirects now use dynamic frontend URL

**Impact:** 
- Local development: Works as before (uses default localhost)
- Production: Can be configured via `FRONTEND_URL` environment variable
- **Note:** `server.js` is only used for local development. Vercel uses serverless functions in `api/` folder.

### 2. `src/pages/Settings.tsx`
**Changes:**
- Updated hardcoded redirect URI in documentation to use `VITE_GOOGLE_REDIRECT_URI` environment variable
- Shows actual redirect URI being used (localhost for dev, custom domain for production)

**Impact:**
- Users will see the correct redirect URI in the setup instructions
- Automatically adapts to production environment

### 3. `api/auth/callback.ts` (Vercel Serverless Function)
**Status:** ✅ Already correct
- Uses relative redirect (`/settings?gmail=connected`) which works for any domain
- Uses environment variables for OAuth configuration

## New Documentation

### 1. `docs/CUSTOM_DOMAIN_DEPLOYMENT.md`
Comprehensive guide covering:
- Hosting platform options (Vercel recommended)
- Step-by-step deployment instructions
- Custom domain configuration
- Google OAuth setup
- Environment variable configuration
- Troubleshooting guide
- Alternative VPS deployment option

### 2. `docs/CUSTOM_DOMAIN_QUICK_START.md`
Quick reference checklist for deployment:
- Condensed step-by-step checklist
- Common issues and fixes
- Environment variable reference

## What You Need to Do

### For Production Deployment:

1. **Deploy to Vercel:**
   - Push code to GitHub
   - Connect to Vercel
   - Configure build settings

2. **Set Environment Variables in Vercel:**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback
   
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GOOGLE_CLIENT_ID=your-client-id
   VITE_GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback
   ```

3. **Add Custom Domain:**
   - In Vercel dashboard → Settings → Domains
   - Configure DNS at your registrar

4. **Update Google OAuth:**
   - Add production redirect URI to Google Cloud Console
   - Keep localhost URI for local development

5. **Test Everything:**
   - Authentication
   - Gmail OAuth
   - Campaign creation
   - Email sending

### For Local Development:

No changes needed! Your existing `.env` file will continue to work. Optionally, you can add:

```env
FRONTEND_URL=http://localhost:3000
```

This is only needed if you want to override the default localhost URL.

## Key Points

1. **Vercel Serverless Functions**: The `api/` folder contains serverless functions that automatically work with your custom domain. No code changes needed there.

2. **Environment Variables**: 
   - Variables with `VITE_` prefix are exposed to the frontend
   - Variables without `VITE_` are server-side only
   - Set both in Vercel for production

3. **OAuth Redirect URIs**: Must match exactly in Google Cloud Console. Include both:
   - `http://localhost:3000/api/auth/callback` (for local dev)
   - `https://your-domain.com/api/auth/callback` (for production)

4. **Relative URLs**: The Vercel serverless function uses relative redirects (`/settings`), which automatically work for any domain.

## Next Steps

1. Review the deployment guides:
   - [CUSTOM_DOMAIN_DEPLOYMENT.md](./docs/CUSTOM_DOMAIN_DEPLOYMENT.md) - Full guide
   - [CUSTOM_DOMAIN_QUICK_START.md](./docs/CUSTOM_DOMAIN_QUICK_START.md) - Quick checklist

2. Purchase a domain (if you haven't already)

3. Follow the deployment steps in the guides

4. Test thoroughly before going live

## Questions?

- Check the troubleshooting sections in the deployment guides
- Review Vercel deployment logs
- Check browser console for errors
- Verify all environment variables are set correctly

---

**Summary**: The codebase is now ready for custom domain deployment. The main work is configuring Vercel, setting environment variables, and updating Google OAuth settings.

