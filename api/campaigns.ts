import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Validation schema
const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  subject: z.string().min(1, 'Subject is required').max(500),
  body_html: z.string().min(1, 'Email body is required'),
  body_text: z.string().min(1, 'Plain text version is required'),
  from_email: z.string().email('Invalid from email address').optional().nullable().or(z.literal('').transform(() => null)),
  settings: z.object({
    delay: z.number().min(1).max(300).default(45),
    ccEmail: z.string().email().optional().nullable().or(z.literal('').transform(() => null)),
  }).optional(),
  design_json: z.unknown().optional().nullable(),
});

// Create Supabase client function (don't initialize at module level to avoid crashes)
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase environment variables not configured');
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Wrap entire handler in try-catch to prevent unhandled errors
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Handle health check via query parameter (no auth required)
    if (req.query.health === 'true' || req.url?.includes('?health=true')) {
      try {
        // Dynamically import to avoid module load issues
        const { validateConfiguration } = await import('./lib/config-validator');
        
        // Validate configuration safely
        let config;
        try {
          config = validateConfiguration();
        } catch (configError) {
          console.error('[Health Check] Config validation error:', configError);
          config = {
            isValid: false,
            errors: [configError instanceof Error ? configError.message : 'Configuration validation failed'],
            warnings: [],
            emailMethod: 'none' as const,
          };
        }
        
        const health: {
          status: 'healthy' | 'degraded' | 'unhealthy';
          timestamp: string;
          config: typeof config;
          services: {
            supabase: 'ok' | 'error';
            email: 'ok' | 'error' | 'warning';
          };
          error?: string;
        } = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          config,
          services: {
            supabase: 'ok',
            email: 'ok',
          },
        };

        // Check Supabase connection
        try {
          if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
            const supabaseClient = getSupabaseClient();
            // Use a simple query that won't fail on permissions
            const { error: testError } = await supabaseClient.from('campaigns').select('id').limit(1);
            if (testError) {
              console.warn('[Health Check] Supabase test query error:', testError.message);
              health.services.supabase = 'error';
              health.status = 'unhealthy';
            } else {
              health.services.supabase = 'ok';
            }
          } else {
            health.services.supabase = 'error';
            health.status = 'unhealthy';
          }
        } catch (error) {
          console.error('[Health Check] Supabase connection error:', error);
          health.services.supabase = 'error';
          health.status = 'unhealthy';
          health.error = error instanceof Error ? error.message : 'Unknown error';
        }

        // Check email configuration
        if (!health.config.isValid) {
          health.services.email = 'error';
          health.status = 'unhealthy';
        } else if (health.config.warnings.length > 0) {
          health.services.email = 'warning';
          if (health.status === 'healthy') {
            health.status = 'degraded';
          }
        }

        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
        return res.status(statusCode).json(health);
      } catch (error) {
        console.error('[Health Check] Unexpected error:', error);
        return res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
          config: {
            isValid: false,
            errors: [error instanceof Error ? error.message : 'Health check failed'],
            warnings: [],
            emailMethod: 'none' as const,
          },
          services: {
            supabase: 'error',
            email: 'error',
          },
        });
      }
    }

    // All other routes require authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get Supabase client
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (supabaseError) {
      console.error('[Campaigns] Error creating Supabase client:', supabaseError);
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Failed to initialize database connection' 
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token', details: authError?.message });
    }

  // GET /api/campaigns - List campaigns, templates, or reminder rules
  if (req.method === 'GET') {
    try {
      const type = req.query.type as string | undefined;

      // GET /api/campaigns?type=templates - List templates
      if (type === 'templates') {
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
        return res.status(200).json(templates || []);
      }

      // GET /api/campaigns?type=reminders - List reminder rules
      if (type === 'reminders') {
        const { data, error } = await supabase
          .from('reminder_rules')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
      }

      // GET /api/campaigns?type=email-accounts - List user's email accounts
      if (type === 'email-accounts') {
        try {
          const { data, error } = await supabase
            .from('user_email_accounts')
            .select('id, account_type, email_address, display_name, is_default, domain_name, domain_verified, esp_provider, created_at, updated_at')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error('[Email Accounts] Database error:', error);
            
            // Check if it's a table not found error
            if (error.message?.includes('user_email_accounts') || error.message?.includes('schema cache') || error.code === '42P01') {
              return res.status(503).json({ 
                error: 'Database migration required',
                details: 'The user_email_accounts table does not exist. Please run migration 010_add_user_email_accounts.sql in your Supabase database. See docs/MIGRATION_010_REQUIRED.md for instructions.',
                migrationRequired: true,
              });
            }
            
            return res.status(500).json({ error: error.message, details: error });
          }
          return res.json(data || []);
        } catch (unexpectedError) {
          console.error('[Email Accounts] Unexpected error:', unexpectedError);
          return res.status(500).json({ 
            error: 'Failed to load email accounts',
            details: unexpectedError instanceof Error ? unexpectedError.message : 'Unknown error',
          });
        }
      }

      // GET /api/campaigns?type=verify-domain&account_id=xxx - Verify domain DNS records
      if (type === 'verify-domain') {
        const { account_id } = req.query;
        
        if (!account_id || typeof account_id !== 'string') {
          return res.status(400).json({ error: 'account_id is required' });
        }
        
        try {
          // Get account
          const { data: account, error: accountError } = await supabase
            .from('user_email_accounts')
            .select('*')
            .eq('id', account_id)
            .eq('user_id', user.id)
            .single();
          
          if (accountError || !account) {
            return res.status(404).json({ error: 'Email account not found' });
          }
          
          if (account.account_type !== 'esp_domain' || !account.domain_name) {
            return res.status(400).json({ error: 'Domain verification only available for ESP domain accounts' });
          }
          
          const { 
            verifyDomainOwnership, 
            verifySPFRecord, 
            verifyDKIMRecord, 
            verifyDMARCRecord 
          } = await import('./lib/dns-verification');
          
          const domain = account.domain_name;
          const verificationResults: any = {
            domain,
            ownership: false,
            spf: { valid: false },
            dkim: { valid: false },
            dmarc: { valid: false },
          };
          
          // Verify ownership
          if (account.domain_verification_token) {
            verificationResults.ownership = await verifyDomainOwnership(
              domain, 
              account.domain_verification_token
            );
          }
          
          // Verify SPF
          verificationResults.spf = await verifySPFRecord(domain);
          
          // Verify DKIM (try common selectors)
          const dkimSelectors = ['default', 's1', 's2', 'mail'];
          for (const selector of dkimSelectors) {
            const dkimResult = await verifyDKIMRecord(domain, selector);
            if (dkimResult.valid) {
              verificationResults.dkim = dkimResult;
              break;
            }
          }
          
          // Verify DMARC
          verificationResults.dmarc = await verifyDMARCRecord(domain);
          
          // Update domain_verified if all checks pass
          const allVerified = verificationResults.ownership && 
                             verificationResults.spf.valid && 
                             verificationResults.dkim.valid && 
                             verificationResults.dmarc.valid;
          
          if (allVerified && !account.domain_verified) {
            await supabase
              .from('user_email_accounts')
              .update({ domain_verified: true })
              .eq('id', account_id);
          }
          
          return res.json(verificationResults);
        } catch (error) {
          console.error('[Domain Verification] Error:', error);
          return res.status(500).json({ 
            error: 'Failed to verify domain', 
            details: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      // GET /api/campaigns - List campaigns (default)
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, user_id, name, subject, from_email, status, settings, created_at, sent_at, completed_at, design_json')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Failed to fetch campaigns' });
      }

      return res.status(200).json(campaigns || []);
    } catch (error) {
      console.error('Unexpected error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST /api/campaigns - Create campaign, upload contacts, or manage reminders
  if (req.method === 'POST') {
    const type = req.query.type as string | undefined;

    // POST /api/campaigns?type=contacts - Upload contacts
    if (type === 'contacts') {
      try {
        const { ContactsUploadSchema } = await import('./lib/validations');
        const { campaign_id, contacts } = req.body;

        // campaign_id is optional - if provided, verify it exists and belongs to user
        if (campaign_id) {
          if (typeof campaign_id !== 'string') {
            return res.status(400).json({ error: 'Invalid campaign_id' });
          }

          const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('id')
            .eq('id', campaign_id)
            .eq('user_id', user.id)
            .single();

          if (campaignError || !campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
          }
        }

        // Validate contacts
        const validation = ContactsUploadSchema.safeParse(contacts);
        if (!validation.success) {
          return res.status(400).json({ error: validation.error.errors });
        }

        // Insert contacts
        const contactsToInsert = validation.data.map((contact) => ({
          user_id: user.id,
          campaign_id: campaign_id || null,
          email: contact.email,
          company: contact.company,
          custom_fields: contact.custom_fields || {},
          status: 'pending',
        }));

        const { data: insertedContacts, error: insertError } = await supabase
          .from('contacts')
          .insert(contactsToInsert)
          .select();

        if (insertError) {
          if (insertError.code === '23505') {
            return res.status(409).json({ error: 'Some contacts already exist in this campaign' });
          }
          console.error('Database error:', insertError);
          return res.status(500).json({ error: 'Failed to upload contacts' });
        }

        return res.status(201).json({
          message: 'Contacts uploaded successfully',
          count: insertedContacts?.length || 0,
          contacts: insertedContacts,
        });
      } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // POST /api/campaigns?type=gmail - Fetch Gmail email
    if (type === 'gmail') {
      try {
        const { google } = await import('googleapis');
        
        // Get Gmail tokens from user metadata
        const accessToken = user.user_metadata?.gmail_token;
        const refreshToken = user.user_metadata?.gmail_refresh_token;

        if (!accessToken || !refreshToken) {
          return res.status(400).json({ error: 'Gmail not connected. Please connect Gmail first.' });
        }

        // Set up OAuth client
        let redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
        if (!redirectUri) {
          return res.status(500).json({ error: 'GOOGLE_REDIRECT_URI not configured' });
        }
        
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

        // Fetch Gmail profile to get email
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        const gmailEmail = profile.data.emailAddress || '';

        if (!gmailEmail) {
          return res.status(400).json({ error: 'Could not fetch Gmail email address' });
        }

        // Update user metadata with email
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            gmail_email: gmailEmail,
          },
        });

        if (updateError) {
          console.error('[Gmail Fetch Email] Error updating user:', updateError);
          return res.status(500).json({ error: 'Failed to save Gmail email' });
        }

        return res.status(200).json({ email: gmailEmail });
      } catch (error) {
        console.error('[Gmail Fetch Email] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'Internal server error', details: errorMessage });
      }
    }

    // POST /api/campaigns?type=email-accounts - Create email account
    if (type === 'email-accounts') {
      try {
        const { encrypt } = await import('./lib/encryption');
        const { account_type, email_address, display_name, esp_provider, esp_api_key, domain_name } = req.body;
        
        // Validate required fields
        if (!account_type || !email_address) {
          return res.status(400).json({ error: 'account_type and email_address are required' });
        }
        
        if (!['google_oauth', 'microsoft_oauth', 'esp_domain'].includes(account_type)) {
          return res.status(400).json({ error: 'Invalid account_type' });
        }
        
        // For ESP accounts, validate additional fields
        if (account_type === 'esp_domain') {
          if (!esp_provider || !esp_api_key || !domain_name) {
            return res.status(400).json({ error: 'esp_provider, esp_api_key, and domain_name are required for ESP accounts' });
          }
          if (!['sendgrid', 'postmark', 'ses', 'mailgun'].includes(esp_provider)) {
            return res.status(400).json({ error: 'Invalid esp_provider' });
          }
        }
        
        // Check if email already exists for this user
        const { data: existing } = await supabase
          .from('user_email_accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('email_address', email_address)
          .single();
        
        if (existing) {
          return res.status(409).json({ error: 'Email account already exists' });
        }
        
        // Check if this will be the first account (set as default)
        const { count } = await supabase
          .from('user_email_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        const isDefault = (count || 0) === 0;
        
        // Prepare account data
        const accountData: any = {
          user_id: user.id,
          account_type,
          email_address,
          display_name: display_name || email_address,
          is_default: isDefault,
        };
        
        // Add ESP-specific fields if applicable
        if (account_type === 'esp_domain') {
          accountData.esp_provider = esp_provider;
          accountData.esp_api_key_encrypted = encrypt(esp_api_key);
          accountData.domain_name = domain_name;
          accountData.domain_verified = false;
        }
        
        const { data: account, error } = await supabase
          .from('user_email_accounts')
          .insert(accountData)
          .select('id, account_type, email_address, display_name, is_default, domain_name, domain_verified, esp_provider, created_at')
          .single();
        
        if (error) {
          console.error('[Email Accounts] Create error:', error);
          return res.status(500).json({ error: error.message });
        }
        
        return res.status(201).json(account);
      } catch (error) {
        console.error('[Email Accounts] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'Internal server error', details: errorMessage });
      }
    }

    // POST /api/campaigns?type=test-email-account - Test email account connection
    if (type === 'test-email-account') {
      try {
        const { account_id, esp_api_key } = req.body;
        
        if (!account_id) {
          return res.status(400).json({ error: 'account_id is required' });
        }
        
        // Get account
        const { data: account, error: accountError } = await supabase
          .from('user_email_accounts')
          .select('*')
          .eq('id', account_id)
          .eq('user_id', user.id)
          .single();
        
        if (accountError || !account) {
          return res.status(404).json({ error: 'Email account not found' });
        }
        
        // Test based on account type
        if (account.account_type === 'esp_domain') {
          // Test ESP connection
          const apiKey = esp_api_key || (account.esp_api_key_encrypted ? (await import('./lib/encryption')).decrypt(account.esp_api_key_encrypted) : null);
          
          if (!apiKey) {
            return res.status(400).json({ error: 'ESP API key required for testing' });
          }
          
          // Test with SendGrid (for now, can expand later)
          if (account.esp_provider === 'sendgrid') {
            try {
              const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (response.ok) {
                return res.json({ 
                  success: true, 
                  message: 'ESP connection successful',
                  provider: account.esp_provider 
                });
              } else {
                const errorData = await response.json().catch(() => ({}));
                return res.status(400).json({ 
                  success: false, 
                  error: 'ESP connection failed', 
                  details: errorData 
                });
              }
            } catch (testError) {
              return res.status(500).json({ 
                success: false, 
                error: 'Failed to test ESP connection', 
                details: testError instanceof Error ? testError.message : 'Unknown error' 
              });
            }
          }
          
          return res.status(400).json({ error: `Testing not yet implemented for ${account.esp_provider}` });
        } else if (account.account_type === 'google_oauth') {
          // Test Google OAuth (check if token is valid)
          if (!account.google_token) {
            return res.status(400).json({ error: 'Google OAuth token not found' });
          }
          
          // Try to refresh token to verify it's valid
          const { google } = await import('googleapis');
          let redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
          if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
            redirectUri = `https://${redirectUri}`;
          }
          
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
          );
          
          oauth2Client.setCredentials({
            access_token: account.google_token,
            refresh_token: account.google_refresh_token,
          });
          
          try {
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            await gmail.users.getProfile({ userId: 'me' });
            return res.json({ success: true, message: 'Google OAuth connection valid' });
          } catch (oauthError) {
            return res.status(400).json({ 
              success: false, 
              error: 'Google OAuth connection invalid', 
              details: oauthError instanceof Error ? oauthError.message : 'Unknown error' 
            });
          }
        }
        
        return res.status(400).json({ error: 'Account type not supported for testing' });
      } catch (error) {
        console.error('[Test Email Account] Unexpected error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // POST /api/campaigns?type=reminders - Create reminder rule
    if (type === 'reminders') {
      try {
        const { name, trigger_type, trigger_value, reminder_campaign_id, source_campaign_id, max_reminders } = req.body;
        
        if (!name || !trigger_type || !trigger_value || !reminder_campaign_id || !source_campaign_id) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
          .from('reminder_rules')
          .insert({
            user_id: user.id,
            name,
            trigger_type,
            trigger_value,
            reminder_campaign_id,
            source_campaign_id,
            max_reminders: max_reminders || 3,
          })
          .select()
          .single();
        
        if (error) return res.status(500).json({ error: error.message });
        
        // Schedule reminders for existing contacts
        const { data: rule } = await supabase
          .from('reminder_rules')
          .select('*')
          .eq('id', data.id)
          .single();

        if (rule && rule.is_active) {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('campaign_id', rule.source_campaign_id)
            .eq('status', 'sent');

          if (contacts && contacts.length > 0) {
            const scheduledFor = new Date();
            if (rule.trigger_type === 'days_after_campaign') {
              scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
            } else if (rule.trigger_type === 'days_after_last_email') {
              scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
            } else if (rule.trigger_type === 'no_response') {
              scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
            }

            const queueEntries = contacts.map(contact => ({
              user_id: user.id,
              contact_id: contact.id,
              reminder_rule_id: rule.id,
              campaign_id: rule.reminder_campaign_id,
              scheduled_for: scheduledFor.toISOString(),
              status: 'pending',
              reminder_count: 0,
            }));

            await supabase.from('reminder_queue').insert(queueEntries);
          }
        }
        
        return res.json(data);
      } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // POST /api/campaigns - Create campaign (default)
    try {
      if (!req.body) {
        return res.status(400).json({ error: 'Request body is required' });
      }

      const validation = CreateCampaignSchema.safeParse(req.body);
      if (!validation.success) {
        console.error('Validation error:', validation.error.errors);
        return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      }

      const campaignData: Record<string, unknown> = {
        ...validation.data,
        user_id: user.id,
        status: 'draft' as const,
      };
      
      if (validation.data.design_json !== undefined) {
        campaignData.design_json = validation.data.design_json;
      }
      
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert(campaignData as any)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        
        // If error is about missing design_json column, try again without it
        if (error.message?.includes('design_json') && validation.data.design_json !== undefined) {
          console.warn('design_json column not found, retrying without it');
          const { design_json, ...dataWithoutDesign } = campaignData;
          const { data: campaignRetry, error: errorRetry } = await supabase
            .from('campaigns')
            .insert(dataWithoutDesign as any)
            .select()
            .single();
          
          if (errorRetry) {
            return res.status(500).json({ error: 'Failed to create campaign', details: errorRetry.message });
          }
          
          return res.status(201).json(campaignRetry);
        }
        
        return res.status(500).json({ error: 'Failed to create campaign', details: error.message });
      }

      if (!campaign) {
        return res.status(500).json({ error: 'Campaign created but not returned' });
      }

      return res.status(201).json(campaign);
    } catch (error) {
      console.error('Unexpected error in create campaign:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: errorMessage,
      });
    }
  }

  // PUT /api/campaigns?type=email-accounts&id=xxx - Update email account
  if (req.method === 'PUT' && req.query.type === 'email-accounts') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Account ID required' });
    }

    try {
      const { encrypt } = await import('./lib/encryption');
      const { display_name, is_default, esp_api_key, domain_name } = req.body;

      // Get existing account
      const { data: existingAccount, error: fetchError } = await supabase
        .from('user_email_accounts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !existingAccount) {
        return res.status(404).json({ error: 'Email account not found' });
      }

      const updateData: any = {};
      
      if (display_name !== undefined) updateData.display_name = display_name;
      if (domain_name !== undefined) updateData.domain_name = domain_name;
      
      // Handle default account switching
      if (is_default === true) {
        // Unset other default accounts
        await supabase
          .from('user_email_accounts')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
        
        updateData.is_default = true;
      } else if (is_default === false) {
        // Check if this is the only account (can't unset if it's the only one)
        const { count } = await supabase
          .from('user_email_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        if (count === 1) {
          return res.status(400).json({ error: 'Cannot unset default account when it is the only account' });
        }
        
        updateData.is_default = false;
      }
      
      // Update ESP API key if provided
      if (esp_api_key !== undefined && existingAccount.account_type === 'esp_domain') {
        updateData.esp_api_key_encrypted = encrypt(esp_api_key);
      }

      const { data: account, error } = await supabase
        .from('user_email_accounts')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id, account_type, email_address, display_name, is_default, domain_name, domain_verified, esp_provider, created_at, updated_at')
        .single();
      
      if (error) {
        console.error('[Email Accounts] Update error:', error);
        return res.status(500).json({ error: error.message });
      }
      if (!account) return res.status(404).json({ error: 'Account not found' });
      
      return res.json(account);
    } catch (error) {
      console.error('[Email Accounts] Update unexpected error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /api/campaigns?type=reminders&id=xxx - Update reminder rule
  if (req.method === 'PUT' && req.query.type === 'reminders') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Rule ID required' });
    }

    const { name, trigger_type, trigger_value, reminder_campaign_id, source_campaign_id, is_active, max_reminders } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (trigger_type !== undefined) updateData.trigger_type = trigger_type;
    if (trigger_value !== undefined) updateData.trigger_value = trigger_value;
    if (reminder_campaign_id !== undefined) updateData.reminder_campaign_id = reminder_campaign_id;
    if (source_campaign_id !== undefined) updateData.source_campaign_id = source_campaign_id;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (max_reminders !== undefined) updateData.max_reminders = max_reminders;

    const { data, error } = await supabase
      .from('reminder_rules')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Rule not found' });
    
    return res.json(data);
  }

  // DELETE /api/campaigns?type=email-accounts&id=xxx - Delete email account
  if (req.method === 'DELETE' && req.query.type === 'email-accounts') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Account ID required' });
    }

    try {
      // Check if this is the only account
      const { count } = await supabase
        .from('user_email_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (count === 1) {
        return res.status(400).json({ error: 'Cannot delete the only email account. Please add another account first.' });
      }
      
      // Get account to check if it's default
      const { data: account } = await supabase
        .from('user_email_accounts')
        .select('is_default')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      
      const { error } = await supabase
        .from('user_email_accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('[Email Accounts] Delete error:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // If deleted account was default, set another as default
      if (account?.is_default) {
        const { data: otherAccount } = await supabase
          .from('user_email_accounts')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        
        if (otherAccount) {
          await supabase
            .from('user_email_accounts')
            .update({ is_default: true })
            .eq('id', otherAccount.id);
        }
      }
      
      return res.json({ success: true });
    } catch (error) {
      console.error('[Email Accounts] Delete unexpected error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE /api/campaigns?type=reminders&id=xxx - Delete reminder rule
  if (req.method === 'DELETE' && req.query.type === 'reminders') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Rule ID required' });
    }

    const { error } = await supabase
      .from('reminder_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) return res.status(500).json({ error: error.message });
    
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    // Top-level error handler - catch any unhandled errors
    console.error('[Campaigns API] Unhandled error:', error);
    console.error('[Campaigns API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: 'An unexpected error occurred. Please check server logs.',
    });
  }
}

