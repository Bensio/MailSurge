import { google } from 'googleapis';
import { processEmailImages } from './image-processing';
import { injectTrackingPixel } from './tracking';
import { decrypt } from './encryption';

/**
 * Unified email sending service
 * Supports Google OAuth, Microsoft OAuth, and ESP (SendGrid/Postmark/etc.)
 */

export interface EmailContact {
  email: string;
  company: string;
  id: string;
}

export interface EmailCampaign {
  subject: string;
  body_html: string;
  body_text: string;
  settings: { delay?: number; ccEmail?: string | null };
}

export interface UserEmailAccount {
  id: string;
  account_type: 'google_oauth' | 'microsoft_oauth' | 'esp_domain';
  email_address: string;
  display_name?: string;
  // Google OAuth
  google_token?: string;
  google_refresh_token?: string;
  google_token_expiry?: string;
  // Microsoft OAuth
  microsoft_token?: string;
  microsoft_refresh_token?: string;
  microsoft_token_expiry?: string;
  // ESP
  esp_provider?: 'sendgrid' | 'postmark' | 'ses' | 'mailgun';
  esp_api_key_encrypted?: string;
  domain_name?: string;
}

/**
 * Send email via Google Gmail API (OAuth)
 */
async function sendEmailViaGoogleOAuth(
  contact: EmailContact,
  campaign: EmailCampaign,
  account: UserEmailAccount,
  trackingToken?: string
): Promise<void> {
  if (!account.google_token || !account.google_refresh_token) {
    throw new Error('Google OAuth tokens not found for account');
  }

  // Set up OAuth client
  let redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
  if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
    redirectUri = `https://${redirectUri}`;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  oauth2Client.setCredentials({
    access_token: account.google_token,
    refresh_token: account.google_refresh_token,
  });

  const senderEmail = account.email_address;
  // Personalize email
  let html = campaign.body_html;
  let subject = campaign.subject;

  // Replace {{company}} with actual company name
  html = html.replace(/\{\{company\}\}/g, contact.company);
  subject = subject.replace(/\{\{company\}\}/g, contact.company);

  // Process images to ensure all use absolute URLs
  let baseUrl = process.env.TRACKING_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'https://mailsurge.vercel.app';
    }
  }
  baseUrl = baseUrl.replace(/\/$/, '');
  
  // Process images to convert relative URLs to absolute
  html = processEmailImages(html, baseUrl);

  // Inject tracking pixel if tracking token is provided
  if (trackingToken) {
    console.log(`[Gmail API] Injecting tracking pixel with baseUrl: ${baseUrl}, token: ${trackingToken.substring(0, 8)}...`);
    html = injectTrackingPixel(html, trackingToken, baseUrl);
  }

  // Create email
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Create email with proper headers
  const emailLines = [
    `From: ${senderEmail}`,
    `To: ${contact.email}`,
  ];
  
  if (campaign.settings.ccEmail) {
    emailLines.push(`Cc: ${campaign.settings.ccEmail}`);
  }
  
  emailLines.push(
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    html
  );

  const email = emailLines.join('\r\n');

  // Encode to base64url format (Gmail API requirement)
  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
    },
  });
  
  console.log(`[Google OAuth] Email sent successfully to ${contact.email} from ${senderEmail}`);
}

/**
 * Send email via Microsoft Graph API (OAuth)
 */
async function sendEmailViaMicrosoftOAuth(
  contact: EmailContact,
  campaign: EmailCampaign,
  account: UserEmailAccount,
  trackingToken?: string
): Promise<void> {
  if (!account.microsoft_token || !account.microsoft_refresh_token) {
    throw new Error('Microsoft OAuth tokens not found for account');
  }

  // Personalize email
  let html = campaign.body_html;
  let text = campaign.body_text;
  let subject = campaign.subject;

  html = html.replace(/\{\{company\}\}/g, contact.company);
  text = text.replace(/\{\{company\}\}/g, contact.company);
  subject = subject.replace(/\{\{company\}\}/g, contact.company);

  // Process images
  let baseUrl = process.env.TRACKING_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'https://mailsurge.vercel.app';
    }
  }
  baseUrl = baseUrl.replace(/\/$/, '');
  
  html = processEmailImages(html, baseUrl);

  if (trackingToken) {
    html = injectTrackingPixel(html, trackingToken, baseUrl);
  }

  // TODO: Implement Microsoft Graph API sending
  // For now, throw error to indicate not yet implemented
  throw new Error('Microsoft OAuth email sending not yet implemented');
}

/**
 * Send email via ESP (SendGrid, Postmark, etc.)
 */
async function sendEmailViaESP(
  contact: EmailContact,
  campaign: EmailCampaign,
  account: UserEmailAccount,
  trackingToken?: string
): Promise<void> {
  if (!account.esp_provider || !account.esp_api_key_encrypted) {
    throw new Error('ESP configuration missing for account');
  }

  // Decrypt API key
  const apiKey = decrypt(account.esp_api_key_encrypted);
  const senderEmail = account.email_address;
  const senderName = account.display_name || 'MailSurge';

  // Personalize email
  let html = campaign.body_html;
  let text = campaign.body_text;
  let subject = campaign.subject;

  html = html.replace(/\{\{company\}\}/g, contact.company);
  text = text.replace(/\{\{company\}\}/g, contact.company);
  subject = subject.replace(/\{\{company\}\}/g, contact.company);

  // Process images
  let baseUrl = process.env.TRACKING_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'https://mailsurge.vercel.app';
    }
  }
  baseUrl = baseUrl.replace(/\/$/, '');
  
  html = processEmailImages(html, baseUrl);

  if (trackingToken) {
    html = injectTrackingPixel(html, trackingToken, baseUrl);
  }

  // Send via ESP API
  if (account.esp_provider === 'sendgrid') {
    await sendViaSendGrid(apiKey, senderEmail, senderName, contact, subject, html, text, campaign);
  } else {
    throw new Error(`ESP provider ${account.esp_provider} not yet implemented`);
  }
}

/**
 * Send email via SendGrid API
 */
async function sendViaSendGrid(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  contact: EmailContact,
  subject: string,
  html: string,
  text: string,
  campaign: EmailCampaign
): Promise<void> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: contact.email }],
        ...(campaign.settings.ccEmail ? { cc: [{ email: campaign.settings.ccEmail }] } : {}),
      }],
      from: {
        email: senderEmail,
        name: senderName,
      },
      subject: subject,
      content: [
        {
          type: 'text/plain',
          value: text,
        },
        {
          type: 'text/html',
          value: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${response.status} ${errorText}`);
  }

  console.log(`[SendGrid] Email sent successfully to ${contact.email} from ${senderEmail}`);
}

/**
 * Unified email sending function
 * Supports Google OAuth, Microsoft OAuth, and ESP providers
 */
export async function sendEmail(
  contact: EmailContact,
  campaign: EmailCampaign,
  account: UserEmailAccount,
  options: {
    trackingToken?: string;
    retries?: number;
  } = {}
): Promise<void> {
  const { trackingToken, retries = 1 } = options;

  // Route to appropriate sending method based on account type
  switch (account.account_type) {
    case 'google_oauth':
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          await sendEmailViaGoogleOAuth(contact, campaign, account, trackingToken);
          return;
        } catch (error) {
          const isLastAttempt = attempt === retries - 1;
          
          // Don't retry on authentication errors
          if (error instanceof Error && (
            error.message.includes('invalid_grant') ||
            error.message.includes('unauthorized') ||
            error.message.includes('Invalid Credentials')
          )) {
            throw error; // Throw immediately for auth errors
          }
          
          if (!isLastAttempt) {
            console.warn(`[Email Service] Google OAuth attempt ${attempt + 1} failed, retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          } else {
            throw error;
          }
        }
      }
      break;

    case 'microsoft_oauth':
      await sendEmailViaMicrosoftOAuth(contact, campaign, account, trackingToken);
      break;

    case 'esp_domain':
      await sendEmailViaESP(contact, campaign, account, trackingToken);
      break;

    default:
      throw new Error(`Unsupported account type: ${account.account_type}`);
  }
}
