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
    // Log immediately when function is triggered
    console.log('[Inngest Function] ===== FUNCTION TRIGGERED =====');
    console.log('[Inngest Function] Event received:', {
      name: event.name,
      id: event.id,
      timestamp: event.ts,
      dataKeys: Object.keys(event.data || {}),
    });
    
    try {
      const { campaignId, userId, accessToken, refreshToken } = event.data;

      console.log('[Inngest Function] Starting email sending for campaign:', campaignId);
      console.log('[Inngest Function] Event data:', {
        campaignId,
        userId,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
      });

      // Check environment variables
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        throw new Error('Missing Supabase environment variables');
      }

      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
        throw new Error('Missing Google OAuth environment variables');
      }

      // Initialize Supabase
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

    // Get campaign and contacts
    const { data: campaign } = await step.run('get-campaign', async () => {
      console.log('[Inngest Function] Fetching campaign:', campaignId);
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          contacts (*)
        `)
        .eq('id', campaignId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[Inngest Function] Error fetching campaign:', error);
        throw error;
      }
      console.log('[Inngest Function] Campaign found:', { 
        id: data?.id, 
        name: data?.name, 
        contactCount: data?.contacts?.length || 0 
      });
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
    } catch (error) {
      console.error('[Inngest Function] Fatal error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Inngest Function] Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw to let Inngest handle retries
    }
  }
);

// Vercel serverless function handler
// We need the raw body string for Inngest signature validation
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Log immediately - this should always appear
  console.log('[Inngest] ===== FUNCTION CALLED =====');
  console.log('[Inngest] Method:', req.method);
  console.log('[Inngest] URL:', req.url);
  console.log('[Inngest] Timestamp:', new Date().toISOString());
  console.log('[Inngest] User-Agent:', req.headers['user-agent']);
  console.log('[Inngest] This is a function execution request:', req.method === 'POST' && req.url?.includes('/fn/'));
  
  try {
    // Read the raw body from the request stream
    // This is necessary because Inngest needs the exact raw body string for signature validation
    // Vercel may have already parsed it, but we'll try to read from stream first
    let rawBodyString = '';
    
    if (req.method === 'PUT' || req.method === 'POST') {
      // Check if stream is still readable (not already consumed)
      if (req.readable && typeof (req as any).read === 'function') {
        try {
          // Read raw body from stream
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve) => {
            // Check if stream has already ended
            if ((req as any).readableEnded) {
              // Stream already consumed, try to use req.body if available
              if (req.body) {
                rawBodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
                console.log('[Inngest] Using req.body (stream already consumed)');
              }
              resolve();
              return;
            }
            
            req.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });
            req.on('end', () => {
              rawBodyString = Buffer.concat(chunks).toString('utf-8');
              resolve();
            });
            req.on('error', (err) => {
              console.error('[Inngest] Error reading request body:', err);
              // Fallback to req.body if available
              if (req.body) {
                rawBodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
                console.log('[Inngest] Fallback to req.body after stream error');
              }
              resolve(); // Don't reject, try to continue
            });
          });
          
          if (rawBodyString) {
            console.log('[Inngest] Raw body read from stream:', {
              length: rawBodyString.length,
              preview: rawBodyString.substring(0, 100),
            });
          }
        } catch (streamError) {
          console.error('[Inngest] Stream read error:', streamError);
          // Fallback to req.body if available
          if (req.body) {
            rawBodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            console.log('[Inngest] Fallback to req.body after stream exception');
          }
        }
      } else {
        // Stream not readable, use req.body
        if (req.body) {
          rawBodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          console.log('[Inngest] Stream not readable, using req.body:', {
            length: rawBodyString.length,
            preview: rawBodyString.substring(0, 100),
          });
        }
      }
    }
    // Log request for debugging
    console.log('[Inngest] Request details:', {
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
    
    // Also log event key
    const eventKeySet = !!process.env.INNGEST_EVENT_KEY;
    console.log('[Inngest] Event key check:', {
      isSet: eventKeySet,
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
        // We have the raw body string from the stream, which is what Inngest needs for signature validation
        const bodyString = rawBodyString;
        
        // Log body info for PUT requests
        if (req.method === 'PUT') {
          console.log('[Inngest] Body extraction:', {
            bodyStringLength: bodyString.length,
            hasRawBody: !!rawBodyString,
            bodyPreview: bodyString.substring(0, 100),
          });
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

        // Handle different request types:
        // - PUT requests (sync): Need parsed object for validation (this worked before)
        // - POST requests (function execution): Need raw string for signature validation
        const isSyncRequest = req.method === 'PUT';
        
        // For sync requests, provide parsed object
        // For function execution, provide raw string for signature validation
        let bodyToProvide: any;
        if (isSyncRequest && bodyString) {
          try {
            bodyToProvide = JSON.parse(bodyString);
          } catch (e) {
            bodyToProvide = {};
          }
        } else {
          // For function execution or other requests, use raw string
          bodyToProvide = bodyString || '';
        }
        
        return {
          body: () => Promise.resolve(bodyToProvide),
          headers: (key: string) => Promise.resolve(headers[key.toLowerCase()] || null),
          method: () => Promise.resolve(req.method || 'GET'),
          url: () => Promise.resolve(url),
          queryString: (key: string, urlObj: URL) => {
            return Promise.resolve(urlObj.searchParams.get(key));
          },
          transformResponse: ({ body, status, headers: responseHeaders }) => {
            // Set status and headers on Vercel response
            console.log('[Inngest] Transform response:', {
              status,
              bodyLength: body?.length || 0,
              bodyType: typeof body,
              headersCount: Object.keys(responseHeaders || {}).length,
            });
            
            // Log error response body for debugging
            if (status >= 400 && body) {
              try {
                const errorBody = typeof body === 'string' ? JSON.parse(body) : body;
                console.log('[Inngest] Error response body:', errorBody);
              } catch (e) {
                console.log('[Inngest] Error response body (raw):', body?.substring(0, 500));
              }
            }
            
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
    
    // For PUT requests (sync), log more details
    if (req.method === 'PUT') {
      console.log('[Inngest] PUT request detected - this is a sync request');
      console.log('[Inngest] Request body type:', typeof req.body);
      console.log('[Inngest] Content-Type header:', req.headers['content-type']);
      console.log('[Inngest] Has signing key:', !!process.env.INNGEST_SIGNING_KEY);
    }
    
    const result = await handlerFn(req);
    console.log('[Inngest] Handler result:', {
      resultType: typeof result,
      hasStatus: 'status' in (result || {}),
    });
    console.log('[Inngest] Response sent successfully');
    return result;
  } catch (error) {
    console.error('[Inngest] ===== ERROR OCCURRED =====');
    console.error('[Inngest] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[Inngest] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[Inngest] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Check if it's an authentication error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('signature') || errorMessage.includes('authentication') || errorMessage.includes('signing')) {
      console.error('[Inngest] ===== AUTHENTICATION ERROR DETECTED =====');
      console.error('[Inngest] Signing key is set:', !!process.env.INNGEST_SIGNING_KEY);
      console.error('[Inngest] Signing key length:', process.env.INNGEST_SIGNING_KEY?.length || 0);
      console.error('[Inngest] Signing key prefix:', process.env.INNGEST_SIGNING_KEY?.substring(0, 30) || 'NOT_SET');
      console.error('[Inngest] Signing key suffix:', process.env.INNGEST_SIGNING_KEY?.substring(process.env.INNGEST_SIGNING_KEY.length - 10) || 'NOT_SET');
    }
    
    // Return a proper error response so Inngest knows the endpoint exists
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
}

