# Manual Inngest Setup (When Integration Doesn't Work)

If the Vercel integration isn't working and you can't see your app, set it up manually:

## Step 1: Create App Manually in Inngest

1. **Go to Inngest Dashboard:**
   - Visit: https://app.inngest.com
   - Log in to your account

2. **Create a New App:**
   - Look for a "+" button or "Create App" button
   - Or go to: https://app.inngest.com/apps/new
   - Name it: `MailSurge` (or whatever you want)
   - Click "Create"

3. **Get Your Keys:**
   - Once the app is created, go to: **Settings** → **Keys**
   - You'll see:
     - **Event Key** - Copy this
     - **Signing Key** - Copy this (this is what we need!)

## Step 2: Set App URL Manually

1. **In the Inngest app you just created:**
   - Go to **Settings** → **App URL** (or "Sync URL")
   - Enter: `https://mail-surge.vercel.app/api/inngest`
   - **IMPORTANT:** Must include:
     - `https://` at the start
     - Full domain: `mail-surge.vercel.app`
     - Path: `/api/inngest`
     - **NO trailing slash**
   - Make sure it's your **production** URL, not preview
   - Save

**Common mistake:** If you only enter `mail-surge.vercel.app` (without `https://` and `/api/inngest`), the sync will be grayed out!

## Step 3: Add Keys to Vercel

1. **Go to Vercel:**
   - Your Project → **Settings** → **Environment Variables**

2. **Add these variables:**
   ```
   INNGEST_EVENT_KEY=<paste your event key here>
   INNGEST_SIGNING_KEY=<paste your signing key here>
   ```

3. **Important:** Make sure:
   - No extra spaces
   - Copy-paste directly
   - Use the **Signing Key** (not Event Key) for `INNGEST_SIGNING_KEY`

## Step 4: Redeploy Vercel

**You MUST redeploy after adding environment variables:**

1. Go to Vercel → **Deployments**
2. Click **three dots** (⋯) on latest deployment
3. Click **"Redeploy"**
4. Wait for it to finish

## Step 5: Test

1. Visit: `https://mail-surge.vercel.app/api/inngest`
2. You should see:
   ```json
   {
     "authentication_succeeded": true,
     "function_count": 1
   }
   ```

## If You Still Can't Find the App

### Option A: Check All Apps
1. In Inngest dashboard, look for "Apps" in the sidebar
2. Click on it to see all your apps
3. The app might be there but not visible in the main view

### Option B: Check Vercel Integration
1. In Inngest, go to **Settings** → **Integrations** (or "Vercel")
2. You might see the Vercel integration there
3. Click on it to see connected apps

### Option C: Disconnect and Reconnect
1. In Inngest, disconnect the Vercel integration
2. Reconnect it
3. This might refresh the app list

## Alternative: Use Inngest CLI

If the web interface isn't working, you can use the CLI:

1. **Install Inngest CLI:**
   ```bash
   npm install -g inngest-cli
   ```

2. **Login:**
   ```bash
   inngest login
   ```

3. **Dev Server (for testing):**
   ```bash
   inngest dev
   ```

But for production, you still need to configure it via the web interface.

## Still Stuck?

The key issue is usually:
1. **Can't find the app** → Check "Apps" section in sidebar
2. **Can't change URL** → You need to find the app first, then Settings → App URL
3. **Keys not working** → Make sure you're using Signing Key (not Event Key) and redeployed

Try creating a new app manually - that's the most reliable way.

