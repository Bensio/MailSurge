# Verify Inngest Signing Key Match

## Problem

- Both keys are set (`has_event_key: true`, `has_signing_key: true`)
- Redeployed
- But `authentication_succeeded: false`

This means the signing key **doesn't match exactly**.

## Step-by-Step Verification

### Step 1: Get Exact Key from Inngest

1. On "Sync your app to Inngest" screen
2. **Click the eye icon** to reveal the signing key
3. **Select ALL** of it (it's very long)
4. **Copy** it (Ctrl+C or right-click copy)
5. **Paste it into a text editor** (Notepad, etc.) to see the full key
6. **Count the characters** - it should be around 70-80 characters

### Step 2: Get Exact Key from Vercel

1. Go to **Vercel** → Settings → Environment Variables
2. Find `INNGEST_SIGNING_KEY`
3. **Click the eye icon** to reveal it
4. **Select ALL** of it
5. **Copy** it
6. **Paste it into the same text editor** (below the Inngest one)

### Step 3: Compare Side-by-Side

In your text editor, you should have:
```
Inngest key: signkey-prod-75e7833967ddc24e887648d23fb52841eb96630e995c587e7b5912c859f1f
Vercel key:  signkey-prod-75e7833967ddc24e887648d23fb52841eb96630e995c587e7b5912c859f1f
```

**Check:**
- ✅ Same length?
- ✅ Same characters?
- ✅ No extra spaces at start?
- ✅ No extra spaces at end?
- ✅ No line breaks?

### Step 4: If They Don't Match

1. **Delete** `INNGEST_SIGNING_KEY` in Vercel (both Production and Preview)
2. **Copy fresh** from Inngest (the one in text editor)
3. **Paste directly** into Vercel (don't type it)
4. **Check both Production and Preview** have the same key
5. **Save**
6. **Redeploy** (wait for it to complete)

### Step 5: Check for Hidden Characters

Sometimes copy-paste adds hidden characters:

1. In your text editor, select the Vercel key
2. **Delete it completely**
3. **Type it manually** (if it's not too long)
4. Or use a clean copy-paste tool

## Alternative: Use Vercel CLI

If the web UI is causing issues:

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Set environment variable:**
   ```bash
   vercel env add INNGEST_SIGNING_KEY production
   ```
   (Paste the key when prompted)

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

## Check Vercel Logs

After redeploying, check if the key is being read:

1. Go to **Vercel** → **Functions** → `/api/inngest`
2. Click **"Logs"** tab
3. Look for any errors about signing key
4. Check if `process.env.INNGEST_SIGNING_KEY` is being read

## Nuclear Option: Delete All and Re-add

1. **Delete** `INNGEST_SIGNING_KEY` (Production)
2. **Delete** `INNGEST_SIGNING_KEY` (Preview)
3. **Delete** `INNGEST_EVENT_KEY` (Production)
4. **Delete** `INNGEST_EVENT_KEY` (Preview)
5. **Wait 2 minutes**
6. **Add them back** - copy fresh from Inngest
7. **Redeploy**
8. **Wait for deployment to complete**
9. **Test**

## Most Common Issue

**The signing key has a trailing space or missing character.**

Make absolutely sure:
- You copied the ENTIRE key from Inngest
- No spaces before or after
- Same for both Production and Preview environments

