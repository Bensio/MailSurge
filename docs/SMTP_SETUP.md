# SMTP Setup Guide (Plug-and-Play Email Sending)

MailSurge now uses SMTP for email sending, which means **one-time admin configuration** - no per-user OAuth setup required!

## Quick Setup (5 minutes)

### Step 1: Create Gmail App Password

1. Go to your Google Account: https://myaccount.google.com
2. Navigate to **Security** → **2-Step Verification** (enable it if not already enabled)
3. Scroll down to **App passwords**
4. Click **Select app** → Choose **Mail**
5. Click **Select device** → Choose **Other (Custom name)**
6. Enter "MailSurge" and click **Generate**
7. **Copy the 16-character password** (you'll need this!)

### Step 2: Set Environment Variables in Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=MailSurge
```

**Important:**
- `SMTP_USER`: Your Gmail address
- `SMTP_PASSWORD`: The 16-character App Password from Step 1
- `SMTP_FROM_EMAIL`: Can be different from `SMTP_USER` (e.g., a custom domain email)
- `SMTP_FROM_NAME`: Display name for sent emails

### Step 3: Deploy

After setting environment variables, redeploy your Vercel app. All users can now send emails without any configuration!

## Gmail Sending Limits

- **Free Gmail**: 500 emails/day
- **Google Workspace**: 2,000 emails/day

For higher limits, consider:
- Multiple Gmail accounts (rotate SMTP credentials)
- Google Workspace account
- Other SMTP providers (SendGrid, Mailgun, etc.)

## Using Other SMTP Providers

You can use any SMTP provider by changing the environment variables:

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

### Custom SMTP
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASSWORD=your-password
```

## Benefits

✅ **Plug-and-play**: One-time setup, all users can send  
✅ **No OAuth**: No per-user Gmail connection needed  
✅ **Free**: Uses Gmail's free tier (500 emails/day)  
✅ **Reliable**: SMTP is industry-standard  
✅ **Flexible**: Easy to switch providers  

## Troubleshooting

### "SMTP not configured" error
- Check that `SMTP_USER` and `SMTP_PASSWORD` are set in Vercel
- Redeploy after adding environment variables

### "Authentication failed" error
- Verify your App Password is correct (16 characters, no spaces)
- Make sure 2-Step Verification is enabled on your Google Account
- Try regenerating the App Password

### Emails not sending
- Check Gmail daily sending limit (500/day for free accounts)
- Verify SMTP credentials are correct
- Check Vercel function logs for detailed error messages

