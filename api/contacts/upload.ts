import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ContactsUploadSchema } from '../../src/lib/validations';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { campaign_id, contacts } = req.body;

    // campaign_id is optional - if provided, verify it exists and belongs to user
    if (campaign_id) {
      if (typeof campaign_id !== 'string') {
        return res.status(400).json({ error: 'Invalid campaign_id' });
      }

      // Verify campaign belongs to user
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', campaign_id)
        .eq('user_id', user.id)
        .single();

      if (campaignError || !campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
    }

    // Validate contacts
    const validation = ContactsUploadSchema.safeParse(contacts);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    // Insert contacts (ignore duplicates due to unique constraint)
    const contactsToInsert = validation.data.map((contact) => ({
      user_id: user.id,
      campaign_id: campaign_id || null, // null for library contacts
      email: contact.email,
      company: contact.company,
      custom_fields: contact.custom_fields || {},
      status: 'pending',
    }));

    const { data: insertedContacts, error: insertError } = await supabase
      .from('contacts')
      .insert(contactsToInsert)
      .select();

    if (insertError) {
      // Check if it's a duplicate error
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'Some contacts already exist in this campaign' });
      }
      console.error('Database error:', insertError);
      return res.status(500).json({ error: 'Failed to upload contacts' });
    }

    return res.status(201).json({
      message: 'Contacts uploaded successfully',
      count: insertedContacts?.length || 0,
      contacts: insertedContacts,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

