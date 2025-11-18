# Quick Fix Guide

## Issues Fixed

1. ✅ **API Routes Not Working** - Created Express server for local development
2. ✅ **Google OAuth 400 Error** - Added better error handling and validation
3. ✅ **Dashboard Empty** - API server will now handle requests properly

## How to Run

### Option 1: Run Both Servers (Recommended)

```bash
npm run dev:all
```

This runs both:
- Vite dev server on port 3000 (frontend)
- Express API server on port 3001 (backend)

### Option 2: Run Separately

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
npm run dev:api
```

## Environment Variables Needed

Make sure your `.env` file has:

```env
# Supabase (for frontend)
VITE_SUPABASE_URL=https://oqvcpqutqxdmadqmmgdo.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Key (for API server - get from Supabase Dashboard)
SUPABASE_SERVICE_KEY=your-service-role-key

# Google OAuth (optional - only if you want to send emails)
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

## Get Supabase Service Key

1. Go to your Supabase Dashboard
2. Click **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key)
4. Add it to `.env` as `SUPABASE_SERVICE_KEY`

⚠️ **Important**: The service key has admin privileges. Never commit it to git!

## What Should Work Now

- ✅ Dashboard loads campaigns
- ✅ Create new campaigns
- ✅ Upload contacts
- ✅ View campaign details
- ✅ Settings page (Gmail OAuth will show helpful error if not configured)

## Google OAuth Setup (Optional)

If you want to test email sending:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `http://localhost:3000/api/auth/callback`
4. Copy Client ID and Secret to `.env`
5. Restart servers

## Troubleshooting

**"Failed to fetch campaigns"**
- Make sure API server is running on port 3001
- Check browser console for errors
- Verify Supabase credentials in `.env`

**"Google OAuth 400 Error"**
- Check if `VITE_GOOGLE_CLIENT_ID` is set and not a placeholder
- Verify redirect URI matches Google Cloud Console
- Make sure you've restarted the server after updating `.env`

**Port Already in Use**
- Stop any other servers on ports 3000 or 3001
- Or change ports in `vite.config.ts` and `server.js`



