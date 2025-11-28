import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Schedule reminders for all contacts in a campaign based on a rule
 */
async function scheduleRemindersForRule(ruleId: string, userId: string) {
  const { data: rule } = await supabase
    .from('reminder_rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (!rule || !rule.is_active) return;

  // Get contacts from source campaign
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('campaign_id', rule.source_campaign_id)
    .eq('status', 'sent'); // Only remind contacts who received the email

  if (!contacts || contacts.length === 0) return;

  // Calculate scheduled time based on trigger type
  const scheduledFor = new Date();
  
  if (rule.trigger_type === 'days_after_campaign') {
    // Schedule X days after campaign completion
    scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
  } else if (rule.trigger_type === 'days_after_last_email') {
    // Schedule X days after the last email was sent
    // For now, use campaign completion time + trigger_value
    scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
  } else if (rule.trigger_type === 'no_response') {
    // Schedule X days after campaign if no response
    scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);
  }

  // Create queue entries
  const queueEntries = contacts.map(contact => ({
    user_id: userId,
    contact_id: contact.id,
    reminder_rule_id: ruleId,
    campaign_id: rule.reminder_campaign_id,
    scheduled_for: scheduledFor.toISOString(),
    status: 'pending',
    reminder_count: 0,
  }));

  const { error } = await supabase.from('reminder_queue').insert(queueEntries);
  
  if (error) {
    console.error('Error scheduling reminders:', error);
  } else {
    console.log(`Scheduled ${queueEntries.length} reminders for rule ${ruleId}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // GET /api/reminders/rules - List all reminder rules
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('reminder_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // POST /api/reminders/rules - Create new rule
  if (req.method === 'POST') {
    const { name, trigger_type, trigger_value, reminder_campaign_id, source_campaign_id, max_reminders } = req.body;
    
    // Validate required fields
    if (!name || !trigger_type || !trigger_value || !reminder_campaign_id || !source_campaign_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('reminder_rules')
      .insert({
        user_id: user.id,
        name,
        trigger_type,
        trigger_value,
        reminder_campaign_id,
        source_campaign_id,
        max_reminders: max_reminders || 3,
      })
      .select()
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    
    // Schedule reminders for existing contacts
    await scheduleRemindersForRule(data.id, user.id);
    
    return res.json(data);
  }

  // PUT /api/reminders/rules/:id - Update rule
  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Rule ID required' });
    }

    const { name, trigger_type, trigger_value, reminder_campaign_id, source_campaign_id, is_active, max_reminders } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (trigger_type !== undefined) updateData.trigger_type = trigger_type;
    if (trigger_value !== undefined) updateData.trigger_value = trigger_value;
    if (reminder_campaign_id !== undefined) updateData.reminder_campaign_id = reminder_campaign_id;
    if (source_campaign_id !== undefined) updateData.source_campaign_id = source_campaign_id;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (max_reminders !== undefined) updateData.max_reminders = max_reminders;

    const { data, error } = await supabase
      .from('reminder_rules')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Rule not found' });
    
    return res.json(data);
  }

  // DELETE /api/reminders/rules/:id - Delete rule
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Rule ID required' });
    }

    const { error } = await supabase
      .from('reminder_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) return res.status(500).json({ error: error.message });
    
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

