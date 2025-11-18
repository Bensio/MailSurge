import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Use service key if available (for admin operations), otherwise use anon key
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY (or VITE_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get user from token
async function getUserFromToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Campaigns API
app.get('/api/campaigns', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch campaigns' });
    }

    return res.json(campaigns || []);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get campaign first
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaignData) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get ONLY contacts that belong to THIS specific campaign
    // Filter by campaign_id to ensure we only get contacts for this campaign
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('campaign_id', req.params.id)
      .order('email', { ascending: true });

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
    }

    // Return campaign with filtered contacts (only this campaign's contacts)
    return res.json({
      ...campaignData,
      contacts: contacts || [],
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/campaigns/create', async (req, res) => {
  try {
    console.log('[API] POST /api/campaigns/create received');
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) {
      console.error('[API] Unauthorized - no user');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[API] Creating campaign for user:', user.id);
    console.log('[API] Campaign data:', {
      name: req.body.name,
      subject: req.body.subject,
      body_html_length: req.body.body_html?.length,
      body_text_length: req.body.body_text?.length,
    });

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        ...req.body,
        user_id: user.id,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({ error: 'Failed to create campaign', details: error.message });
    }

    console.log('[API] Campaign created successfully:', campaign.id);
    return res.status(201).json(campaign);
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    return res.json(campaign);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete campaign' });
    }

    return res.status(204).send('');
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/campaigns/:id/send', async (req, res) => {
  try {
    console.log('[API] POST /api/campaigns/:id/send received for campaign:', req.params.id);
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) {
      console.log('[API] Unauthorized - no user');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[API] Getting campaign with contacts...');
    // Get campaign first
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaignData) {
      console.log('[API] Campaign not found');
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get contacts for this campaign
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('campaign_id', req.params.id)
      .order('email', { ascending: true });

    if (contactsError) {
      console.error('[API] Error fetching contacts:', contactsError);
      return res.status(500).json({ error: 'Failed to fetch contacts', details: contactsError.message });
    }

    console.log('[API] Contacts fetched:', contacts?.length || 0);
    if (contacts && contacts.length > 0) {
      console.log('[API] Contact statuses:', contacts.map(c => ({ email: c.email, status: c.status })));
    }

    const campaign = { ...campaignData, contacts: contacts || [] };
    console.log('[API] Campaign found:', campaign.name, 'with', campaign.contacts.length, 'contacts');

    if (!campaign.contacts || campaign.contacts.length === 0) {
      console.log('[API] No contacts in campaign');
      return res.status(400).json({ error: 'No contacts in this campaign. Please add contacts before sending.' });
    }

    // Get tokens for the selected email (will be determined from campaign.from_email in background)
    // For now, get default tokens (will be overridden in background if from_email is set)
    const accessToken = user.user_metadata?.gmail_token;
    const refreshToken = user.user_metadata?.gmail_refresh_token;
    const tokenExpiry = user.user_metadata?.gmail_token_expiry;
    
    console.log('[API] Token check:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasExpiry: !!tokenExpiry,
      accessTokenType: typeof accessToken,
      refreshTokenType: typeof refreshToken,
      accessTokenLength: accessToken?.length,
      refreshTokenLength: refreshToken?.length,
      expiryDate: tokenExpiry,
    });
    
    if (!accessToken || !refreshToken) {
      console.log('[API] Gmail not connected - missing tokens');
      console.log('[API] User metadata keys:', Object.keys(user.user_metadata || {}));
      return res.status(400).json({ error: 'Gmail not connected. Please connect your Gmail account in settings.' });
    }

    console.log('[API] Updating campaign status to sending...');
    await supabase
      .from('campaigns')
      .update({ status: 'sending', sent_at: new Date().toISOString() })
      .eq('id', req.params.id);

    console.log('[API] Responding to client...');
    res.status(200).json({ status: 'started', total: campaign.contacts.length });

    // Background sending - capture tokens in closure
    void (async () => {
      try {
        console.log('[API] Starting background email sending...');
        // Get sender email and tokens for the selected account
        let senderEmail = campaign.from_email || user.email;
        if (!senderEmail) {
          throw new Error('Sender email not found');
        }

        // Get tokens for the selected email account
        const accounts = user.user_metadata?.gmail_accounts || [];
        let accountTokens = {
          access_token: accessToken,
          refresh_token: refreshToken,
          expiry_date: tokenExpiry,
        };
        
        if (Array.isArray(accounts) && accounts.length > 0) {
          // Find account matching the from_email
          const account = accounts.find((acc) => acc.email === senderEmail);
          if (account) {
            accountTokens = {
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expiry_date: account.expiry_date,
            };
          } else {
            // Fallback to first account
            accountTokens = {
              access_token: accounts[0].access_token,
              refresh_token: accounts[0].refresh_token,
              expiry_date: accounts[0].expiry_date,
            };
            senderEmail = accounts[0].email;
          }
        }

        console.log('[API] Background function - token check:', {
          senderEmail: senderEmail,
          hasAccessToken: !!accountTokens.access_token,
          hasRefreshToken: !!accountTokens.refresh_token,
          accessTokenPreview: accountTokens.access_token ? `${accountTokens.access_token.substring(0, 20)}...` : 'null',
          refreshTokenPreview: accountTokens.refresh_token ? `${accountTokens.refresh_token.substring(0, 20)}...` : 'null',
        });
        
        const { google } = await import('googleapis');
        
        const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';
        
        console.log('[API] OAuth2 config:', {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          redirectUri: redirectUri,
        });
        
        const oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          redirectUri
        );

        // Set up token refresh handler BEFORE setting credentials
        oauth2Client.on('tokens', async (tokens) => {
          if (tokens.refresh_token) {
            // Update refresh token if provided
            console.log('[API] Refreshing Gmail token...');
            const serviceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;
            const adminSupabase = createClient(supabaseUrl, serviceKey);
            await adminSupabase.auth.admin.updateUserById(user.id, {
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
            const serviceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;
            const adminSupabase = createClient(supabaseUrl, serviceKey);
            await adminSupabase.auth.admin.updateUserById(user.id, {
              user_metadata: {
                ...user.user_metadata,
                gmail_token: tokens.access_token,
                gmail_token_expiry: tokens.expiry_date,
              },
            });
          }
        });

        console.log('[API] Setting OAuth2 credentials...');
        const credentials = {
          access_token: accountTokens.access_token,
          refresh_token: accountTokens.refresh_token,
        };
        
        // Add expiry_date if available
        if (accountTokens.expiry_date) {
          credentials.expiry_date = accountTokens.expiry_date;
        }
        
        console.log('[API] Credentials object:', {
          hasAccessToken: !!credentials.access_token,
          hasRefreshToken: !!credentials.refresh_token,
          hasExpiryDate: !!credentials.expiry_date,
          accessTokenLength: credentials.access_token?.length,
          refreshTokenLength: credentials.refresh_token?.length,
        });
        
        oauth2Client.setCredentials(credentials);
        
        // Verify credentials were set
        const currentCredentials = oauth2Client.credentials;
        console.log('[API] OAuth2Client credentials after set:', {
          hasAccessToken: !!currentCredentials.access_token,
          hasRefreshToken: !!currentCredentials.refresh_token,
          hasExpiryDate: !!currentCredentials.expiry_date,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const delay = campaign.settings?.delay || 45;
        let sentCount = 0;
        let failedCount = 0;

        // Filter contacts to only send to pending or failed contacts (skip already sent)
        const contactsToSend = campaign.contacts.filter(
          (c) => c.status === 'pending' || c.status === 'failed'
        );

        console.log('[API] Contacts filtering:', {
          totalContacts: campaign.contacts.length,
          contactsToSend: contactsToSend.length,
          contactStatuses: campaign.contacts.map(c => ({ email: c.email, status: c.status }))
        });

        if (contactsToSend.length === 0) {
          console.log('[API] No contacts to send (all already sent)');
          console.log('[API] All contact statuses:', campaign.contacts.map(c => ({ email: c.email, status: c.status })));
          await supabase
            .from('campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', req.params.id);
          return;
        }

        console.log(`[API] Sending to ${contactsToSend.length} contacts (${campaign.contacts.length - contactsToSend.length} already sent)`);

        for (const contact of contactsToSend) {
          try {
            // Verify credentials are still set before each email
            const credsCheck = oauth2Client.credentials;
            if (!credsCheck.access_token && !credsCheck.refresh_token) {
              console.error(`[API] No credentials available for ${contact.email}`);
              throw new Error('OAuth credentials not set');
            }
            
            // Personalize email
            let html = campaign.body_html;
            let text = campaign.body_text;
            let subject = campaign.subject;

            html = html.replace(/\{\{company\}\}/g, contact.company);
            text = text.replace(/\{\{company\}\}/g, contact.company);
            subject = subject.replace(/\{\{company\}\}/g, contact.company);

            // Get sender email from campaign or fallback to user email
            let senderEmail = campaign.from_email || user.email;
            if (!senderEmail) {
              throw new Error('Sender email not found');
            }

            // Get tokens for the selected email account
            const accounts = user.user_metadata?.gmail_accounts || [];
            let accountTokens = null;
            
            if (Array.isArray(accounts) && accounts.length > 0) {
              // Find account matching the from_email
              const account = accounts.find((acc) => acc.email === senderEmail);
              if (account) {
                accountTokens = {
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expiry_date: account.expiry_date,
                };
              } else {
                // Fallback to first account
                accountTokens = {
                  access_token: accounts[0].access_token,
                  refresh_token: accounts[0].refresh_token,
                  expiry_date: accounts[0].expiry_date,
                };
                senderEmail = accounts[0].email;
              }
            } else {
              // Fallback to old format
              accountTokens = {
                access_token: user.user_metadata?.gmail_token,
                refresh_token: user.user_metadata?.gmail_refresh_token,
                expiry_date: user.user_metadata?.gmail_token_expiry,
              };
            }

            if (!accountTokens?.access_token || !accountTokens?.refresh_token) {
              throw new Error('Gmail tokens not found for selected email');
            }

            // Create email with proper headers
            const emailLines = [
              `From: ${senderEmail}`,
              `To: ${contact.email}`,
            ];
            
            if (campaign.settings?.ccEmail) {
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

            // Update contact status
            await supabase
              .from('contacts')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', contact.id);

            sentCount++;
            console.log(`[API] Sent email to ${contact.email} (${sentCount}/${contactsToSend.length})`);

            // Wait before next email
            if (sentCount < contactsToSend.length) {
              await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
          } catch (contactError) {
            console.error(`[API] Error sending to ${contact.email}:`, contactError);
            failedCount++;
            
            await supabase
              .from('contacts')
              .update({ 
                status: 'failed', 
                error: contactError instanceof Error ? contactError.message : 'Unknown error'
              })
              .eq('id', contact.id);
          }
        }

        // Update campaign status
        // Check if all contacts (including previously sent) are now sent
        const { data: allContacts } = await supabase
          .from('contacts')
          .select('status')
          .eq('campaign_id', req.params.id);
        
        const allSent = allContacts?.every((c) => c.status === 'sent') || false;
        const allFailed = allContacts?.every((c) => c.status === 'failed') || false;
        const finalStatus = allFailed ? 'failed' : (allSent ? 'completed' : (failedCount === contactsToSend.length ? 'failed' : 'completed'));
        
        await supabase
          .from('campaigns')
          .update({ 
            status: finalStatus, 
            completed_at: new Date().toISOString() 
          })
          .eq('id', req.params.id);

        console.log(`[API] Campaign sending completed. Sent: ${sentCount}, Failed: ${failedCount}, Total contacts: ${campaign.contacts.length}`);
      } catch (bgError) {
        console.error('[API] Background sending error:', bgError);
        await supabase
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', req.params.id);
      }
    })();

    return;
  } catch (error) {
    console.error('[API] Error in send endpoint:', error);
    return res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Contacts API
app.post('/api/contacts/upload', async (req, res) => {
  try {
    console.log('[API] POST /api/contacts/upload received');
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { campaign_id, contacts } = req.body;
    console.log('[API] Request body:', { 
      hasCampaignId: !!campaign_id, 
      campaignId: campaign_id, 
      contactsCount: contacts?.length 
    });

    // campaign_id is optional - if provided, verify it exists and belongs to user
    if (campaign_id) {
      console.log('[API] Validating campaign_id:', campaign_id);
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', campaign_id)
        .eq('user_id', user.id)
        .single();

      if (!campaign) {
        console.log('[API] Campaign not found or does not belong to user');
        return res.status(404).json({ error: 'Campaign not found' });
      }
      console.log('[API] Campaign validated successfully');
    } else {
      console.log('[API] No campaign_id provided - adding to library');
    }

    const contactsToInsert = contacts.map((contact) => {
      const contactData = {
        user_id: user.id,
        campaign_id: campaign_id || null, // null for library contacts
        email: contact.email,
        company: contact.company,
        custom_fields: contact.custom_fields || {},
        status: 'pending',
      };
      console.log('[API] Contact data:', {
        email: contactData.email,
        campaign_id: contactData.campaign_id,
        user_id: contactData.user_id ? 'set' : 'missing'
      });
      return contactData;
    });

    console.log('[API] Inserting contacts:', contactsToInsert.length, 'contacts');
    console.log('[API] First contact sample:', contactsToInsert[0] ? {
      email: contactsToInsert[0].email,
      company: contactsToInsert[0].company,
      campaign_id: contactsToInsert[0].campaign_id,
      user_id: contactsToInsert[0].user_id ? 'set' : 'missing'
    } : 'none');

    const { data: insertedContacts, error: insertError } = await supabase
      .from('contacts')
      .insert(contactsToInsert)
      .select();

    if (insertError) {
      console.error('[API] Database insert error:', insertError);
      console.error('[API] Error code:', insertError.code);
      console.error('[API] Error message:', insertError.message);
      console.error('[API] Error details:', JSON.stringify(insertError, null, 2));
      
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'Some contacts already exist' });
      }
      
      // Check if it's a NOT NULL constraint error
      if (insertError.code === '23502' || insertError.message?.includes('null value') || insertError.message?.includes('NOT NULL')) {
        return res.status(400).json({ 
          error: 'Database migration not run. The contacts table still requires campaign_id. Please run migration 002_add_contacts_library.sql in Supabase.',
          details: insertError.message,
          hint: 'Run the migration to make campaign_id nullable for library contacts'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to upload contacts',
        details: insertError.message,
        code: insertError.code
      });
    }

    return res.status(201).json({
      message: 'Contacts uploaded successfully',
      count: insertedContacts?.length || 0,
      contacts: insertedContacts,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Templates API
app.get('/api/templates/list', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', user.id)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    return res.json(templates || []);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Auth callback
app.get('/api/auth/callback', async (req, res) => {
  try {
    console.log('=== OAuth Callback Started ===');
    console.log('Request received at:', new Date().toISOString());
    console.log('Query params:', { 
      hasCode: !!req.query.code, 
      hasState: !!req.query.state,
      codeLength: req.query.code?.length,
      stateLength: req.query.state?.length
    });
    
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      console.error('Missing authorization code');
      return res.status(400).send(`
        <html>
          <body>
            <h1>Error: Missing authorization code</h1>
            <p>Please try connecting Gmail again.</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }

    if (!state || typeof state !== 'string') {
      console.error('Missing state parameter');
      return res.status(400).send(`
        <html>
          <body>
            <h1>Error: Missing state parameter</h1>
            <p>Please try connecting Gmail again.</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }

    console.log('Getting user from token...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(state);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).send(`
        <html>
          <body>
            <h1>Error: Invalid user token</h1>
            <p>Please sign in again and try connecting Gmail.</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }

    console.log('Creating OAuth2 client...');
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.VITE_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.VITE_GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';
    
    console.log('OAuth Config:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      redirectUri: redirectUri
    });

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials');
      return res.status(500).send(`
        <html>
          <body>
            <h1>Error: Google OAuth not configured</h1>
            <p>Please configure Google OAuth credentials in .env file.</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    console.log('Exchanging code for tokens...');
    console.log('Using redirect URI:', redirectUri);
    console.log('Code length:', code.length);
    
    let tokens;
    try {
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      console.log('Token exchange successful!');
    } catch (tokenError) {
      console.error('Token exchange error:', tokenError.message);
      console.error('Error code:', tokenError.response?.data?.error);
      console.error('Error description:', tokenError.response?.data?.error_description);
      
      let errorMessage = tokenError.message || 'Token exchange failed';
      if (tokenError.response?.data?.error === 'unauthorized_client') {
        errorMessage = 'Unauthorized client. Check that:\n1. Client ID and Secret are correct\n2. Redirect URI matches exactly: ' + redirectUri;
      } else if (tokenError.response?.data?.error === 'invalid_grant') {
        errorMessage = 'Invalid grant. The authorization code may have expired. Please try connecting again.';
      }
      
      return res.status(400).send(`
        <html>
          <body>
            <h1>Error: Failed to get access token</h1>
            <p><strong>${errorMessage}</strong></p>
            <p>Error: ${tokenError.response?.data?.error || 'Unknown'}</p>
            <p>Please try connecting Gmail again.</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }

    if (!tokens.access_token) {
      console.error('No access token in response');
      return res.status(400).send(`
        <html>
          <body>
            <h1>Error: No access token received</h1>
            <p>Please try connecting Gmail again.</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }

    console.log('Getting Gmail profile to get email address...');
    // Get the user's Gmail email address
    // Reuse the existing oauth2Client and update credentials
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    let gmailEmail = '';
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      gmailEmail = profile.data.emailAddress || '';
      console.log('Gmail email address:', gmailEmail);
      
      if (!gmailEmail || !gmailEmail.includes('@')) {
        throw new Error('Failed to retrieve valid Gmail email address');
      }
    } catch (profileError) {
      console.error('Error getting Gmail profile:', profileError);
      return res.status(400).send(`
        <html>
          <body>
            <h1>Error: Failed to retrieve Gmail email</h1>
            <p>Could not get your Gmail email address. Please try connecting again.</p>
            <p>Error: ${profileError instanceof Error ? profileError.message : 'Unknown error'}</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }

    console.log('Updating user metadata...');
    // Use service role key for admin operations
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    // Get existing accounts or initialize array
    const existingAccounts = user.user_metadata?.gmail_accounts || [];
    const accountsArray = Array.isArray(existingAccounts) ? [...existingAccounts] : [];
    
    // Check if this email already exists
    const existingIndex = accountsArray.findIndex((acc) => acc.email === gmailEmail);
    
    // Only create account if we have a valid email
    if (!gmailEmail || !gmailEmail.includes('@')) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Error: Invalid Gmail email</h1>
            <p>Could not retrieve a valid Gmail email address. Please try connecting again.</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }
    
    const newAccount = {
      email: gmailEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    };

    if (existingIndex >= 0) {
      // Update existing account
      accountsArray[existingIndex] = newAccount;
    } else {
      // Add new account
      accountsArray.push(newAccount);
    }

    // Also keep old format for backward compatibility
    const updateData = {
      ...user.user_metadata,
      gmail_accounts: accountsArray,
      // Keep old format for backward compatibility (use first account)
      gmail_token: accountsArray[0]?.access_token,
      gmail_refresh_token: accountsArray[0]?.refresh_token,
      gmail_token_expiry: accountsArray[0]?.expiry_date,
      gmail_email: gmailEmail,
    };

    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
      user_metadata: updateData,
    });

    if (updateError) {
      console.error('Error updating user:', updateError);
      return res.status(500).send(`
        <html>
          <body>
            <h1>Error: Failed to save Gmail credentials</h1>
            <p>${updateError.message || 'Database update failed'}</p>
            <p>Please try again.</p>
            <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
          </body>
        </html>
      `);
    }

    console.log('Success! Gmail account stored:', {
      email: gmailEmail,
      accountsCount: accountsArray.length,
      accountsArray: accountsArray.map((acc) => acc.email)
    });
    return res.redirect(302, 'http://localhost:3000/settings?gmail=connected');
  } catch (error) {
    console.error('Unexpected error in OAuth callback:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return res.status(500).send(`
      <html>
        <body>
          <h1>Error: Internal server error</h1>
          <p><strong>${error.message || 'An unexpected error occurred'}</strong></p>
          <p>Check the server console for detailed error logs.</p>
          <p>Please try connecting Gmail again.</p>
          <script>setTimeout(() => window.location.href = 'http://localhost:3000/settings', 3000);</script>
        </body>
      </html>
    `);
  }
});

// Endpoint to fetch Gmail email from stored tokens
console.log('📧 Registering /api/gmail/fetch-email endpoint...');
app.post('/api/gmail/fetch-email', async (req, res) => {
  try {
    console.log('[fetch-email] Request received');
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      console.log('[fetch-email] No authorization token');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await getUserFromToken(token);
    if (!user) {
      console.log('[fetch-email] User not found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[fetch-email] User found:', user.id);

    // Get tokens from user metadata
    const accessToken = user.user_metadata?.gmail_token;
    const refreshToken = user.user_metadata?.gmail_refresh_token;
    
    if (!accessToken || !refreshToken) {
      console.log('[fetch-email] No Gmail tokens found in metadata');
      return res.status(400).json({ error: 'No Gmail tokens found' });
    }

    console.log('[fetch-email] Tokens found, fetching email from Gmail API...');

    // Get Gmail email using tokens
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';
    
    if (!clientId || !clientSecret) {
      console.error('[fetch-email] Missing Google OAuth credentials');
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }
    
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    
    console.log('[fetch-email] Calling Gmail API...');
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const gmailEmail = profile.data.emailAddress || '';
    
    console.log('[fetch-email] Gmail email retrieved:', gmailEmail);
    
    if (!gmailEmail || !gmailEmail.includes('@')) {
      console.error('[fetch-email] Invalid email retrieved:', gmailEmail);
      return res.status(400).json({ error: 'Failed to retrieve valid Gmail email' });
    }

    // Update user metadata with the email
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;
    const adminSupabase = createClient(supabaseUrl, serviceKey);
    
    // Get existing accounts
    const existingAccounts = user.user_metadata?.gmail_accounts || [];
    const accountsArray = Array.isArray(existingAccounts) ? [...existingAccounts] : [];
    
    // Check if this email already exists
    const existingIndex = accountsArray.findIndex((acc) => acc.email === gmailEmail);
    
    const accountData = {
      email: gmailEmail,
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: user.user_metadata?.gmail_token_expiry,
    };
    
    if (existingIndex >= 0) {
      accountsArray[existingIndex] = accountData;
    } else {
      accountsArray.push(accountData);
    }
    
    // Update user metadata
    const updateData = {
      ...user.user_metadata,
      gmail_accounts: accountsArray,
      gmail_token: accountsArray[0]?.access_token,
      gmail_refresh_token: accountsArray[0]?.refresh_token,
      gmail_token_expiry: accountsArray[0]?.expiry_date,
      gmail_email: gmailEmail,
    };
    
    console.log('[fetch-email] Updating user metadata...');
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
      user_metadata: updateData,
    });
    
    if (updateError) {
      console.error('[fetch-email] Error updating user metadata:', updateError);
      return res.status(500).json({ error: 'Failed to update user metadata', details: updateError.message });
    }
    
    console.log('[fetch-email] Success! Email stored:', gmailEmail);
    return res.json({ email: gmailEmail, success: true });
  } catch (error) {
    console.error('[fetch-email] Error:', error);
    console.error('[fetch-email] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return res.status(500).json({ 
      error: 'Failed to fetch Gmail email', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API server is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/test',
      'POST /api/gmail/fetch-email',
      'GET /api/auth/callback',
      'POST /api/campaigns/:id/send'
    ]
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📝 Make sure Vite dev server is running on port 3000`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📧 OAuth callback: http://localhost:${PORT}/api/auth/callback`);
  console.log(`📧 Gmail fetch email: POST http://localhost:${PORT}/api/gmail/fetch-email`);
});

