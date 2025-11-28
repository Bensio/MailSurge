import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { google } from 'googleapis';

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

  const { id, action } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid campaign ID' });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

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
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (campaignError) {
        console.error('Campaign fetch error:', campaignError);
        if (campaignError.code === 'PGRST116' || campaignError.message?.includes('No rows')) {
          return res.status(404).json({ error: 'Campaign not found' });
        }
        return res.status(404).json({ error: 'Campaign not found', details: campaignError.message });
      }

      if (!campaignData) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('campaign_id', id)
        .order('email', { ascending: true });

      if (contactsError) {
        console.error('Error fetching contacts:', contactsError);
      }

      return res.status(200).json({
        ...campaignData,
        contacts: contacts || [],
      });
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
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(500).json({ error: 'Gmail OAuth not configured' });
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*, contacts (*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const accessToken = user.user_metadata?.gmail_token;
  const refreshToken = user.user_metadata?.gmail_refresh_token;
  
  if (!accessToken || !refreshToken) {
    return res.status(400).json({ error: 'Gmail not connected. Please connect your Gmail account in settings.' });
  }

  await supabase
    .from('campaigns')
    .update({ status: 'sending', sent_at: new Date().toISOString() })
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
        accessToken: accessToken,
        refreshToken: refreshToken,
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

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(500).json({ error: 'Gmail OAuth not configured' });
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

  const accessToken = user.user_metadata?.gmail_token;
  const refreshToken = user.user_metadata?.gmail_refresh_token;
  
  if (!accessToken || !refreshToken) {
    return res.status(400).json({ error: 'Gmail not connected. Please connect your Gmail account in Settings.' });
  }

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

  let senderEmail = campaign.from_email || user.email;
  if (!senderEmail) {
    return res.status(400).json({ error: 'Sender email not found' });
  }

  let html = campaign.body_html || '';
  let text = campaign.body_text || '';
  let subject = campaign.subject || '';

  html = html.replace(/\{\{company\}\}/g, 'Test Company');
  text = text.replace(/\{\{company\}\}/g, 'Test Company');
  subject = subject.replace(/\{\{company\}\}/g, 'Test Company');
  subject = `[TEST] ${subject}`;

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
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
