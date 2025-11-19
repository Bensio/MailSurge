import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid campaign ID' });
  }

  try {
    // Check environment variables
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

    if (req.method === 'GET') {
      // Get campaign first
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (campaignError) {
        console.error('Campaign fetch error:', campaignError);
        // Check if it's a "not found" error (PGRST116) or row-level security issue
        if (campaignError.code === 'PGRST116' || campaignError.message?.includes('No rows')) {
          return res.status(404).json({ error: 'Campaign not found' });
        }
        return res.status(404).json({ error: 'Campaign not found', details: campaignError.message });
      }

      if (!campaignData) {
        console.error('Campaign data is null');
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Get ONLY contacts that belong to THIS specific campaign
      // Filter by campaign_id to ensure we only get contacts for this campaign
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('campaign_id', id)
        .order('email', { ascending: true });

      if (contactsError) {
        console.error('Error fetching contacts:', contactsError);
      }

      // Return campaign with filtered contacts (only this campaign's contacts)
      return res.status(200).json({
        ...campaignData,
        contacts: contacts || [],
      });
    }

    if (req.method === 'PUT') {
      // Update campaign
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

    if (req.method === 'DELETE') {
      // Delete campaign (contacts will be deleted via CASCADE)
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

