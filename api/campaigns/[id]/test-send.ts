import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid campaign ID' });
  }

  try {
    // Check environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.error('Missing Google OAuth environment variables');
      return res.status(500).json({ error: 'Gmail OAuth not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in Vercel environment variables.' });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Get user and verify ownership
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user has test emails configured
    // Support both old format (single test_email) and new format (test_emails array)
    let testEmails: string[] = [];
    if (user.user_metadata?.test_emails && Array.isArray(user.user_metadata.test_emails)) {
      testEmails = user.user_metadata.test_emails.filter((email: string) => email && email.trim() !== '');
    } else if (user.user_metadata?.test_email) {
      testEmails = [user.user_metadata.test_email];
    }
    
    if (testEmails.length === 0) {
      return res.status(400).json({ error: 'Test emails not configured. Please add at least one test email in Settings.' });
    }

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check if user has Gmail tokens stored
    const accessToken = user.user_metadata?.gmail_token;
    const refreshToken = user.user_metadata?.gmail_refresh_token;
    
    if (!accessToken || !refreshToken) {
      return res.status(400).json({ error: 'Gmail not connected. Please connect your Gmail account in Settings.' });
    }

    // Set up OAuth client
    let redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
      redirectUri = `https://${redirectUri}`;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Refresh token if needed
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) {
        oauth2Client.setCredentials(credentials);
        // Update stored token if it was refreshed
        if (credentials.access_token !== accessToken) {
          await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...user.user_metadata,
              gmail_token: credentials.access_token,
              gmail_token_expiry: credentials.expiry_date,
            },
          });
        }
      }
    } catch (refreshError) {
      console.error('Error refreshing token:', refreshError);
      // Continue anyway - token might still be valid
    }

    // Get sender email from campaign or fallback to user email
    let senderEmail = campaign.from_email || user.email;
    if (!senderEmail) {
      return res.status(400).json({ error: 'Sender email not found' });
    }

    // Personalize email with a test company name
    let html = campaign.body_html || '';
    let text = campaign.body_text || '';
    let subject = campaign.subject || '';

    // Replace {{company}} with a test company name
    html = html.replace(/\{\{company\}\}/g, 'Test Company');
    text = text.replace(/\{\{company\}\}/g, 'Test Company');
    subject = subject.replace(/\{\{company\}\}/g, 'Test Company');

    // Add test prefix to subject
    subject = `[TEST] ${subject}`;

    // Create email
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Send to all test email addresses
    const sentEmails: string[] = [];
    const errors: string[] = [];

    for (const testEmail of testEmails) {
      try {
        const emailLines = [
          `From: ${senderEmail}`,
          `To: ${testEmail}`,
          `Subject: ${subject}`,
          'Content-Type: text/html; charset=utf-8',
          'MIME-Version: 1.0',
          '',
          html || text,
        ];

        const email = emailLines.join('\r\n');

        // Encode to base64url format (Gmail API requirement)
        const encodedEmail = Buffer.from(email)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        // Send email
        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedEmail,
          },
        });

        sentEmails.push(testEmail);
        console.log(`[Test Send] Test email sent to ${testEmail} for campaign ${id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${testEmail}: ${errorMessage}`);
        console.error(`[Test Send] Failed to send to ${testEmail}:`, error);
      }
    }

    if (sentEmails.length === 0) {
      return res.status(500).json({ 
        error: 'Failed to send test emails',
        details: errors,
      });
    }

    if (errors.length > 0) {
      return res.status(207).json({ 
        message: `Test emails sent to ${sentEmails.length} of ${testEmails.length} recipients`,
        testEmails: sentEmails,
        errors,
      });
    }

    return res.status(200).json({ 
      message: `Test email${sentEmails.length > 1 ? 's' : ''} sent successfully`,
      testEmails: sentEmails,
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to send test email: ${errorMessage}` });
  }
}

