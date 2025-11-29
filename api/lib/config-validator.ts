/**
 * Configuration validation and helpful error messages
 * Ensures the app is properly configured before use
 */

export interface ConfigStatus {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  emailMethod: 'gmail-oauth' | 'esp' | 'none' | 'both';
}

/**
 * Validate all required configuration
 */
export function validateConfiguration(): ConfigStatus {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required: Supabase
  if (!process.env.SUPABASE_URL) {
    errors.push('SUPABASE_URL is not set');
  }
  if (!process.env.SUPABASE_SERVICE_KEY) {
    errors.push('SUPABASE_SERVICE_KEY is not set');
  }

  // Email sending methods
  // Note: Email accounts are now user-managed (OAuth + ESP), not admin-configured
  // We only check if Gmail OAuth is available for users to connect
  const hasGmailOAuth = !!(
    process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_SECRET && 
    process.env.GOOGLE_REDIRECT_URI
  );

  let emailMethod: 'gmail-oauth' | 'esp' | 'none' | 'both' = 'none';
  if (hasGmailOAuth) {
    emailMethod = 'gmail-oauth';
    // Note: ESP accounts are user-managed, so we don't check for them here
    // Users can add SendGrid/Postmark/etc. accounts via the UI
  } else {
    warnings.push('Gmail OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI). Users can still add ESP accounts (SendGrid, Postmark, etc.) via Settings.');
  }

  // Partial Gmail OAuth config warnings
  if (process.env.GOOGLE_CLIENT_ID && (!process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI)) {
    warnings.push('GOOGLE_CLIENT_ID is set but Gmail OAuth is incomplete (missing CLIENT_SECRET or REDIRECT_URI)');
  }

  // Optional but recommended
  if (!process.env.TRACKING_BASE_URL && !process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push('TRACKING_BASE_URL or NEXT_PUBLIC_APP_URL not set - email tracking may not work correctly');
  }

  if (!process.env.INNGEST_EVENT_KEY) {
    warnings.push('INNGEST_EVENT_KEY not set - background email sending will not work');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    emailMethod,
  };
}

/**
 * Get user-friendly configuration status message
 */
export function getConfigStatusMessage(status: ConfigStatus): string {
  if (status.isValid) {
    const methods = [];
    if (status.emailMethod === 'both') {
      methods.push('Gmail OAuth and ESP');
    } else if (status.emailMethod === 'gmail-oauth') {
      methods.push('Gmail OAuth (users can also add ESP accounts)');
    } else if (status.emailMethod === 'esp') {
      methods.push('ESP (SendGrid, Postmark, etc.)');
    }
    return `✅ Configuration valid. Email sending: ${methods.join(' + ')}`;
  }
  
  return `❌ Configuration errors: ${status.errors.join(', ')}`;
}

