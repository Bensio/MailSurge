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

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { validateConfiguration } = await import('./lib/config-validator');
    
    const health: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      timestamp: string;
      config: ReturnType<typeof validateConfiguration>;
      services: {
        supabase: 'ok' | 'error';
        email: 'ok' | 'error' | 'warning';
      };
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      config: validateConfiguration(),
      services: {
        supabase: 'ok',
        email: 'ok',
      },
    };

    // Check Supabase connection
    try {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        await supabase.from('campaigns').select('id').limit(1);
        health.services.supabase = 'ok';
      } else {
        health.services.supabase = 'error';
        health.status = 'unhealthy';
      }
    } catch (error) {
      health.services.supabase = 'error';
      health.status = 'unhealthy';
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
  }

  // All other routes require authentication
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
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
}

