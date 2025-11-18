/**
 * Browser-safe Gmail utilities
 * Note: Actual Gmail API calls are made server-side via API routes
 */

export interface GmailCredentials {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

export interface GmailAccount {
  email: string;
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

/**
 * Get all connected Gmail accounts from user metadata
 */
export function getConnectedGmailAccounts(userMetadata: Record<string, unknown>): GmailAccount[] {
  // Check for new array format first
  if (Array.isArray(userMetadata.gmail_accounts) && userMetadata.gmail_accounts.length > 0) {
    // Filter out any accounts without valid emails
    const validAccounts = (userMetadata.gmail_accounts as GmailAccount[]).filter(
      (acc) => acc.email && typeof acc.email === 'string' && acc.email.includes('@')
    );
    return validAccounts;
  }
  
  // Fallback to old single account format for backward compatibility
  if (userMetadata.gmail_token && userMetadata.gmail_refresh_token) {
    const email = userMetadata.gmail_email as string;
    
    // Only return if we have a valid email
    if (email && typeof email === 'string' && email.includes('@')) {
      return [{
        email,
        access_token: userMetadata.gmail_token as string,
        refresh_token: userMetadata.gmail_refresh_token as string,
        expiry_date: userMetadata.gmail_token_expiry as number | undefined,
      }];
    }
  }
  
  return [];
}

/**
 * Generate Google OAuth 2.0 authorization URL (browser-safe)
 * This constructs the URL manually instead of using googleapis library
 */
export function getGmailAuthUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not set');
  }

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

