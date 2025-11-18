# Inngest Debugging Guide

## "App is not reachable" Error

If Inngest shows "App is not reachable" and all fields are "UNKNOWN", follow these steps:

### Step 1: Verify the Endpoint is Deployed

1. **Check Vercel Deployments:**
   - Go to Vercel → Your Project → Deployments
   - Make sure the latest deployment is successful
   - Check that `api/inngest.ts` is in the deployment files

2. **Test the Endpoint Manually:**
   - Open your browser and go to: `https://your-production-url.vercel.app/api/inngest`
   - You should see a response (even an error is good - it means the endpoint exists)
   - If you get "404 Not Found", the endpoint isn't deployed correctly

### Step 2: Check Environment Variables

Make sure these are set in Vercel:
- `INNGEST_EVENT_KEY` - Your Inngest event key
- `INNGEST_SIGNING_KEY` - Your Inngest signing key
- `SUPABASE_URL` - Your Supabase URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service key

### Step 3: Check Vercel Logs

1. Go to Vercel → Your Project → Functions → `/api/inngest`
2. Check the logs for any errors
3. Look for:
   - Import errors
   - Missing environment variables
   - Runtime errors

### Step 4: Verify the URL in Inngest

1. **In Inngest Dashboard:**
   - Go to Settings → App URL
   - Make sure it's set to: `https://your-production-domain.vercel.app/api/inngest`
   - **NOT** a preview URL (no hash in the middle)

2. **In Inngest Vercel Integration:**
   - Make sure "Path information" is set to: `/api/inngest`
   - Make sure "Deployment protection key" is filled if you have deployment protection enabled

### Step 5: Test with curl

Run this command to test if the endpoint responds:

```bash
curl -X GET https://your-production-url.vercel.app/api/inngest
```

You should get a response. If you get a timeout or connection error, the endpoint isn't accessible.

### Step 6: Check CORS and Headers

The endpoint should accept:
- GET requests (for introspection)
- POST requests (for function invocations)
- OPTIONS requests (for CORS preflight)

### Common Issues

1. **Preview URL instead of Production:**
   - ❌ Wrong: `https://mail-surge-8soz0nyhu-janis-projects-ecdca553.vercel.app/api/inngest`
   - ✅ Right: `https://mail-surge.vercel.app/api/inngest`

2. **Missing Environment Variables:**
   - Check Vercel → Settings → Environment Variables
   - Make sure all required variables are set

3. **Deployment Protection:**
   - If enabled, make sure the deployment protection key is set in Inngest
   - Or disable deployment protection for testing

4. **Endpoint Not Deployed:**
   - Make sure `api/inngest.ts` exists in your repository
   - Make sure it's committed and pushed
   - Check Vercel deployment logs

### Authentication Failed (`authentication_succeeded: false`)

If the endpoint responds but shows `authentication_succeeded: false`:

1. **Verify Signing Key:**
   - Go to Inngest Dashboard → Settings → Keys
   - Copy the **Signing Key** (not the Event Key)
   - Go to Vercel → Settings → Environment Variables
   - Make sure `INNGEST_SIGNING_KEY` matches exactly (no extra spaces, correct value)

2. **Check for Typos:**
   - The signing key is case-sensitive
   - Make sure there are no leading/trailing spaces
   - Copy-paste directly, don't type it

3. **Redeploy After Changing Environment Variables:**
   - After updating environment variables in Vercel, you need to redeploy
   - Go to Vercel → Deployments → Click "Redeploy" on the latest deployment
   - Or push a new commit to trigger a new deployment

4. **Verify Both Keys Are Set:**
   - `INNGEST_EVENT_KEY` - For sending events (from Inngest Dashboard → Keys)
   - `INNGEST_SIGNING_KEY` - For authenticating requests (from Inngest Dashboard → Keys)

### Still Not Working?

1. **Check Vercel Function Logs:**
   - Go to Vercel → Your Project → Functions
   - Click on `/api/inngest`
   - Check "Logs" tab for errors

2. **Try Manual Test:**
   - Create a simple test: `curl -v https://your-url.vercel.app/api/inngest`
   - Check what response you get

3. **Verify Build:**
   - Make sure `npm run build` succeeds locally
   - Check for TypeScript errors

4. **Contact Support:**
   - If nothing works, check Inngest documentation
   - Or contact Inngest support with your logs

