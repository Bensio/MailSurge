import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from auth header
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[Gmail Fetch Email] Auth error:', authError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get Gmail tokens from user metadata
    const accessToken = user.user_metadata?.gmail_token;
    const refreshToken = user.user_metadata?.gmail_refresh_token;

    if (!accessToken || !refreshToken) {
      return res.status(400).json({ error: 'Gmail not connected. Please connect Gmail first.' });
    }

    // Set up OAuth client
    let redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!redirectUri) {
      return res.status(500).json({ error: 'GOOGLE_REDIRECT_URI not configured' });
    }
    
    // Ensure redirect URI has protocol
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

