import { Inngest, InngestCommHandler } from 'inngest';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Inngest client for the serve endpoint
const inngest = new Inngest({ 
  id: 'mailsurge',
  name: 'MailSurge',
});

// Import the send email function
async function sendEmail(
  contact: { email: string; company: string; id: string },
  campaign: {
    subject: string;
    body_html: string;
    body_text: string;
    settings: { delay?: number; ccEmail?: string | null };
  },
  oauth2Client: any,
  senderEmail: string
) {
  // Personalize email
  let html = campaign.body_html;
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

// Define the email sending function
export const sendCampaignEmails = inngest.createFunction(
  { 
    id: 'send-campaign-emails',
    name: 'Send Campaign Emails',
    retries: 3, // Retry up to 3 times on failure
  },
  { event: 'campaign/send' },
  async ({ event, step }) => {
    const { campaignId, userId, accessToken, refreshToken } = event.data;

    console.log('[Inngest] Starting email sending for campaign:', campaignId);

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get campaign and contacts
    const { data: campaign } = await step.run('get-campaign', async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          contacts (*)
        `)
        .eq('id', campaignId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get user for email fallback
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);

    // Set up OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Set up token refresh handler
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...user?.user_metadata,
            gmail_token: tokens.access_token,
            gmail_refresh_token: tokens.refresh_token,
            gmail_token_expiry: tokens.expiry_date,
          },
        });
      } else if (tokens.access_token) {
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...user?.user_metadata,
            gmail_token: tokens.access_token,
            gmail_token_expiry: tokens.expiry_date,
          },
        });
      }
    });

    // Get sender email
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const senderEmail = await step.run('get-sender-email', async () => {
      try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        return profile.data.emailAddress || user?.email || '';
      } catch (error) {
        console.error('Error getting Gmail profile:', error);
        return user?.email || '';
      }
    });

    // Filter contacts to send
    const contacts = (campaign.contacts || []).filter(
      (c: { status: string }) => c.status === 'pending' || c.status === 'failed'
    );

    if (contacts.length === 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', campaignId);
      return { message: 'No contacts to send' };
    }

    const delay = (campaign.settings?.delay || 45) * 1000;
    let sentCount = 0;
    let failedCount = 0;

    // Send emails one by one with delay
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      await step.run(`send-email-${i}`, async () => {
        try {
          // Update to queued
          await supabase
            .from('contacts')
            .update({ status: 'queued' })
            .eq('id', contact.id);

          // Send email
          await sendEmail(contact, campaign, oauth2Client, senderEmail);

          // Update to sent
          await supabase
            .from('contacts')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', contact.id);

          sentCount++;
          console.log(`[Inngest] Sent email ${i + 1}/${contacts.length} to ${contact.email}`);

          // Wait before next email (except for the last one)
          if (i < contacts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error(`[Inngest] Error sending to ${contact.email}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          await supabase
            .from('contacts')
            .update({
              status: 'failed',
              error: errorMessage,
            })
            .eq('id', contact.id);

          failedCount++;
        }
      });
    }

    // Update campaign status
    await step.run('update-campaign-status', async () => {
      const { data: allContacts } = await supabase
        .from('contacts')
        .select('status')
        .eq('campaign_id', campaignId);
      
      const allSent = allContacts?.every((c) => c.status === 'sent') || false;
      const allFailed = allContacts?.every((c) => c.status === 'failed') || false;
      const finalStatus = allFailed ? 'failed' : (allSent ? 'completed' : 'completed');
      
      await supabase
        .from('campaigns')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      return { sentCount, failedCount, finalStatus };
    });

    return { 
      message: 'Campaign sending completed',
      sentCount,
      failedCount,
      total: contacts.length
    };
  }
);

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Log request for debugging
    console.log('[Inngest] Request:', {
      method: req.method,
      url: req.url,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
      },
      hasBody: !!req.body,
    });

    // Debug: Check if signing key is set (don't log the actual key for security)
    const signingKeySet = !!process.env.INNGEST_SIGNING_KEY;
    const signingKeyLength = process.env.INNGEST_SIGNING_KEY?.length || 0;
    const signingKeyPrefix = process.env.INNGEST_SIGNING_KEY?.substring(0, 20) || 'NOT_SET';
    console.log('[Inngest] Signing key check:', {
      isSet: signingKeySet,
      length: signingKeyLength,
      prefix: signingKeyPrefix + '...',
    });

    // Get the base URL from environment or headers
    // Vercel provides VERCEL_URL in production, or we use headers
    const getBaseUrl = () => {
      // Check for explicit Inngest serve URL first
      if (process.env.INNGEST_SERVE_URL) {
        return process.env.INNGEST_SERVE_URL;
      }
      
      // Use Vercel URL if available
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
      }
      
      // Try to get from headers
      const host = req.headers.host || req.headers['x-forwarded-host'];
      const protocol = req.headers['x-forwarded-proto'] === 'https' || !host?.includes('localhost') ? 'https' : 'http';
      
      if (host) {
        return `${protocol}://${host}`;
      }
      
      // Fallback (shouldn't happen in production)
      return 'https://localhost:3000';
    };

    const baseUrl = getBaseUrl();
    const servePath = '/api/inngest';

    // Inngest serve function for Vercel
    const serveHandler = new InngestCommHandler({
      client: inngest,
      functions: [sendCampaignEmails],
      signingKey: process.env.INNGEST_SIGNING_KEY,
      frameworkName: 'vercel',
      serveHost: baseUrl,
      servePath: servePath,
      handler: (req: VercelRequest) => {
        // Extract body, headers, and method from Vercel request
        // Vercel automatically parses JSON bodies, but we need to stringify for Inngest
        let body = '';
        if (req.body) {
          if (typeof req.body === 'string') {
            body = req.body;
          } else {
            // If it's already parsed (object), stringify it
            body = JSON.stringify(req.body);
          }
        }
        
        const headers: Record<string, string> = {};
        Object.keys(req.headers).forEach(key => {
          const value = req.headers[key];
          if (typeof value === 'string') {
            headers[key] = value;
          } else if (Array.isArray(value) && value[0]) {
            headers[key] = value[0];
          }
        });

        // Construct proper URL for Inngest
        const path = req.url || servePath;
        let url: URL;
        try {
          url = new URL(path, baseUrl);
        } catch (error) {
          // Fallback URL construction
          url = new URL(servePath, baseUrl);
        }

        return {
          body: () => Promise.resolve(body),
          headers: (key: string) => Promise.resolve(headers[key.toLowerCase()] || null),
          method: () => Promise.resolve(req.method || 'GET'),
          url: () => Promise.resolve(url),
          queryString: (key: string, urlObj: URL) => {
            return Promise.resolve(urlObj.searchParams.get(key));
          },
          transformResponse: ({ body, status, headers: responseHeaders }) => {
            // Set status and headers on Vercel response
            res.status(status);
            Object.entries(responseHeaders || {}).forEach(([key, value]) => {
              res.setHeader(key, value);
            });
            res.send(body);
            return res;
          },
        };
      },
    });

    // Create a handler function that matches Vercel's request/response pattern
    const handlerFn = serveHandler.createHandler();
    const result = await handlerFn(req);
    console.log('[Inngest] Response sent successfully');
    return result;
  } catch (error) {
    console.error('[Inngest] Handler error:', error);
    console.error('[Inngest] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[Inngest] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Check if it's an authentication error
    if (error instanceof Error && (error.message.includes('signature') || error.message.includes('authentication'))) {
      console.error('[Inngest] Authentication error detected - check signing key match');
      console.error('[Inngest] Signing key prefix:', process.env.INNGEST_SIGNING_KEY?.substring(0, 20) || 'NOT_SET');
    }
    
    // Return a proper error response so Inngest knows the endpoint exists
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
}

