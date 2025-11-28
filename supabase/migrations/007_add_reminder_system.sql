-- Reminder rules table
CREATE TABLE reminder_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('days_after_campaign', 'days_after_last_email', 'no_response')),
  trigger_value INTEGER NOT NULL, -- Days to wait
  reminder_campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  source_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL, -- Which campaign triggers this
  is_active BOOLEAN DEFAULT true,
  max_reminders INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reminder_rules_user ON reminder_rules(user_id, is_active);
CREATE INDEX idx_reminder_rules_campaign ON reminder_rules(source_campaign_id);

-- Reminder queue (scheduled reminders)
CREATE TABLE reminder_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  reminder_rule_id UUID REFERENCES reminder_rules(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  reminder_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_reminder_queue_scheduled ON reminder_queue(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX idx_reminder_queue_contact ON reminder_queue(contact_id);

-- RLS Policies
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reminder rules" ON reminder_rules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own reminder queue" ON reminder_queue
  FOR ALL USING (auth.uid() = user_id);

