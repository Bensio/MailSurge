# Quick Setup Instructions

## ✅ Step 1: Environment Variables (DONE)
Your `.env` file has been updated with your Supabase credentials!

## 📋 Step 2: Run Database Migration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/oqvcpqutqxdmadqmmgdo
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

This will create all the necessary tables:
- `campaigns` - for storing email campaigns
- `contacts` - for storing email recipients
- `templates` - for storing email templates
- Row Level Security (RLS) policies for data protection

## 🚀 Step 3: Restart Dev Server

After updating `.env`, you need to restart the dev server:

```bash
npm run dev
```

## 🎉 Step 4: Test the App

1. Open http://localhost:3000
2. You should now see the **Login** page (not the Setup page)
3. Click "Sign up" to create your first account
4. After signing up, you'll be redirected to the Dashboard

## 📧 Step 5: (Optional) Set Up Gmail OAuth

If you want to test email sending:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Gmail API**
4. Create **OAuth 2.0 credentials** (Web application)
5. Add redirect URI: `http://localhost:3000/api/auth/callback`
6. Copy Client ID and Client Secret
7. Update `.env` file:
   ```
   VITE_GOOGLE_CLIENT_ID=your-actual-client-id
   VITE_GOOGLE_CLIENT_SECRET=your-actual-client-secret
   ```
8. Restart dev server again

## 🎯 What You Can Do Now

- ✅ Sign up / Sign in
- ✅ Create email campaigns
- ✅ Upload contacts via CSV
- ✅ Design emails (with Unlayer editor)
- ⏳ Send emails (requires Gmail OAuth setup)

---

**Note**: The dev server needs to be restarted after changing `.env` file to pick up new environment variables.



