# Development Next Steps: Lead Reminders & Appointment Booking

## 🎯 Quick Start: What to Build First

### **Priority 1: Lead Reminder System** (Start Here)
More valuable, easier to implement, builds on existing infrastructure.

---

## 📋 Step-by-Step Development Plan

### **PHASE 1: Database Setup (Day 1)**

#### **1.1 Create Migration File**
Create: `supabase/migrations/007_add_reminder_system.sql`

```sql
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
```

**Action:** Run this migration in Supabase SQL Editor.

---

### **PHASE 2: Backend API (Days 2-3)**

#### **2.1 Create Reminder Rules API**
Create: `api/reminders/rules.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/reminders/rules - List all reminder rules
// POST /api/reminders/rules - Create new rule
// PUT /api/reminders/rules/:id - Update rule
// DELETE /api/reminders/rules/:id - Delete rule

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('reminder_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { name, trigger_type, trigger_value, reminder_campaign_id, source_campaign_id, max_reminders } = req.body;
    
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

  // PUT and DELETE handlers...
}
```

#### **2.2 Create Reminder Queue Processor**
Create: `api/inngest-reminders.ts`

```typescript
import { Inngest } from 'inngest';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const inngest = new Inngest({ id: 'mailsurge-reminders' });

// Function to process pending reminders
export const processReminders = inngest.createFunction(
  { id: 'process-reminders', name: 'Process Reminder Queue' },
  { cron: '*/15 * * * *' }, // Run every 15 minutes
  async ({ step }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get pending reminders due now
    const { data: reminders, error } = await supabase
      .from('reminder_queue')
      .select('*, reminder_rules(*), contacts(*), campaigns(*)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50); // Process 50 at a time

    if (error || !reminders) return;

    for (const reminder of reminders) {
      await step.run(`send-reminder-${reminder.id}`, async () => {
        // Get user's Gmail tokens
        const { data: user } = await supabase.auth.admin.getUserById(reminder.user_id);
        const accessToken = user?.user_metadata?.gmail_token;
        const refreshToken = user?.user_metadata?.gmail_refresh_token;

        if (!accessToken || !refreshToken) {
          await supabase
            .from('reminder_queue')
            .update({ status: 'failed' })
            .eq('id', reminder.id);
          return;
        }

        // Send reminder email (reuse existing sendEmail function)
        // ... send email logic ...

        // Update queue status
        await supabase
          .from('reminder_queue')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            reminder_count: reminder.reminder_count + 1
          })
          .eq('id', reminder.id);
      });
    }
  }
);
```

#### **2.3 Helper Function: Schedule Reminders**
Add to `api/reminders/rules.ts`:

```typescript
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

  if (!contacts) return;

  // Calculate scheduled time
  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + rule.trigger_value);

  // Create queue entries
  const queueEntries = contacts.map(contact => ({
    user_id: userId,
    contact_id: contact.id,
    reminder_rule_id: ruleId,
    campaign_id: rule.source_campaign_id,
    scheduled_for: scheduledFor.toISOString(),
    status: 'pending',
    reminder_count: 0,
  }));

  await supabase.from('reminder_queue').insert(queueEntries);
}
```

**Action:** 
1. Create these API files
2. Add reminder processing to existing Inngest setup
3. Test with Postman/curl

---

### **PHASE 3: Frontend UI (Days 4-6)**

#### **3.1 Create Reminder Rules Page**
Create: `src/pages/Reminders.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Clock, Mail } from 'lucide-react';

interface ReminderRule {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: number;
  reminder_campaign_id: string;
  is_active: boolean;
  max_reminders: number;
}

export function Reminders() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    if (!user) return;
    
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch('/api/reminders/rules', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setRules(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reminder Rules</h1>
          <p className="text-muted-foreground">Automate follow-up emails to your leads</p>
        </div>
        <Button onClick={() => navigate('/reminders/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Reminder Rule
        </Button>
      </div>

      {rules.map(rule => (
        <Card key={rule.id}>
          <CardHeader>
            <CardTitle>{rule.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Clock className="h-4 w-4" />
              <span>Send {rule.trigger_value} days after campaign</span>
              {rule.is_active ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-gray-400">Inactive</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

#### **3.2 Create New Reminder Rule Form**
Create: `src/pages/NewReminder.tsx`

```typescript
// Form to create reminder rule:
// - Name
// - Source campaign (which campaign triggers reminders)
// - Reminder campaign (which email to send)
// - Trigger: days after campaign (e.g., 3, 7, 14)
// - Max reminders (stop after X reminders)
```

#### **3.3 Add to Navigation**
Update: `src/components/layout/Sidebar.tsx`

```typescript
import { Clock } from 'lucide-react';

const navItems = [
  // ... existing items
  { path: '/reminders', label: 'Reminders', icon: Clock },
];
```

Update: `src/App.tsx` - Add routes:

```typescript
import { BookAppointment } from '@/pages/BookAppointment';

// Add public route (no auth required)
<Route path="/book/:token" element={<BookAppointment />} />

// Add protected route
<Route
  path="/appointments"
  element={
    <ProtectedRoute>
      <AppLayout>
        <Appointments />
      </AppLayout>
    </ProtectedRoute>
  }
/>
```

**Action:**
1. Create these React components
2. Add routing
3. Test UI flow

---

### **PHASE 4: Campaign Integration (Day 7)**

#### **4.1 Auto-Schedule Reminders When Campaign Completes**
Update: `api/inngest.ts` - After campaign sending completes:

```typescript
// After campaign emails are sent, check for reminder rules
const { data: rules } = await supabase
  .from('reminder_rules')
  .select('*')
  .eq('source_campaign_id', campaignId)
  .eq('is_active', true);

for (const rule of rules) {
  await scheduleRemindersForRule(rule.id, userId);
}
```

**Action:** Add this logic to existing campaign completion handler.

---

## 🚀 Quick Implementation Checklist

### **Week 1: Reminder System MVP**
- [ ] Day 1: Run database migration
- [ ] Day 2: Create reminder rules API
- [ ] Day 3: Create Inngest reminder processor
- [ ] Day 4: Build Reminders page UI
- [ ] Day 5: Build New Reminder form
- [ ] Day 6: Integrate with campaigns
- [ ] Day 7: Test end-to-end flow

### **Week 2: Appointment Booking with Google Calendar**
- [ ] Day 1: Add Calendar scope to OAuth + Enable Calendar API + Create appointment tables migration
- [ ] Day 2: Create calendar utility functions + Set up Google Calendar API integration
- [ ] Day 3: Create booking API endpoints + Calendar event creation + Availability API
- [ ] Day 4: Build public booking page with availability + Add route `/book/:token`
- [ ] Day 5: Build appointment settings UI + Create booking link generation
- [ ] Day 6: Add booking button to email editor + Generate booking links
- [ ] Day 7: Test full booking flow with Calendar sync + Send confirmation emails

---

## 📅 PHASE 5: Google Calendar Integration for Appointments (Week 2)

### **Step 1: Add Calendar Scope to OAuth (Day 1)**

#### **1.1 Update OAuth Scopes**
Update: `src/lib/gmail.ts`

```typescript
export function getGmailAuthUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not set');
  }

  // ADD CALENDAR SCOPE HERE
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar', // NEW: Calendar read/write
    'https://www.googleapis.com/auth/calendar.events', // NEW: Calendar events
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return authUrl;
}
```

#### **1.2 Update Google Cloud Console**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services** → **OAuth consent screen**
3. Click **Add or Remove Scopes**
4. Add these scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
5. Click **Update** → **Save and Continue**

#### **1.3 Enable Calendar API**
1. **APIs & Services** → **Library**
2. Search "Google Calendar API"
3. Click **Enable**

**Action:** Users will need to re-authenticate to grant calendar permissions.

#### **1.4 Update OAuth Callback Handler**
Update: `api/auth/callback.ts` - Ensure calendar tokens are saved:

```typescript
// The existing callback should already save tokens to user_metadata
// Just verify it includes calendar scope in the token response
// Calendar access uses the same OAuth tokens as Gmail
```

---

### **Step 2: Database Schema for Appointments (Day 1)**

Create: `supabase/migrations/008_add_appointments.sql`

```sql
-- Appointment settings (one per user)
CREATE TABLE appointment_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  calendar_id TEXT, -- Google Calendar ID (usually 'primary')
  calendar_email TEXT, -- Calendar email address
  working_hours JSONB DEFAULT '{
    "monday": {"start": "09:00", "end": "17:00", "enabled": true},
    "tuesday": {"start": "09:00", "end": "17:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "17:00", "enabled": true},
    "thursday": {"start": "09:00", "end": "17:00", "enabled": true},
    "friday": {"start": "09:00", "end": "17:00", "enabled": true},
    "saturday": {"enabled": false},
    "sunday": {"enabled": false}
  }'::jsonb,
  appointment_duration INTEGER DEFAULT 30, -- Minutes
  buffer_time INTEGER DEFAULT 15, -- Minutes between appointments
  timezone TEXT DEFAULT 'UTC',
  booking_advance_days INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_appointment_settings_user ON appointment_settings(user_id);

-- Appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')),
  calendar_event_id TEXT, -- Google Calendar event ID
  meeting_link TEXT, -- Zoom, Google Meet, etc.
  notes TEXT,
  reminder_sent_24h BOOLEAN DEFAULT false,
  reminder_sent_1h BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_appointments_user ON appointments(user_id);
CREATE INDEX idx_appointments_contact ON appointments(contact_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time, status);
CREATE INDEX idx_appointments_status ON appointments(user_id, status);

-- Booking links (unique tokens for public booking)
CREATE TABLE booking_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL, -- Unique token for booking URL
  expires_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_booking_links_token ON booking_links(token);
CREATE INDEX idx_booking_links_contact ON booking_links(contact_id);
CREATE INDEX idx_booking_links_user ON booking_links(user_id);

-- RLS Policies
ALTER TABLE appointment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own appointment settings" ON appointment_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own appointments" ON appointments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own booking links" ON booking_links
  FOR ALL USING (auth.uid() = user_id);
```

**Action:** Run this migration in Supabase SQL Editor.

---

### **Step 3: Google Calendar API Integration (Day 2)**

#### **3.1 Create Calendar Utility**
Create: `src/lib/calendar.ts`

```typescript
import { google } from 'googleapis';

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string }>;
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: 'hangoutsMeet' };
    };
  };
}

/**
 * Get Google Calendar client with OAuth
 */
export function getCalendarClient(accessToken: string, refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  calendarId: string,
  event: CalendarEvent
): Promise<string> {
  const calendar = getCalendarClient(accessToken, refreshToken);
  
  const response = await calendar.events.insert({
    calendarId: calendarId || 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      attendees: event.attendees,
      conferenceData: event.conferenceData, // For Google Meet links
    },
    conferenceDataVersion: 1, // Enable Google Meet
  });

  return response.data.id || '';
}

/**
 * Get available time slots
 */
export async function getAvailableTimeSlots(
  accessToken: string,
  refreshToken: string,
  calendarId: string,
  startDate: Date,
  endDate: Date,
  durationMinutes: number
): Promise<Array<{ start: Date; end: Date }>> {
  const calendar = getCalendarClient(accessToken, refreshToken);
  
  // Get existing events in the time range
  const response = await calendar.events.list({
    calendarId: calendarId || 'primary',
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const busySlots = (response.data.items || []).map(event => ({
    start: new Date(event.start?.dateTime || event.start?.date || ''),
    end: new Date(event.end?.dateTime || event.end?.date || ''),
  }));

  // Generate available slots (simplified - check against busy slots)
  const availableSlots: Array<{ start: Date; end: Date }> = [];
  const current = new Date(startDate);
  
  while (current < endDate) {
    const slotEnd = new Date(current.getTime() + durationMinutes * 60000);
    
    // Check if slot conflicts with busy times
    const isBusy = busySlots.some(busy => 
      (current >= busy.start && current < busy.end) ||
      (slotEnd > busy.start && slotEnd <= busy.end) ||
      (current <= busy.start && slotEnd >= busy.end)
    );

    if (!isBusy) {
      availableSlots.push({ start: new Date(current), end: new Date(slotEnd) });
    }

    // Move to next 30-minute slot
    current.setMinutes(current.getMinutes() + 30);
  }

  return availableSlots;
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient(accessToken, refreshToken);
  
  await calendar.events.delete({
    calendarId: calendarId || 'primary',
    eventId: eventId,
  });
}
```

#### **3.2 Create Appointment API**
Create: `api/appointments/index.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createCalendarEvent, getAvailableTimeSlots } from '@/lib/calendar';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/appointments - List appointments
// POST /api/appointments - Create appointment
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const { start, end } = req.query;
    
    let query = supabase
      .from('appointments')
      .select('*, contacts(*), campaigns(*)')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true });

    if (start) query = query.gte('start_time', start as string);
    if (end) query = query.lte('start_time', end as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { contact_id, campaign_id, title, description, start_time, end_time, timezone } = req.body;

    // Get user's Gmail tokens
    const accessToken = user.user_metadata?.gmail_token;
    const refreshToken = user.user_metadata?.gmail_refresh_token;

    if (!accessToken || !refreshToken) {
      return res.status(400).json({ error: 'Google Calendar not connected' });
    }

    // Get appointment settings
    const { data: settings } = await supabase
      .from('appointment_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const calendarId = settings?.calendar_id || 'primary';

    // Create calendar event
    let calendarEventId: string | null = null;
    try {
      calendarEventId = await createCalendarEvent(
        accessToken,
        refreshToken,
        calendarId,
        {
          summary: title,
          description: description || '',
          start: {
            dateTime: start_time,
            timeZone: timezone || 'UTC',
          },
          end: {
            dateTime: end_time,
            timeZone: timezone || 'UTC',
          },
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }
      );
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return res.status(500).json({ error: 'Failed to create calendar event' });
    }

    // Get contact email for attendee
    const { data: contact } = await supabase
      .from('contacts')
      .select('email')
      .eq('id', contact_id)
      .single();

    // Create appointment record
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        user_id: user.id,
        contact_id,
        campaign_id: campaign_id || null,
        title,
        description,
        start_time,
        end_time,
        timezone: timezone || 'UTC',
        calendar_event_id: calendarEventId,
        status: 'scheduled',
      })
      .select()
      .single();

    if (insertError) {
      // Rollback: delete calendar event if appointment creation fails
      if (calendarEventId) {
        try {
          await deleteCalendarEvent(accessToken, refreshToken, calendarId, calendarEventId);
        } catch (e) {
          console.error('Error deleting calendar event:', e);
        }
      }
      return res.status(500).json({ error: insertError.message });
    }

    return res.json(appointment);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

#### **3.3 Create Availability API**
Create: `api/appointments/availability.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getAvailableTimeSlots } from '@/lib/calendar';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/appointments/availability?start=2024-01-01&end=2024-01-31&duration=30
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { start, end, duration } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end dates required' });
  }

  // Get appointment settings
  const { data: settings } = await supabase
    .from('appointment_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!settings) {
    return res.status(404).json({ error: 'Appointment settings not found' });
  }

  // Get user's Gmail tokens
  const accessToken = user.user_metadata?.gmail_token;
  const refreshToken = user.user_metadata?.gmail_refresh_token;

  if (!accessToken || !refreshToken) {
    return res.status(400).json({ error: 'Google Calendar not connected' });
  }

  const durationMinutes = parseInt(duration as string) || settings.appointment_duration || 30;
  const startDate = new Date(start as string);
  const endDate = new Date(end as string);

  try {
    const slots = await getAvailableTimeSlots(
      accessToken,
      refreshToken,
      settings.calendar_id || 'primary',
      startDate,
      endDate,
      durationMinutes
    );

    // Filter by working hours
    const filteredSlots = slots.filter(slot => {
      const dayOfWeek = slot.start.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      const daySettings = settings.working_hours[dayName];

      if (!daySettings?.enabled) return false;

      const slotHour = slot.start.getHours();
      const slotMinute = slot.start.getMinutes();
      const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`;

      return slotTime >= daySettings.start && slotTime <= daySettings.end;
    });

    return res.json({ slots: filteredSlots });
  } catch (error) {
    console.error('Error getting availability:', error);
    return res.status(500).json({ error: 'Failed to get availability' });
  }
}
```

---

### **Step 4: Booking Page (Day 4)**

#### **4.1 Create Public Booking Page**
Create: `src/pages/BookAppointment.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock } from 'lucide-react';

export function BookAppointment() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [availableSlots, setAvailableSlots] = useState<Array<{ start: Date; end: Date }>>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchAvailability();
  }, [token]);

  const fetchAvailability = async () => {
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30); // Next 30 days

      const response = await fetch(
        `/api/booking-links/${token}/availability?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      const data = await response.json();
      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot || !name || !email || !company || !token) return;

    setBooking(true);
    try {
      const endTime = new Date(selectedSlot);
      endTime.setMinutes(endTime.getMinutes() + 30); // 30 min default

      const response = await fetch(`/api/booking-links/${token}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          start_time: selectedSlot.toISOString(),
          end_time: endTime.toISOString(),
        }),
      });

      if (response.ok) {
        alert('Appointment booked successfully! Check your email for confirmation.');
        navigate('/');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error booking:', error);
      alert('Failed to book appointment');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Book an Appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contact Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          </div>

          {/* Available Slots */}
          <div>
            <Label>Select a Time</Label>
            {loading ? (
              <div>Loading available times...</div>
            ) : availableSlots.length === 0 ? (
              <div>No available times in the next 30 days</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto">
                {availableSlots.map((slot, idx) => (
                  <Button
                    key={idx}
                    variant={selectedSlot?.getTime() === slot.start.getTime() ? 'default' : 'outline'}
                    onClick={() => setSelectedSlot(slot.start)}
                    className="justify-start"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {slot.start.toLocaleString()}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleBook}
            disabled={!selectedSlot || !name || !email || !company || booking}
            className="w-full"
          >
            {booking ? 'Booking...' : 'Book Appointment'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### **4.2 Create Booking Link API**
Create: `api/booking-links/[token]/book.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createCalendarEvent } from '@/lib/calendar';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/booking-links/:token/book
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  const { name, email, company, start_time, end_time } = req.body;

  // Get booking link
  const { data: bookingLink, error: linkError } = await supabase
    .from('booking_links')
    .select('*, user:users(*)')
    .eq('token', token)
    .single();

  if (linkError || !bookingLink) {
    return res.status(404).json({ error: 'Invalid booking link' });
  }

  if (bookingLink.used_at) {
    return res.status(400).json({ error: 'Booking link already used' });
  }

  if (bookingLink.expires_at && new Date(bookingLink.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Booking link expired' });
  }

  const user = bookingLink.user;

  // Get or create contact
  let contactId = bookingLink.contact_id;
  if (!contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .insert({
        user_id: user.id,
        email,
        company,
        name,
        status: 'pending',
      })
      .select()
      .single();
    contactId = contact?.id;
  }

  // Get user's Gmail tokens
  const accessToken = user.user_metadata?.gmail_token;
  const refreshToken = user.user_metadata?.gmail_refresh_token;

  if (!accessToken || !refreshToken) {
    return res.status(500).json({ error: 'Calendar not connected' });
  }

  // Get appointment settings
  const { data: settings } = await supabase
    .from('appointment_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Create calendar event
  let calendarEventId: string | null = null;
  try {
    calendarEventId = await createCalendarEvent(
      accessToken,
      refreshToken,
      settings?.calendar_id || 'primary',
      {
        summary: `Meeting with ${name} - ${company}`,
        description: `Appointment booked via MailSurge`,
        start: {
          dateTime: start_time,
          timeZone: settings?.timezone || 'UTC',
        },
        end: {
          dateTime: end_time,
          timeZone: settings?.timezone || 'UTC',
        },
        attendees: [{ email }],
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }
    );
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return res.status(500).json({ error: 'Failed to create calendar event' });
  }

  // Create appointment
  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert({
      user_id: user.id,
      contact_id: contactId,
      campaign_id: bookingLink.campaign_id,
      title: `Meeting with ${name}`,
      description: `Company: ${company}`,
      start_time,
      end_time,
      timezone: settings?.timezone || 'UTC',
      calendar_event_id: calendarEventId,
      status: 'scheduled',
    })
    .select()
    .single();

  if (appointmentError) {
    return res.status(500).json({ error: appointmentError.message });
  }

  // Mark booking link as used
  await supabase
    .from('booking_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', bookingLink.id);

  // TODO: Send confirmation emails (both to user and lead)

  return res.json({ appointment, calendarEventId });
}
```

---

### **Step 5: Add Booking Button to Email Editor (Day 6)**

Update: `src/components/editor/EmailEditor.tsx`

Add a button in the email editor toolbar that:
1. Generates a unique booking link token
2. Inserts booking button HTML into email
3. Creates booking_link record in database

```typescript
// Add to email editor toolbar
const handleAddBookingButton = async () => {
  // Generate token
  const token = crypto.randomUUID();
  
  // Create booking link
  const response = await fetch('/api/booking-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      token,
      campaign_id: campaignId,
    }),
  });

  // Insert booking button HTML
  const bookingHtml = `
    <a href="${window.location.origin}/book/${token}" 
       style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Book a Meeting
    </a>
  `;
  
  // Insert into editor (Unlayer API)
  editorRef.current?.addEventListener('design:updated', () => {
    // Add button to email design
  });
};
```

---

## 🔧 Technical Decisions Needed

### **1. Reminder Trigger Logic**
**Question:** When should reminders be scheduled?
- **Option A:** When campaign status = "completed" (all emails sent)
- **Option B:** When individual contact status = "sent" (per contact)
- **Recommendation:** Option A (simpler, batch processing)

### **2. Reminder Cancellation**
**Question:** Should reminders stop if lead replies?
- **Recommendation:** Yes - check for replies before sending
- **Implementation:** Query Gmail API for replies, cancel pending reminders

### **3. Appointment Booking**
**Question:** Which calendar system?
- **Recommendation:** Google Calendar (already using Gmail API) ✅ IMPLEMENTED
- **Implementation:** Full Google Calendar integration with event creation, availability checking, and Meet links

### **4. Calendar Event Management**
**Question:** Should we sync both ways (MailSurge ↔ Calendar)?
- **Phase 1:** One-way (MailSurge → Calendar) ✅
- **Phase 2:** Two-way sync (update MailSurge when calendar changes) - Future enhancement

---

## 📦 Required Dependencies

### **New Packages Needed**
```bash
npm install googleapis  # Already installed, but need Calendar scope
```

### **Environment Variables**
Add to Vercel:
```
# No new vars needed - reuse existing Google OAuth
# Just add 'https://www.googleapis.com/auth/calendar' to OAuth scopes
```

---

## 🐛 Common Issues & Solutions

### **Issue 1: Inngest Cron Not Firing**
**Solution:** Check Inngest dashboard, ensure function is deployed and cron is active.

### **Issue 2: Reminders Not Scheduling**
**Solution:** Check reminder_rules table, verify is_active = true, check source_campaign_id matches.

### **Issue 3: Google Calendar API Permissions**
**Solution:** Add calendar scope to OAuth consent screen, re-authenticate users.

### **Issue 4: Calendar Events Not Creating**
**Solution:** 
- Verify calendar scope is in OAuth consent screen
- Check calendar_id in appointment_settings (use 'primary' if not set)
- Verify tokens are valid (check expiry)
- Test with Google Calendar API directly

### **Issue 5: Availability Not Showing**
**Solution:**
- Check working_hours JSONB structure in appointment_settings
- Verify timezone is correct
- Check if calendar has existing events blocking slots
- Test getAvailableTimeSlots function directly

---

## 🎯 Success Criteria

### **Reminder System Works When:**
1. ✅ User creates reminder rule
2. ✅ Reminders auto-schedule when campaign completes
3. ✅ Inngest processes queue every 15 minutes
4. ✅ Reminder emails send automatically
5. ✅ Queue status updates correctly

### **Appointment Booking Works When:**
1. ✅ User configures availability (working hours, timezone)
2. ✅ Google Calendar API connected (OAuth with calendar scope)
3. ✅ Booking link generated in email (unique token)
4. ✅ Lead clicks link, sees available time slots
5. ✅ Lead books appointment (fills form, selects time)
6. ✅ Calendar event created automatically in Google Calendar
7. ✅ Google Meet link generated automatically
8. ✅ Appointment record saved in database
9. ✅ Confirmation emails sent (both parties)
10. ✅ Calendar shows event with correct time and attendees

---

## 📝 Next Immediate Actions

1. **Right Now:**
   - Create migration file `007_add_reminder_system.sql`
   - Run it in Supabase
   - Verify tables created

2. **Today:**
   - Create `api/reminders/rules.ts`
   - Test with Postman (GET, POST)

3. **Tomorrow:**
   - Create Inngest reminder processor
   - Test scheduling logic

4. **This Week:**
   - Build frontend UI
   - Connect everything together
   - Test full flow

---

## 💡 Pro Tips

1. **Start Simple:** Get basic reminder working (3 days after campaign) before adding complexity
2. **Test Incrementally:** Test each piece (API, Inngest, UI) separately before integrating
3. **Use Existing Patterns:** Copy structure from campaigns API/UI
4. **Log Everything:** Add console.logs to track reminder flow
5. **Handle Errors:** Reminders can fail - make sure queue status updates correctly

---

*Focus on getting reminders working first. It's simpler, more valuable, and will inform appointment booking implementation.*

