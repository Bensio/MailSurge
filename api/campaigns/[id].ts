import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { processEmailImages } from '../lib/image-processing';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const inngest = new Inngest({ 
  id: 'mailsurge',
  name: 'MailSurge',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate Supabase configuration early
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('[Campaign Detail] Missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration error', details: 'Supabase not configured' });
  }

  const { id, action } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid campaign ID' });
  }

  try {
    // Get user from auth header
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Route based on action parameter or method
    if (action === 'send' || (req.method === 'POST' && !action)) {
      // POST /api/campaigns/[id]?action=send or POST /api/campaigns/[id]/send
      return handleSendCampaign(req, res, id, user);
    }

    if (action === 'test-send' || req.url?.includes('test-send')) {
      // POST /api/campaigns/[id]?action=test-send or POST /api/campaigns/[id]/test-send
      return handleTestSend(req, res, id, user);
    }

    // GET /api/campaigns/[id] - Get campaign
    if (req.method === 'GET') {
      try {
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (campaignError) {
          console.error('[GET Campaign] Database error:', campaignError);
          if (campaignError.code === 'PGRST116' || campaignError.message?.includes('No rows')) {
            return res.status(404).json({ error: 'Campaign not found' });
          }
          return res.status(500).json({ 
            error: 'Failed to fetch campaign', 
            details: campaignError.message,
            code: campaignError.code 
          });
        }

        if (!campaignData) {
          return res.status(404).json({ error: 'Campaign not found' });
        }

        // Optimize: Only fetch needed contact fields
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, email, company, name, status, sent_at, error, campaign_id, user_id, opened_at, open_count, tracking_token')
          .eq('campaign_id', id)
          .order('email', { ascending: true });

        if (contactsError) {
          console.error('[GET Campaign] Error fetching contacts:', contactsError);
          // Don't fail the request if contacts can't be fetched, just log it
        }

        return res.status(200).json({
          ...campaignData,
          contacts: contacts || [],
        });
      } catch (getError) {
        console.error('[GET Campaign] Unexpected error:', getError);
        const errorMessage = getError instanceof Error ? getError.message : 'Unknown error';
        return res.status(500).json({ 
          error: 'Internal server error', 
          details: errorMessage 
        });
      }
    }

    // PUT /api/campaigns/[id] - Update campaign
    if (req.method === 'PUT') {
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .update(req.body)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error || !campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      return res.status(200).json(campaign);
    }

    // DELETE /api/campaigns/[id] - Delete campaign
    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        return res.status(500).json({ error: 'Failed to delete campaign' });
      }

      return res.status(204).send('');
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Campaign Detail] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Campaign Detail] Error stack:', errorStack);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
    });
  }
}

// Handle campaign send
async function handleSendCampaign(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  user: any
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if at least one email method is configured
  const hasSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  const hasGmailOAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  
  if (!hasSMTP && !hasGmailOAuth) {
    return res.status(500).json({ error: 'No email sending method configured. Please set up either SMTP (SMTP_USER, SMTP_PASSWORD) or Gmail OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI).' });
  }

  const { scheduled_at } = req.body || {};

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*, contacts (*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  if (!campaign.contacts || campaign.contacts.length === 0) {
    return res.status(400).json({ error: 'No contacts in this campaign. Please add contacts before sending.' });
  }

  // If scheduled_at is provided and in the future, schedule the campaign
  if (scheduled_at) {
    const scheduledDate = new Date(scheduled_at);
    const now = new Date();
    
    if (scheduledDate <= now) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    // Schedule the campaign
    await supabase
      .from('campaigns')
      .update({ 
        scheduled_at: scheduled_at,
        status: 'draft' // Keep as draft until scheduled time
      })
      .eq('id', id);

    return res.status(200).json({ 
      status: 'scheduled', 
      scheduled_at: scheduled_at,
      total: campaign.contacts?.length || 0,
      message: `Campaign scheduled to send on ${new Date(scheduled_at).toLocaleString()}`
    });
  }

  // Send immediately
  await supabase
    .from('campaigns')
    .update({ status: 'sending', sent_at: new Date().toISOString(), scheduled_at: null })
    .eq('id', id);

  if (!process.env.INNGEST_EVENT_KEY) {
    return res.status(500).json({ 
      error: 'Inngest not configured', 
      details: 'INNGEST_EVENT_KEY environment variable is missing'
    });
  }

  try {
    await inngest.send({
      name: 'campaign/send',
      data: {
        campaignId: id,
        userId: user.id,
      },
    });
    
    return res.status(200).json({ 
      status: 'started', 
      total: campaign.contacts?.length || 0,
      message: 'Email sending started via Inngest. Emails will be sent in the background.'
    });
  } catch (inngestError) {
    console.error('[API] Error sending to Inngest:', inngestError);
    return res.status(500).json({ 
      error: 'Failed to start email sending', 
      details: inngestError instanceof Error ? inngestError.message : 'Unknown error',
    });
  }
}

// Handle test send
async function handleTestSend(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  user: any
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if at least one email method is configured
  const hasSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  const hasGmailOAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  
  if (!hasSMTP && !hasGmailOAuth) {
    return res.status(500).json({ error: 'No email sending method configured. Please set up either SMTP or Gmail OAuth.' });
  }

  let testEmails: string[] = [];
  if (user.user_metadata?.test_emails && Array.isArray(user.user_metadata.test_emails)) {
    testEmails = user.user_metadata.test_emails.filter((email: string) => email && email.trim() !== '');
  } else if (user.user_metadata?.test_email) {
    testEmails = [user.user_metadata.test_email];
  }
  
  if (testEmails.length === 0) {
    return res.status(400).json({ error: 'Test emails not configured. Please add at least one test email in Settings.' });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (campaignError || !campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  let html = campaign.body_html || '';
  let text = campaign.body_text || '';
  let subject = campaign.subject || '';

  html = html.replace(/\{\{company\}\}/g, 'Test Company');
  text = text.replace(/\{\{company\}\}/g, 'Test Company');
  subject = subject.replace(/\{\{company\}\}/g, 'Test Company');
  subject = `[TEST] ${subject}`;

  // Process images to ensure all use absolute URLs
  let baseUrl = process.env.TRACKING_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'https://mailsurge.vercel.app';
    }
  }
  baseUrl = baseUrl.replace(/\/$/, '');
  html = processEmailImages(html, baseUrl);

  // Try Gmail OAuth first, fall back to SMTP
  const accessToken = user.user_metadata?.gmail_token;
  const refreshToken = user.user_metadata?.gmail_refresh_token;
  let oauth2Client: any = null;
  let senderEmail: string | null = null;

  if (accessToken && refreshToken && hasGmailOAuth) {
    try {
      const { google } = await import('googleapis');
      let redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
      if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
        redirectUri = `https://${redirectUri}`;
      }

      oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
          oauth2Client.setCredentials(credentials);
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
      }

      senderEmail = campaign.from_email || user.email;
      if (!senderEmail) {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        senderEmail = profile.data.emailAddress || user.email || '';
      }
    } catch (oauthError) {
      console.warn('Gmail OAuth setup failed for test send, using SMTP:', oauthError);
      oauth2Client = null;
    }
  }

  const sentEmails: string[] = [];
  const errors: string[] = [];

  for (const testEmail of testEmails) {
    try {
      if (oauth2Client && senderEmail) {
        // Use Gmail API
        const { google } = await import('googleapis');
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
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
        const encodedEmail = Buffer.from(email)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedEmail,
          },
        });
      } else {
        // Use SMTP
        const nodemailer = await import('nodemailer');
        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
        const smtpUser = process.env.SMTP_USER;
        const smtpPassword = process.env.SMTP_PASSWORD;
        const smtpSenderEmail = process.env.SMTP_FROM_EMAIL || smtpUser;
        const senderName = process.env.SMTP_FROM_NAME || 'MailSurge';

        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
        });

        await transporter.sendMail({
          from: `"${senderName}" <${smtpSenderEmail}>`,
          to: testEmail,
          subject: subject,
          text: text,
          html: html,
        });
      }

      sentEmails.push(testEmail);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${testEmail}: ${errorMessage}`);
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
}
