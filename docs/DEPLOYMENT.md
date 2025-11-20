# Deployment Guide

## Prerequisites

1. **GitHub Account** - For version control
2. **Vercel Account** - For hosting (free tier available)
3. **Supabase Account** - For database (free tier available)
4. **Google Cloud Account** - For Gmail API access

## Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for project to initialize
4. Go to **Settings** → **API**
5. Copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep this secret!)

6. Go to **SQL Editor**
7. Copy contents of `supabase/migrations/001_initial_schema.sql`
8. Paste and run the migration

## Step 2: Google Cloud Setup (Gmail API)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Gmail API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Gmail API"
   - Click **Enable**

4. Create OAuth 2.0 credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: "MailSurge"
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback` (development)
     - `https://your-domain.vercel.app/api/auth/callback` (production)
   - Click **Create**
   - Copy **Client ID** and **Client Secret**

## Step 3: Vercel Setup

1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub
3. Click **Add New Project**
4. Import your GitHub repository
5. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

6. Add environment variables:
   - Go to **Settings** → **Environment Variables**
   - Add the following:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/auth/callback
```

7. Click **Deploy**

## Step 4: Update Google OAuth Redirect URI

1. Go back to Google Cloud Console
2. Update OAuth redirect URI to match your Vercel domain:
   - `https://your-domain.vercel.app/api/auth/callback`

## Step 5: Local Development Setup

1. Clone repository:
```bash
git clone https://github.com/your-username/mailsurge.git
cd mailsurge
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Fill in `.env` with your values:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

5. Start dev server:
```bash
npm run dev
```

## Step 6: First User Setup

1. Open your deployed app
2. Sign up for an account
3. Go to **Settings**
4. Click **Connect Gmail**
5. Authorize MailSurge to send emails
6. You're ready to create campaigns!

## Troubleshooting

### Database Connection Issues

- Verify Supabase URL and keys are correct
- Check Supabase project is active
- Ensure RLS policies are set up correctly

### Gmail API Errors

- Verify OAuth credentials are correct
- Check redirect URI matches exactly
- Ensure Gmail API is enabled in Google Cloud
- Check user has granted permissions

### Build Errors

- Ensure all environment variables are set
- Check Node.js version (should be 18+)
- Clear `.next` or `dist` folder and rebuild

### Authentication Issues

- Verify Supabase Auth is enabled
- Check email confirmation settings in Supabase
- Ensure JWT tokens are being sent correctly

## Production Checklist

- [ ] All environment variables set in Vercel
- [ ] Database migrations run in Supabase
- [ ] Gmail OAuth redirect URI updated
- [ ] Custom domain configured (optional)
- [ ] Error tracking set up (optional)
- [ ] Analytics configured (optional)
- [ ] Backup strategy in place

## Monitoring

### Vercel

- Check **Deployments** tab for build status
- Monitor **Analytics** for traffic
- Review **Logs** for errors

### Supabase

- Monitor **Database** usage
- Check **Auth** logs
- Review **API** usage

### Gmail API

- Monitor daily email quota (2,000/day)
- Check OAuth token expiry
- Review error logs

## Scaling

When you need to scale:

1. **Database**: Upgrade Supabase plan
2. **Email Volume**: Add more Gmail accounts or use email service
3. **Performance**: Upgrade Vercel plan or add CDN
4. **Queue**: Add Redis for background jobs

## Security Best Practices

1. **Never commit** `.env` files
2. **Use service role key** only in serverless functions
3. **Rotate secrets** regularly
4. **Enable 2FA** on all accounts
5. **Monitor** for suspicious activity
6. **Keep dependencies** updated

## Support

For issues:
1. Check documentation
2. Review error logs
3. Open GitHub issue
4. Contact support




