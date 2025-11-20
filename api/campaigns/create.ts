import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Inline validation schema to avoid import issues
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
  design_json: z.unknown().optional().nullable(), // Unlayer design JSON
});

// Initialize Supabase client inside handler to catch initialization errors
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
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

  try {
    // Initialize Supabase
    const supabaseClient = getSupabase();

    // Get user from auth header
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Validate request body
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const validation = CreateCampaignSchema.safeParse(req.body);
    if (!validation.success) {
      console.error('Validation error:', validation.error.errors);
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    // Create campaign
    const campaignData: Record<string, unknown> = {
      ...validation.data,
      user_id: user.id,
      status: 'draft' as const,
    };
    
    // Only include design_json if it exists in validation data
    // This allows the code to work even if the migration hasn't been run yet
    if (validation.data.design_json !== undefined) {
      campaignData.design_json = validation.data.design_json;
    }
    
    const { data: campaign, error } = await supabaseClient
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
        const { data: campaignRetry, error: errorRetry } = await supabaseClient
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
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    console.error('Error stack:', errorStack);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
}



