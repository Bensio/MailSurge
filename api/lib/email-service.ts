import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { processEmailImages } from './image-processing';
import { injectTrackingPixel } from './tracking';

/**
 * Unified email sending service
 * Supports both Gmail OAuth API and SMTP
 * Automatically chooses the best available method
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

/**
 * Send email via Gmail API (OAuth)
 */
async function sendEmailViaGmailAPI(
  contact: EmailContact,
  campaign: EmailCampaign,
  oauth2Client: any,
  senderEmail: string,
  trackingToken?: string
): Promise<void> {
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
  
  console.log(`[Gmail API] Email sent successfully to ${contact.email}`);
}

/**
 * Send email via SMTP (Gmail App Password or other SMTP)
 */
async function sendEmailViaSMTP(
  contact: EmailContact,
  campaign: EmailCampaign,
  trackingToken?: string
): Promise<void> {
  // Get SMTP configuration from environment variables
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const senderEmail = process.env.SMTP_FROM_EMAIL || smtpUser;
  const senderName = process.env.SMTP_FROM_NAME || 'MailSurge';

  if (!smtpUser || !smtpPassword) {
    throw new Error(
      'SMTP configuration missing. Please set SMTP_USER and SMTP_PASSWORD environment variables. ' +
      'For Gmail, create an App Password at: https://myaccount.google.com/apppasswords'
    );
  }

  // Personalize email
  let html = campaign.body_html;
  let text = campaign.body_text;
  let subject = campaign.subject;

  // Replace {{company}} with actual company name
  html = html.replace(/\{\{company\}\}/g, contact.company);
  text = text.replace(/\{\{company\}\}/g, contact.company);
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
    console.log(`[SMTP] Injecting tracking pixel with baseUrl: ${baseUrl}, token: ${trackingToken.substring(0, 8)}...`);
    html = injectTrackingPixel(html, trackingToken, baseUrl);
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  // Send email
  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to: contact.email,
    cc: campaign.settings.ccEmail || undefined,
    subject: subject,
    text: text,
    html: html,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[SMTP] Email sent successfully to ${contact.email}`);
}

/**
 * Unified email sending function
 * Tries Gmail OAuth first, falls back to SMTP
 * Includes retry logic and better error handling
 */
export async function sendEmail(
  contact: EmailContact,
  campaign: EmailCampaign,
  options: {
    oauth2Client?: any;
    senderEmail?: string;
    trackingToken?: string;
    retries?: number;
  } = {}
): Promise<void> {
  const { oauth2Client, senderEmail, trackingToken, retries = 1 } = options;
  let lastError: Error | null = null;

  // If Gmail OAuth is available, use it (preferred method)
  if (oauth2Client && senderEmail) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await sendEmailViaGmailAPI(contact, campaign, oauth2Client, senderEmail, trackingToken);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isLastAttempt = attempt === retries - 1;
        
        // Don't retry on authentication errors
        if (error instanceof Error && (
          error.message.includes('invalid_grant') ||
          error.message.includes('unauthorized') ||
          error.message.includes('Invalid Credentials')
        )) {
          console.warn(`[Email Service] Gmail OAuth auth error (not retrying):`, error);
          break; // Break out of retry loop, will fall back to SMTP
        }
        
        if (!isLastAttempt) {
          console.warn(`[Email Service] Gmail API attempt ${attempt + 1} failed, retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        } else {
          console.warn(`[Email Service] Gmail API failed after ${retries} attempts, falling back to SMTP:`, error);
        }
      }
    }
  }

  // Fall back to SMTP
  try {
    await sendEmailViaSMTP(contact, campaign, trackingToken);
  } catch (error) {
    const smtpError = error instanceof Error ? error : new Error(String(error));
    
    // If we tried Gmail OAuth first, include that error in the message
    if (lastError) {
      throw new Error(
        `Email sending failed. Gmail OAuth: ${lastError.message}. SMTP fallback: ${smtpError.message}`
      );
    }
    
    throw smtpError;
  }
}

// Export individual functions for direct use if needed
export { sendEmailViaSMTP, sendEmailViaGmailAPI };
