import { Inngest, InngestCommHandler } from 'inngest';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateTrackingToken, injectTrackingPixel } from './lib/tracking';

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
  senderEmail: string,
  trackingToken?: string
) {
  // Personalize email
  let html = campaign.body_html;
  let subject = campaign.subject;

  // Replace {{company}} with actual company name
  html = html.replace(/\{\{company\}\}/g, contact.company);
  subject = subject.replace(/\{\{company\}\}/g, contact.company);

  // Inject tracking pixel if tracking token is provided
  if (trackingToken) {
    // Get base URL from environment or construct from Vercel URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_APP_URL || 'https://mailsurge.vercel.app';
    
    html = injectTrackingPixel(html, trackingToken, baseUrl);
  }

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
    const campaign = await step.run('get-campaign', async () => {
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
      
      if (!data) {
        console.error('[Inngest Function] Campaign not found in database:', { campaignId, userId });
        throw new Error(`Campaign ${campaignId} not found for user ${userId}`);
      }
      
      console.log('[Inngest Function] Campaign found:', { 
        id: data.id, 
        name: data.name, 
        contactCount: data.contacts?.length || 0 
      });
      return data;
    });

    if (!campaign) {
      console.error('[Inngest Function] Campaign is null/undefined after step:', { campaignId, userId });
      throw new Error(`Campaign ${campaignId} not found after step execution`);
    }

    // Get user for email fallback
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) {
      console.error('[Inngest Function] Error fetching user:', userError);
      throw new Error(`User ${userId} not found or auth error: ${userError?.message || 'Unknown error'}`);
    }
    console.log('[Inngest Function] User found:', user.email);

    // Set up OAuth client
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    let redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[Inngest Function] Missing Google OAuth credentials:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasRedirectUri: !!redirectUri,
      });
      throw new Error('Missing Google OAuth credentials in environment variables');
    }
    
    // Ensure redirect URI has protocol (fix for missing https://)
    if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
      console.warn('[Inngest Function] Redirect URI missing protocol, adding https://');
      redirectUri = `https://${redirectUri}`;
    }
    
    console.log('[Inngest Function] OAuth client config:', {
      hasClientId: !!clientId,
      clientIdPrefix: clientId.substring(0, 20) + '...',
      hasClientSecret: !!clientSecret,
      redirectUri: redirectUri,
    });
    
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
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
          // Generate tracking token for this email
          const trackingToken = generateTrackingToken();

          // Update to queued and store tracking token
          await supabase
            .from('contacts')
            .update({ 
              status: 'queued',
              tracking_token: trackingToken,
            })
            .eq('id', contact.id);

          // Send email with tracking pixel
          await sendEmail(contact, campaign, oauth2Client, senderEmail, trackingToken);

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

    // Schedule reminders if campaign completed successfully
    await step.run('schedule-reminders', async () => {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();

      // Only schedule reminders if campaign completed (not failed)
      if (campaign?.status === 'completed') {
        // Get reminder rules for this campaign
        const { data: rules } = await supabase
          .from('reminder_rules')
          .select('*')
          .eq('source_campaign_id', campaignId)
          .eq('is_active', true);

        if (rules && rules.length > 0) {
          console.log(`[Inngest] Found ${rules.length} reminder rule(s) for campaign ${campaignId}`);
          
          // Schedule reminders for each rule
          for (const rule of rules) {
            // Get contacts from source campaign that were sent
            const { data: contacts } = await supabase
              .from('contacts')
              .select('*')
              .eq('campaign_id', rule.source_campaign_id)
              .eq('status', 'sent');

            if (!contacts || contacts.length === 0) {
              console.log(`[Inngest] No sent contacts found for reminder rule ${rule.id}`);
              continue;
            }

            // Calculate scheduled time based on trigger type
            const scheduledFor = new Date();
            
            if (rule.trigger_type === 'days_after_campaign') {
              scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
            } else if (rule.trigger_type === 'days_after_last_email') {
              // Use campaign completion time + trigger_value
              scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
            } else if (rule.trigger_type === 'no_response') {
              scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
            }

            // Create queue entries
            const queueEntries = contacts.map(contact => ({
              user_id: userId,
              contact_id: contact.id,
              reminder_rule_id: rule.id,
              campaign_id: rule.reminder_campaign_id,
              scheduled_for: scheduledFor.toISOString(),
              status: 'pending',
              reminder_count: 0,
            }));

            const { error: queueError } = await supabase
              .from('reminder_queue')
              .insert(queueEntries);
            
            if (queueError) {
              console.error(`[Inngest] Error scheduling reminders for rule ${rule.id}:`, queueError);
            } else {
              console.log(`[Inngest] Scheduled ${queueEntries.length} reminders for rule ${rule.id}`);
            }
          }
        }
      }
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

// Function to process pending reminders
export const processReminders = inngest.createFunction(
  { id: 'process-reminders', name: 'Process Reminder Queue' },
  { cron: '*/15 * * * *' }, // Run every 15 minutes
  async ({ step }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get pending reminders due now
    const { data: reminders, error } = await supabase
      .from('reminder_queue')
      .select('*, reminder_rules(*), contacts(*), campaigns(*)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50); // Process 50 at a time

    if (error) {
      console.error('[Inngest Reminders] Error fetching reminders:', error);
      return;
    }

    if (!reminders || reminders.length === 0) {
      console.log('[Inngest Reminders] No pending reminders to process');
      return;
    }

    console.log(`[Inngest Reminders] Processing ${reminders.length} reminders`);

    for (const reminder of reminders) {
      await step.run(`send-reminder-${reminder.id}`, async () => {
        try {
          // Get user's Gmail tokens
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(reminder.user_id);
          
          if (userError || !userData?.user) {
            console.error(`[Inngest Reminders] Error getting user ${reminder.user_id}:`, userError);
            await supabase
              .from('reminder_queue')
              .update({ status: 'failed' })
              .eq('id', reminder.id);
            return;
          }

          const user = userData.user;
          const accessToken = user.user_metadata?.gmail_token;
          const refreshToken = user.user_metadata?.gmail_refresh_token;

          if (!accessToken || !refreshToken) {
            console.error(`[Inngest Reminders] Missing Gmail tokens for user ${reminder.user_id}`);
            await supabase
              .from('reminder_queue')
              .update({ status: 'failed' })
              .eq('id', reminder.id);
            return;
          }

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

          // Refresh token if needed
          if (user.user_metadata?.gmail_token_expiry) {
            const expiry = new Date(user.user_metadata.gmail_token_expiry);
            if (expiry < new Date()) {
              const { credentials } = await oauth2Client.refreshAccessToken();
              oauth2Client.setCredentials(credentials);
              
              // Update tokens in database
              await supabase.auth.admin.updateUserById(reminder.user_id, {
                user_metadata: {
                  ...user.user_metadata,
                  gmail_token: credentials.access_token,
                  gmail_token_expiry: credentials.expiry_date,
                },
              });
            }
          }

          // Get reminder campaign details
          const reminderCampaign = reminder.campaigns as any;
          if (!reminderCampaign) {
            console.error(`[Inngest Reminders] Reminder campaign not found for reminder ${reminder.id}`);
            await supabase
              .from('reminder_queue')
              .update({ status: 'failed' })
              .eq('id', reminder.id);
            return;
          }

          // Get contact details
          const contact = reminder.contacts as any;
          if (!contact) {
            console.error(`[Inngest Reminders] Contact not found for reminder ${reminder.id}`);
            await supabase
              .from('reminder_queue')
              .update({ status: 'failed' })
              .eq('id', reminder.id);
            return;
          }

          // Get sender email
          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
          const profile = await gmail.users.getProfile({ userId: 'me' });
          const senderEmail = profile.data.emailAddress || user.email || '';

          // Generate tracking token for reminder email
          const reminderTrackingToken = generateTrackingToken();
          
          // Store tracking token in reminder_queue (NOT in contacts - that's for campaign emails)
          // This allows us to distinguish between campaign opens and reminder opens

          // Send reminder email using existing sendEmail function
          await sendEmail(
            { email: contact.email, company: contact.company, id: contact.id },
            {
              subject: reminderCampaign.subject,
              body_html: reminderCampaign.body_html,
              body_text: reminderCampaign.body_text || '',
              settings: reminderCampaign.settings || { delay: 45 },
            },
            oauth2Client,
            senderEmail,
            reminderTrackingToken
          );

          // Update queue status with tracking token
          await supabase
            .from('reminder_queue')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString(),
              reminder_count: (reminder.reminder_count || 0) + 1,
              tracking_token: reminderTrackingToken
            })
            .eq('id', reminder.id);

          console.log(`[Inngest Reminders] Sent reminder ${reminder.id} to ${contact.email}`);
        } catch (error) {
          console.error(`[Inngest Reminders] Error sending reminder ${reminder.id}:`, error);
          
          await supabase
            .from('reminder_queue')
            .update({ 
              status: 'failed'
            })
            .eq('id', reminder.id);
        }
      });
    }

    return { processed: reminders.length };
  }
);

// Function to process scheduled campaigns
export const processScheduledCampaigns = inngest.createFunction(
  { id: 'process-scheduled-campaigns', name: 'Process Scheduled Campaigns' },
  { cron: '*/5 * * * *' }, // Run every 5 minutes
  async ({ step }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get campaigns scheduled to send now or in the past
    const now = new Date().toISOString();
    const { data: scheduledCampaigns, error } = await supabase
      .from('campaigns')
      .select('*, user_id')
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', now)
      .eq('status', 'draft')
      .limit(50);

    if (error) {
      console.error('[Inngest Scheduled] Error fetching scheduled campaigns:', error);
      return;
    }

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      console.log('[Inngest Scheduled] No scheduled campaigns to process');
      return;
    }

    console.log(`[Inngest Scheduled] Processing ${scheduledCampaigns.length} scheduled campaigns`);

    for (const campaign of scheduledCampaigns) {
      await step.run(`send-scheduled-campaign-${campaign.id}`, async () => {
        try {
          // Get user's Gmail tokens
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(campaign.user_id);
          
          if (userError || !userData?.user) {
            console.error(`[Inngest Scheduled] Error getting user ${campaign.user_id}:`, userError);
            await supabase
              .from('campaigns')
              .update({ status: 'failed', scheduled_at: null })
              .eq('id', campaign.id);
            return;
          }

          const user = userData.user;
          const accessToken = user.user_metadata?.gmail_token;
          const refreshToken = user.user_metadata?.gmail_refresh_token;

          if (!accessToken || !refreshToken) {
            console.error(`[Inngest Scheduled] Missing Gmail tokens for user ${campaign.user_id}`);
            await supabase
              .from('campaigns')
              .update({ status: 'failed', scheduled_at: null })
              .eq('id', campaign.id);
            return;
          }

          // Trigger the campaign send
          await inngest.send({
            name: 'campaign/send',
            data: {
              campaignId: campaign.id,
              userId: campaign.user_id,
              accessToken: accessToken,
              refreshToken: refreshToken,
            },
          });

          // Clear scheduled_at and update status
          await supabase
            .from('campaigns')
            .update({ 
              status: 'sending',
              sent_at: new Date().toISOString(),
              scheduled_at: null
            })
            .eq('id', campaign.id);

          console.log(`[Inngest Scheduled] Triggered scheduled campaign ${campaign.id}`);
        } catch (error) {
          console.error(`[Inngest Scheduled] Error processing campaign ${campaign.id}:`, error);
          await supabase
            .from('campaigns')
            .update({ status: 'failed', scheduled_at: null })
            .eq('id', campaign.id);
        }
      });
    }

    return { processed: scheduledCampaigns.length };
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
  console.log('[Inngest] Bypass token in query:', req.query['x-vercel-protection-bypass'] ? 'YES' : 'NO');
  console.log('[Inngest] Bypass token in headers:', req.headers['x-vercel-protection-bypass'] ? 'YES' : 'NO');
  
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
      functions: [sendCampaignEmails, processReminders, processScheduledCampaigns],
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
        // - PUT requests (sync): Need parsed object for validation
        // - POST requests (function execution): Need parsed object for function execution
        //   BUT InngestCommHandler needs raw string for signature validation first
        //   So we provide a function that returns the appropriate format
        const isSyncRequest = req.method === 'PUT';
        const isFunctionExecution = req.method === 'POST' && req.query?.fnId;
        
        // For both sync and function execution, Inngest needs parsed object
        // But signature validation happens first, so we need to handle both
        let bodyToProvide: any;
        if ((isSyncRequest || isFunctionExecution) && bodyString) {
          try {
            bodyToProvide = JSON.parse(bodyString);
          } catch (e) {
            console.error('[Inngest] Failed to parse body:', e);
            bodyToProvide = bodyString || '';
          }
        } else {
          // For other requests, use raw string
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

