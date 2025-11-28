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

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // GET /api/campaigns - List campaigns
  if (req.method === 'GET') {
    try {
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
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

  // POST /api/campaigns - Create campaign
  if (req.method === 'POST') {
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

  return res.status(405).json({ error: 'Method not allowed' });
}

