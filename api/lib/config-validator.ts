/**
 * Configuration validation and helpful error messages
 * Ensures the app is properly configured before use
 */

export interface ConfigStatus {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  emailMethod: 'gmail-oauth' | 'smtp' | 'none' | 'both';
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
  const hasSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  const hasGmailOAuth = !!(
    process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_SECRET && 
    process.env.GOOGLE_REDIRECT_URI
  );

  let emailMethod: 'gmail-oauth' | 'smtp' | 'none' | 'both' = 'none';
  if (hasSMTP && hasGmailOAuth) {
    emailMethod = 'both';
  } else if (hasGmailOAuth) {
    emailMethod = 'gmail-oauth';
  } else if (hasSMTP) {
    emailMethod = 'smtp';
  } else {
    errors.push('No email sending method configured. Set up either SMTP (SMTP_USER, SMTP_PASSWORD) or Gmail OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)');
  }

  // Partial SMTP config warning
  if (process.env.SMTP_USER && !process.env.SMTP_PASSWORD) {
    warnings.push('SMTP_USER is set but SMTP_PASSWORD is missing');
  }
  if (!process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    warnings.push('SMTP_PASSWORD is set but SMTP_USER is missing');
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
      methods.push('Gmail OAuth and SMTP');
    } else if (status.emailMethod === 'gmail-oauth') {
      methods.push('Gmail OAuth');
    } else if (status.emailMethod === 'smtp') {
      methods.push('SMTP');
    }
    return `✅ Configuration valid. Email sending: ${methods.join(' + ')}`;
  }
  
  return `❌ Configuration errors: ${status.errors.join(', ')}`;
}

