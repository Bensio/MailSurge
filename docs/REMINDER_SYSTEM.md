# Reminder System Documentation

## How Reminders Work Synchronously with Campaigns

### Overview
The reminder system automatically schedules follow-up emails when campaigns complete. Here's the flow:

### 1. Campaign Completion Triggers Reminder Scheduling

When a campaign finishes sending (status becomes `completed`), the system:

1. **Checks for Active Reminder Rules** (in `api/inngest.ts` lines 343-403):
   - Finds all reminder rules where `source_campaign_id` matches the completed campaign
   - Only processes rules where `is_active = true`

2. **Schedules Reminders for Each Rule**:
   - Gets all contacts from the source campaign with `status = 'sent'`
   - Calculates scheduled time based on trigger type:
     - `days_after_campaign`: X days after campaign completion
     - `days_after_last_email`: X days after last email sent
     - `no_response`: X days after campaign if no response
   - Creates entries in `reminder_queue` table with `status = 'pending'`

3. **Example Flow**:
   ```
   Campaign "Q1 Outreach" completes on Jan 1
   → Rule: "Follow up after 7 days" (trigger_type: days_after_campaign, trigger_value: 7)
   → Creates reminder_queue entries scheduled for Jan 8
   → Each contact gets a reminder entry
   ```

### 2. Reminder Processing (Cron Job)

The `processReminders` function runs **every 15 minutes** (cron: `*/15 * * * *`):

1. **Fetches Due Reminders**:
   - Gets reminders from `reminder_queue` where:
     - `status = 'pending'`
     - `scheduled_for <= now()`
   - Processes up to 50 at a time

2. **Sends Reminder Emails**:
   - Uses the `reminder_campaign_id` to get email content (subject, body_html, body_text)
   - Sends email using the same `sendEmail` function as regular campaigns
   - Updates `reminder_queue` status to `'sent'`
   - Increments `reminder_count`

3. **Error Handling**:
   - If sending fails, updates status to `'failed'`
   - Respects `max_reminders` limit per rule

## What Reminder Emails Say

### Content Source
Reminder emails use the content from the **reminder campaign** (not the source campaign):

- **Subject**: From `reminder_campaign_id.subject`
- **Body HTML**: From `reminder_campaign_id.body_html`
- **Body Text**: From `reminder_campaign_id.body_text`

### Personalization
Reminder emails support the same personalization as regular campaigns:
- `{{company}}` is replaced with the contact's company name
- All other template variables work the same way

### Example
If you have:
- **Source Campaign**: "Q1 Outreach" (initial email)
- **Reminder Campaign**: "Q1 Follow-up" (reminder email)

The reminder will use the content from "Q1 Follow-up", not "Q1 Outreach".

## Tracking: Campaign vs Reminder Emails

### Current Implementation (Issue)

**Problem**: Currently, there's **no way to distinguish** between:
- Opens from the original campaign email
- Opens from reminder emails

Both use the same `tracking_token` field on the `contacts` table, so:
- If a contact opens the campaign email → `opened_at` and `open_count` are set
- If they later open a reminder email → The same fields are updated (overwriting or incrementing)
- **You can't tell which email was opened**

### How Tracking Currently Works

1. **Campaign Emails**:
   - Generate unique `tracking_token` per contact
   - Store in `contacts.tracking_token`
   - Inject tracking pixel: `/api/track/open/[token]`

2. **Reminder Emails**:
   - **Currently overwrites** the same `tracking_token` field (line 545 in `api/inngest.ts`)
   - Uses the same tracking endpoint
   - **Cannot distinguish from campaign opens**

### Recommended Solution

To properly track campaign vs reminder opens, we need to:

#### Option 1: Add `email_type` to Tracking (Recommended)

1. **Modify `reminder_queue` table**:
   ```sql
   ALTER TABLE reminder_queue 
   ADD COLUMN tracking_token UUID;
   ```

2. **Store separate tracking tokens**:
   - Campaign emails: `contacts.tracking_token`
   - Reminder emails: `reminder_queue.tracking_token`

3. **Update tracking endpoint** to check both:
   ```typescript
   // Check contacts table (campaign emails)
   // Check reminder_queue table (reminder emails)
   ```

4. **Add tracking fields to reminder_queue**:
   ```sql
   ALTER TABLE reminder_queue
   ADD COLUMN opened_at TIMESTAMP WITH TIME ZONE,
   ADD COLUMN open_count INTEGER DEFAULT 0;
   ```

#### Option 2: Add `email_sends` Table (More Comprehensive)

Create a new table to track all email sends:
```sql
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id),
  campaign_id UUID REFERENCES campaigns(id),
  reminder_queue_id UUID REFERENCES reminder_queue(id),
  email_type TEXT CHECK (email_type IN ('campaign', 'reminder')),
  tracking_token TEXT UNIQUE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  open_count INTEGER DEFAULT 0
);
```

This allows:
- Tracking all emails (campaign + reminders)
- Distinguishing between email types
- Historical tracking of all opens

## Next Steps

### Immediate Fixes Needed

1. **Fix Reminder Tracking**:
   - Don't overwrite `contacts.tracking_token` when sending reminders
   - Store reminder tracking tokens separately
   - Update tracking endpoint to handle both

2. **UI Improvements**:
   - Show reminder opens separately from campaign opens
   - Display reminder status in campaign detail page
   - Add reminder analytics

3. **Database Schema**:
   - Add tracking fields to `reminder_queue`
   - Or implement `email_sends` table for comprehensive tracking

### Future Enhancements

1. **Reminder Analytics**:
   - Open rates by reminder number (1st, 2nd, 3rd)
   - Response rates after reminders
   - Best time to send reminders

2. **Smart Reminders**:
   - Skip reminders if contact already opened/responded
   - Adjust reminder timing based on open patterns
   - Auto-pause reminders if contact unsubscribes

3. **Reminder Templates**:
   - Pre-built reminder email templates
   - A/B testing for reminder content
   - Personalization based on previous interactions

## Current Status

✅ **Working**:
- Reminder rules creation and management
- Automatic scheduling when campaigns complete
- Reminder email sending via cron job
- Basic tracking (but can't distinguish campaign vs reminder)

❌ **Missing**:
- Separate tracking for reminder emails
- UI to view reminder opens separately
- Analytics for reminder performance
- Smart reminder logic (skip if already opened)

