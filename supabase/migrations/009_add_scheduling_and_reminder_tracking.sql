-- Add scheduling support to campaigns
ALTER TABLE campaigns
ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Add tracking fields to reminder_queue
ALTER TABLE reminder_queue
ADD COLUMN tracking_token TEXT,
ADD COLUMN opened_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN open_count INTEGER DEFAULT 0;

CREATE INDEX idx_reminder_queue_tracking ON reminder_queue(tracking_token) WHERE tracking_token IS NOT NULL;
CREATE INDEX idx_reminder_queue_opened ON reminder_queue(opened_at) WHERE opened_at IS NOT NULL;

-- Add email_type to distinguish campaign vs reminder in tracking
-- We'll use this in the tracking endpoint logic

