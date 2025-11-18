import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize Inngest client for sending events
// IMPORTANT: This client needs the eventKey to send events to Inngest Cloud
const inngest = new Inngest({ 
  id: 'mailsurge',
  name: 'MailSurge',
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Inngest Cloud endpoint (defaults to https://api.inngest.com)
  // No need to specify if using default
});

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

    // Use Inngest for reliable background email sending
    // This avoids Vercel's function timeout limitations
    try {
      // Check if event key is set
      if (!process.env.INNGEST_EVENT_KEY) {
        console.error('[API] INNGEST_EVENT_KEY is not set!');
        return res.status(500).json({ 
          error: 'Inngest not configured', 
          details: 'INNGEST_EVENT_KEY environment variable is missing'
        });
      }

      console.log('[API] Sending Inngest event:', {
        eventName: 'campaign/send',
        campaignId: id,
        userId: user.id,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        eventKeySet: !!process.env.INNGEST_EVENT_KEY,
        eventKeyPrefix: process.env.INNGEST_EVENT_KEY?.substring(0, 10) + '...',
      });

      const eventResult = await inngest.send({
        name: 'campaign/send',
        data: {
          campaignId: id,
          userId: user.id,
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
      });

      console.log('[API] Inngest event sent successfully:', {
        campaignId: id,
        eventResult: eventResult,
      });
      
      return res.status(200).json({ 
        status: 'started', 
        total: campaign.contacts?.length || 0,
        message: 'Email sending started via Inngest. Emails will be sent in the background.'
      });
    } catch (inngestError) {
      console.error('[API] Error sending to Inngest:', inngestError);
      return res.status(500).json({ 
        error: 'Failed to start email sending', 
        details: inngestError instanceof Error ? inngestError.message : 'Unknown error',
        hint: 'Check INNGEST_EVENT_KEY environment variable in Vercel'
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

