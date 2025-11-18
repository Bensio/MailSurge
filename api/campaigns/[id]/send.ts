import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { google, type Auth } from 'googleapis';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function sendEmail(
  contact: { email: string; company: string },
  campaign: {
    subject: string;
    body_html: string;
    body_text: string;
    settings: { delay?: number; ccEmail?: string | null };
  },
  oauth2Client: Auth.OAuth2Client,
  senderEmail: string
) {
  // Personalize email
  let html = campaign.body_html;
  // Text version is available but currently using HTML only
  // const text = campaign.body_text.replace(/\{\{company\}\}/g, contact.company);
  let subject = campaign.subject;

  // Replace {{company}} with actual company name
  html = html.replace(/\{\{company\}\}/g, contact.company);
  subject = subject.replace(/\{\{company\}\}/g, contact.company);

  // Create email
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Create email with proper headers
  const emailLines = [
    `From: ${senderEmail}`,
    `To: ${contact.email}`,
  ];
  
  if (campaign.settings.ccEmail) {
    emailLines.push(`Cc: ${campaign.settings.ccEmail}`);
  }
  
  emailLines.push(
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    html
  );

  const email = emailLines.join('\r\n');

  // Encode to base64url format (Gmail API requirement)
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
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    // Get campaign with contacts
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        contacts (*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check if user has Gmail tokens stored
    const accessToken = user.user_metadata?.gmail_token;
    const refreshToken = user.user_metadata?.gmail_refresh_token;
    
    console.log('[API] Gmail token check:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      userMetadataKeys: Object.keys(user.user_metadata || {}),
    });
    
    if (!accessToken || !refreshToken) {
      console.error('[API] Gmail tokens missing');
      return res.status(400).json({ error: 'Gmail not connected. Please connect your Gmail account in settings.' });
    }

    // Update status to sending
    await supabase
      .from('campaigns')
      .update({ status: 'sending', sent_at: new Date().toISOString() })
      .eq('id', id);

    // Start sending (don't await - respond immediately)
    res.status(200).json({ status: 'started', total: campaign.contacts?.length || 0 });

    // Send emails in background (fire and forget)
    // NOTE: Vercel serverless functions have time limits (10s free, 60s pro)
    // For large campaigns, consider using a queue system
    void (async () => {
      try {
        console.log('[API] Starting background email sending for campaign:', id);
        
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
          throw new Error('Google OAuth credentials not configured');
        }

    // Set up token refresh handler
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        // Update refresh token if provided
        console.log('[API] Refreshing Gmail token...');
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            gmail_token: tokens.access_token,
            gmail_refresh_token: tokens.refresh_token,
            gmail_token_expiry: tokens.expiry_date,
          },
        });
      } else if (tokens.access_token) {
        // Just update access token
        console.log('[API] Updating Gmail access token...');
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            gmail_token: tokens.access_token,
            gmail_token_expiry: tokens.expiry_date,
          },
        });
      }
    });

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const contacts = campaign.contacts || [];
    const delay = (campaign.settings?.delay || 45) * 1000;

    // Get sender email from Gmail profile
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    let senderEmail: string;
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      senderEmail = profile.data.emailAddress || user.email || '';
      if (!senderEmail) {
        throw new Error('Could not determine sender email address');
      }
    } catch (error) {
      console.error('Error getting Gmail profile:', error);
      // Fallback to user email
      senderEmail = user.email || '';
      if (!senderEmail) {
        throw new Error('Could not determine sender email address');
      }
    }

    // Filter contacts to only send to pending or failed contacts (skip already sent)
    const contactsToSend = contacts.filter(
      (c: { status: string }) => c.status === 'pending' || c.status === 'failed'
    );

    if (contactsToSend.length === 0) {
      console.log('[API] No contacts to send (all already sent)');
      await supabase
        .from('campaigns')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);
      return;
    }

    console.log(`[API] Sending to ${contactsToSend.length} contacts (${contacts.length - contactsToSend.length} already sent)`);
    console.log(`[API] Sender email: ${senderEmail}`);

    for (let i = 0; i < contactsToSend.length; i++) {
      const contact = contactsToSend[i];
      console.log(`[API] Sending email ${i + 1}/${contactsToSend.length} to ${contact.email}`);

      try {
        // Update to queued
        await supabase
          .from('contacts')
          .update({ status: 'queued' })
          .eq('id', contact.id);

        await sendEmail(contact, campaign, oauth2Client, senderEmail);

        console.log(`[API] Successfully sent email to ${contact.email}`);

        // Update contact status
        await supabase
          .from('contacts')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', contact.id);

        // Wait before next email (except for the last one)
        if (i < contactsToSend.length - 1) {
          await sleep(delay);
        }
      } catch (error: unknown) {
        console.error(`[API] Error sending to ${contact.email}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[API] Error details:`, error instanceof Error ? error.stack : 'No stack');

        await supabase
          .from('contacts')
          .update({
            status: 'failed',
            error: errorMessage,
          })
          .eq('id', contact.id);
      }
    }
    
    console.log(`[API] Finished sending emails for campaign ${id}`);

      // Check if all contacts (including previously sent) are now sent
      const { data: allContacts } = await supabase
        .from('contacts')
        .select('status')
        .eq('campaign_id', id);
      
      const allSent = allContacts?.every((c) => c.status === 'sent') || false;
      const allFailed = allContacts?.every((c) => c.status === 'failed') || false;
      const finalStatus = allFailed ? 'failed' : (allSent ? 'completed' : 'completed');
      
      // Mark campaign as completed or failed
      await supabase
        .from('campaigns')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id);
      } catch (bgError) {
        console.error('[API] Background email sending error:', bgError);
        console.error('[API] Error message:', bgError instanceof Error ? bgError.message : 'Unknown error');
        console.error('[API] Error stack:', bgError instanceof Error ? bgError.stack : 'No stack');
        
        // Update campaign status to failed
        try {
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString()
            })
            .eq('id', id);
        } catch (updateError) {
          console.error('[API] Failed to update campaign status:', updateError);
        }
      }
    })().catch((error) => {
      console.error('[API] Unhandled error in background task:', error);
    });

    return;
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

