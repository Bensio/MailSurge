import { randomBytes } from 'crypto';

/**
 * Generate a unique tracking token for email open tracking
 */
export function generateTrackingToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Inject tracking pixel into HTML email
 * This works with any email provider (Gmail, Outlook, etc.)
 * 
 * @param html - Original HTML content
 * @param trackingToken - Unique token for this email
 * @param baseUrl - Base URL of the application (for tracking endpoint)
 * @returns HTML with tracking pixel injected
 */
export function injectTrackingPixel(
  html: string,
  trackingToken: string,
  baseUrl: string = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
): string {
  // Create tracking pixel URL
  const trackingUrl = `${baseUrl}/api/track/open/${trackingToken}`;

  // Create tracking pixel HTML
  const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;

  // Try to inject before closing </body> tag
  if (html.includes('</body>')) {
    return html.replace('</body>', `${trackingPixel}</body>`);
  }

  // If no </body> tag, append to end of HTML
  return html + trackingPixel;
}

/**
 * Provider-agnostic email tracking interface
 * This allows easy extension to other email providers in the future
 */
export interface EmailTrackingConfig {
  enabled: boolean;
  baseUrl?: string;
}

/**
 * Prepare email HTML with tracking (provider-agnostic)
 */
export function prepareEmailWithTracking(
  html: string,
  trackingToken: string,
  config: EmailTrackingConfig
): string {
  if (!config.enabled) {
    return html;
  }

  return injectTrackingPixel(html, trackingToken, config.baseUrl);
}

