import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Tracking pixel endpoint
 * Returns a 1x1 transparent PNG and records the email open
 * This works with any email provider (Gmail, Outlook, etc.)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers to allow email clients to load the image
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token } = req.query;

  if (typeof token !== 'string' || !token) {
    // Return transparent pixel even if token is invalid (to avoid breaking email display)
    console.warn('[Tracking] No token provided');
    return serveTransparentPixel(res);
  }

  console.log(`[Tracking] Received tracking request for token: ${token.substring(0, 8)}...`);

  try {
    // First, check if this is a reminder email (reminder_queue)
    const { data: reminder, error: reminderError } = await supabase
      .from('reminder_queue')
      .select('id, opened_at, open_count, contact_id')
      .eq('tracking_token', token)
      .single();

    if (reminder && !reminderError) {
      // This is a reminder email open
      const now = new Date().toISOString();
      const updateData: {
        open_count: number;
        opened_at?: string;
      } = {
        open_count: (reminder.open_count || 0) + 1,
      };

      // Only set opened_at on first open
      if (!reminder.opened_at) {
        updateData.opened_at = now;
      }

      const { error: updateError } = await supabase
        .from('reminder_queue')
        .update(updateData)
        .eq('id', reminder.id);

      if (updateError) {
        console.error(`[Tracking] Error updating reminder ${reminder.id}:`, updateError);
      } else {
        console.log(`[Tracking] Recorded reminder open for ${reminder.id} (count: ${updateData.open_count})`);
      }

      return serveTransparentPixel(res);
    }

    // If not a reminder, check if it's a campaign email (contacts)
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('id, opened_at, open_count')
      .eq('tracking_token', token)
      .single();

    if (fetchError || !contact) {
      // Token not found in either table, but still return pixel to avoid breaking email
      console.warn(`[Tracking] Token not found in contacts table: ${token.substring(0, 8)}...`, fetchError?.message || 'No contact found');
      return serveTransparentPixel(res);
    }

    console.log(`[Tracking] Found contact ${contact.id} for token ${token.substring(0, 8)}...`);

    // Record the campaign email open
    const now = new Date().toISOString();
    const updateData: {
      open_count: number;
      opened_at?: string;
    } = {
      open_count: (contact.open_count || 0) + 1,
    };

    // Only set opened_at on first open
    if (!contact.opened_at) {
      updateData.opened_at = now;
    }

    const { error: updateError } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contact.id);

    if (updateError) {
      console.error(`[Tracking] Error updating contact ${contact.id}:`, updateError);
    } else {
      console.log(`[Tracking] Recorded campaign open for contact ${contact.id} (count: ${updateData.open_count})`);
    }

    // Return transparent pixel
    return serveTransparentPixel(res);
  } catch (error) {
    console.error('[Tracking] Unexpected error:', error);
    // Still return pixel to avoid breaking email display
    return serveTransparentPixel(res);
  }
}

/**
 * Serve a 1x1 transparent PNG pixel
 */
function serveTransparentPixel(res: VercelResponse) {
  // 1x1 transparent PNG (base64 encoded)
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Length', pixel.length.toString());
  
  return res.send(pixel);
}

