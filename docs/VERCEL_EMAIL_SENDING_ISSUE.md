# Vercel Email Sending Issue - Root Cause & Solutions

## The Problem

**Vercel serverless functions terminate immediately when the HTTP response is sent.**

When you call the send endpoint:
1. Function starts
2. Response is sent immediately (200 OK)
3. **Function execution context is terminated**
4. Background task gets killed before it can send emails

This is why you see:
- Status changes to "queued" (happens before response)
- But emails never send (background task is killed)

## Why This Happens

Vercel serverless functions are designed to be stateless and short-lived:
- **Free tier**: 10 second timeout
- **Pro tier**: 60 second timeout
- Function execution ends when response is sent

The `void (async () => {})()` pattern doesn't work because the function context is destroyed.

## Solutions

### Option 1: Upgrade to Vercel Pro (Quick Fix) ⚡

**Cost**: $20/month
**Benefit**: 60 second timeout instead of 10 seconds

This gives the background task more time to complete, but still has limits for large campaigns.

### Option 2: Use a Queue System (Recommended) 🎯

**Services**:
- **Inngest** (free tier available) - Built for serverless
- **Trigger.dev** (free tier available)
- **BullMQ** with Redis (requires hosting)
- **Vercel Background Functions** (if available)

**How it works**:
1. Send endpoint creates a job in the queue
2. Responds immediately
3. Queue worker processes emails asynchronously
4. No timeout issues

### Option 3: Send Emails Synchronously (Not Recommended) ⚠️

Wait for emails to send before responding:
- User has to wait (bad UX)
- Still hits timeout limits
- Only works for very small campaigns

### Option 4: Use Separate API Calls (Workaround) 🔧

Send one email per API call:
- Frontend calls API multiple times
- Each call sends one email
- More API calls but avoids timeout
- Complex to implement

### Option 5: Use Vercel Cron Jobs (Alternative) ⏰

Use Vercel cron to process queued emails:
- Create a cron job that runs every minute
- Checks for queued emails
- Sends them one by one
- More reliable but slower

## Recommended Solution: Inngest

Inngest is designed for this exact use case - long-running tasks in serverless environments.

### Setup Inngest

1. **Sign up**: [inngest.com](https://inngest.com)
2. **Install**:
   ```bash
   npm install inngest
   ```
3. **Create function**:
   ```typescript
   // api/inngest/send-emails.ts
   import { inngest } from '@/lib/inngest';
   
   export default inngest.createFunction(
     { id: "send-campaign-emails" },
     { event: "campaign.send" },
     async ({ event, step }) => {
       // Send emails here
       // This runs in a separate execution context
     }
   );
   ```
4. **Trigger from send endpoint**:
   ```typescript
   await inngest.send({
     name: "campaign.send",
     data: { campaignId: id }
   });
   ```

## Temporary Workaround

For now, you can:
1. **Upgrade to Vercel Pro** ($20/month) - gives you 60 seconds
2. **Reduce delay between emails** - send faster to complete within timeout
3. **Send smaller batches** - break campaigns into smaller chunks

## Current Status

The code is structured correctly, but Vercel's execution model prevents background tasks from completing. This is a platform limitation, not a code issue.

## Next Steps

1. **Short term**: Upgrade to Vercel Pro for 60s timeout
2. **Long term**: Implement Inngest or similar queue system
3. **Alternative**: Consider moving email sending to a traditional server (VPS)

