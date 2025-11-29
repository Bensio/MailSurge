import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[OAuth Callback] ===== CALLBACK CALLED =====');
  console.log('[OAuth Callback] Method:', req.method);
  console.log('[OAuth Callback] URL:', req.url);
  console.log('[OAuth Callback] Query:', req.query);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, state } = req.query;
    
    console.log('[OAuth Callback] Code present:', !!code);
    console.log('[OAuth Callback] State present:', !!state);

    if (!code || typeof code !== 'string') {
      console.error('[OAuth Callback] Missing authorization code');
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    if (!state || typeof state !== 'string') {
      console.error('[OAuth Callback] Missing state parameter');
      return res.status(400).json({ error: 'Missing state parameter' });
    }

    // Verify state contains user token
    const token = state;
    console.log('[OAuth Callback] Verifying user token...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[OAuth Callback] Invalid user token:', authError);
      return res.status(401).json({ error: 'Invalid user token' });
    }
    console.log('[OAuth Callback] User verified:', user.id);

    // Exchange code for tokens
    let redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!redirectUri) {
      return res.status(500).json({ error: 'GOOGLE_REDIRECT_URI not configured' });
    }
    
    // Ensure redirect URI has protocol (fix for missing https://)
    if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
      redirectUri = `https://${redirectUri}`;
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    console.log('[OAuth Callback] Using redirect URI:', redirectUri);
    console.log('[OAuth Callback] Exchanging code for tokens...');

    const { tokens } = await oauth2Client.getToken(code);
    console.log('[OAuth Callback] Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    });

    if (!tokens.access_token) {
      console.error('[OAuth Callback] No access token in response');
      return res.status(400).json({ error: 'Failed to get access token' });
    }

    // Fetch Gmail profile to get the email address
    console.log('[OAuth Callback] Fetching Gmail profile...');
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    let gmailEmail = '';
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      gmailEmail = profile.data.emailAddress || '';
      console.log('[OAuth Callback] Gmail email fetched:', gmailEmail);
    } catch (error) {
      console.error('[OAuth Callback] Error fetching Gmail profile:', error);
      // Continue anyway - we can try to get it later
    }

    // Store tokens and email in user metadata (for backward compatibility)
    console.log('[OAuth Callback] Storing tokens in user metadata...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        gmail_token: tokens.access_token,
        gmail_refresh_token: tokens.refresh_token,
        gmail_token_expiry: tokens.expiry_date,
        gmail_email: gmailEmail || user.user_metadata?.gmail_email || '', // Store email if we got it
      },
    });

    if (updateError) {
      console.error('[OAuth Callback] Error updating user:', updateError);
      return res.status(500).json({ error: 'Failed to save Gmail credentials' });
    }
    
    console.log('[OAuth Callback] Tokens stored in user metadata');

    // Also create/update email account in user_email_accounts table
    if (gmailEmail) {
      console.log('[OAuth Callback] Creating email account entry...');
      
      // Check if account already exists
      const { data: existingAccount } = await supabase
        .from('user_email_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('email_address', gmailEmail)
        .eq('account_type', 'google_oauth')
        .single();

      if (existingAccount) {
        // Update existing account
        const { error: updateAccountError } = await supabase
          .from('user_email_accounts')
          .update({
            google_token: tokens.access_token,
            google_refresh_token: tokens.refresh_token,
            google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAccount.id);

        if (updateAccountError) {
          console.warn('[OAuth Callback] Error updating email account:', updateAccountError);
        } else {
          console.log('[OAuth Callback] Email account updated successfully');
        }
      } else {
        // Check if user has any accounts (to determine if this should be default)
        const { count } = await supabase
          .from('user_email_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const isDefault = (count || 0) === 0;

        // Create new account
        const { error: createAccountError } = await supabase
          .from('user_email_accounts')
          .insert({
            user_id: user.id,
            account_type: 'google_oauth',
            email_address: gmailEmail,
            display_name: gmailEmail,
            is_default: isDefault,
            google_token: tokens.access_token,
            google_refresh_token: tokens.refresh_token,
            google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          });

        if (createAccountError) {
          console.warn('[OAuth Callback] Error creating email account:', createAccountError);
        } else {
          console.log('[OAuth Callback] Email account created successfully');
        }
      }
    }
    
    console.log('[OAuth Callback] Tokens stored successfully');
    console.log('[OAuth Callback] Redirecting to /settings?gmail=connected');

    // Redirect to success page - use absolute URL for Vercel
    const frontendUrl = process.env.FRONTEND_URL || 'https://mail-surge.vercel.app';
    return res.redirect(302, `${frontendUrl}/settings?gmail=connected`);
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}



