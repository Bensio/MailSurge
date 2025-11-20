export type CampaignStatus = 'draft' | 'sending' | 'paused' | 'completed' | 'failed' | 'archived';

export type ContactStatus = 'pending' | 'queued' | 'sent' | 'failed' | 'bounced';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  status: CampaignStatus;
  settings: {
    delay: number;
    ccEmail?: string | null;
  };
  from_email?: string | null;
  design_json?: unknown | null; // Unlayer design JSON for visual editing
  created_at: string;
  sent_at?: string | null;
  completed_at?: string | null;
}

export interface Contact {
  id: string;
  campaign_id: string | null; // Nullable for library contacts
  user_id?: string; // For library contacts
  name?: string | null; // Optional contact name
  email: string;
  company: string;
  custom_fields: Record<string, string>;
  status: ContactStatus;
  sent_at?: string | null;
  error?: string | null;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  thumbnail?: string | null;
  usage_count: number;
  last_used_at?: string | null;
  created_at: string;
}

export interface CampaignWithContacts extends Campaign {
  contacts: Contact[];
}

