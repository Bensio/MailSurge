# Database Documentation

## Schema Overview

MailSurge uses PostgreSQL via Supabase with the following tables:

- `campaigns` - Email campaigns
- `contacts` - Recipients for campaigns
- `templates` - Reusable email templates

## Tables

### campaigns

Stores email campaign information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| user_id | UUID | Foreign key to auth.users |
| name | TEXT | Campaign name |
| subject | TEXT | Email subject line |
| body_html | TEXT | HTML email body |
| body_text | TEXT | Plain text email body |
| status | TEXT | Campaign status (draft, sending, paused, completed, failed) |
| settings | JSONB | Campaign settings (delay, ccEmail) |
| created_at | TIMESTAMP | Creation timestamp |
| sent_at | TIMESTAMP | When campaign started sending |
| completed_at | TIMESTAMP | When campaign finished |

**Indexes:**
- `idx_campaigns_user_status` on (user_id, status)
- `idx_campaigns_created_at` on (created_at DESC)

**Constraints:**
- `status` must be one of: draft, sending, paused, completed, failed

### contacts

Stores email recipients for campaigns.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| campaign_id | UUID | Foreign key to campaigns |
| email | TEXT | Recipient email address |
| company | TEXT | Company name |
| custom_fields | JSONB | Additional custom data |
| status | TEXT | Contact status (pending, queued, sent, failed, bounced) |
| sent_at | TIMESTAMP | When email was sent |
| error | TEXT | Error message if sending failed |

**Indexes:**
- `idx_contacts_campaign_status` on (campaign_id, status)
- `idx_contacts_email` on (email)

**Constraints:**
- `status` must be one of: pending, queued, sent, failed, bounced
- Unique constraint on (campaign_id, email) - prevents duplicates

### templates

Stores reusable email templates.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| user_id | UUID | Foreign key to auth.users |
| name | TEXT | Template name |
| subject | TEXT | Email subject line |
| body_html | TEXT | HTML email body |
| body_text | TEXT | Plain text email body |
| thumbnail | TEXT | Template preview image URL |
| usage_count | INTEGER | How many times template was used |
| last_used_at | TIMESTAMP | Last usage timestamp |
| created_at | TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_templates_user` on (user_id)

## Row Level Security (RLS)

All tables have RLS enabled to ensure users can only access their own data.

### Campaigns Policies

- **SELECT**: Users can view their own campaigns
- **INSERT**: Users can create campaigns (user_id auto-set)
- **UPDATE**: Users can update their own campaigns
- **DELETE**: Users can delete their own campaigns

### Contacts Policies

- **SELECT**: Users can view contacts in their own campaigns
- **INSERT**: Users can add contacts to their own campaigns
- **UPDATE**: Users can update contacts in their own campaigns
- **DELETE**: Users can delete contacts from their own campaigns

### Templates Policies

- **SELECT**: Users can view their own templates
- **INSERT**: Users can create templates (user_id auto-set)
- **UPDATE**: Users can update their own templates
- **DELETE**: Users can delete their own templates

## Migration Guide

### Running Migrations

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run

### Adding New Tables

1. Create migration file: `supabase/migrations/002_new_table.sql`
2. Define table with proper indexes
3. Enable RLS: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;`
4. Create policies for SELECT, INSERT, UPDATE, DELETE
5. Run migration in Supabase SQL Editor

### Best Practices

1. **Always use UUIDs** for primary keys (scalability)
2. **Index foreign keys** and frequently queried fields
3. **Use JSONB** for flexible data structures
4. **Enable RLS** on all tables
5. **Add constraints** to validate data integrity
6. **Use CASCADE** for foreign key deletes when appropriate

## Query Examples

### Get user's campaigns with contact counts

```sql
SELECT 
  c.*,
  COUNT(ct.id) as contact_count
FROM campaigns c
LEFT JOIN contacts ct ON ct.campaign_id = c.id
WHERE c.user_id = auth.uid()
GROUP BY c.id
ORDER BY c.created_at DESC;
```

### Get campaign progress

```sql
SELECT 
  status,
  COUNT(*) as count
FROM contacts
WHERE campaign_id = 'campaign-uuid'
GROUP BY status;
```

### Get failed contacts

```sql
SELECT *
FROM contacts
WHERE campaign_id = 'campaign-uuid'
  AND status = 'failed'
ORDER BY sent_at DESC;
```



