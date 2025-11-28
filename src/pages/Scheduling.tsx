import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignStore } from '@/stores/campaignStore';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Mail, Send, Plus, Eye } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ReminderRule {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: number;
  reminder_campaign_id: string;
  source_campaign_id: string;
  is_active: boolean;
  max_reminders: number;
  created_at: string;
}

interface ReminderQueueItem {
  id: string;
  contact_id: string;
  reminder_rule_id: string;
  campaign_id: string;
  scheduled_for: string;
  status: string;
  sent_at?: string;
  opened_at?: string;
  open_count?: number;
  reminder_count: number;
  reminder_rules?: ReminderRule;
  contacts?: { email: string; company: string };
  campaigns?: { name: string; subject: string };
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function Scheduling() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { campaigns, fetchCampaigns } = useCampaignStore();
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
  const [reminderQueue, setReminderQueue] = useState<ReminderQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('campaigns');

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchReminderRules();
      fetchReminderQueue();
    }
  }, [user]);

  const fetchReminderRules = async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns?type=reminders`, { headers });
      if (response.ok) {
        const data = await response.json();
        setReminderRules(data);
      }
    } catch (error) {
      console.error('Error fetching reminder rules:', error);
    }
  };

  const fetchReminderQueue = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reminder_queue')
        .select(`
          *,
          reminder_rules(*),
          contacts(email, company),
          campaigns(name, subject)
        `)
        .eq('user_id', user.id)
        .order('scheduled_for', { ascending: true });
      
      if (error) throw error;
      setReminderQueue(data || []);
    } catch (error) {
      console.error('Error fetching reminder queue:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get scheduled campaigns
  const scheduledCampaigns = campaigns.filter(c => c.scheduled_at && c.status === 'draft');
  const upcomingReminders = reminderQueue.filter(r => r.status === 'pending' && new Date(r.scheduled_for) > new Date());
  const sentReminders = reminderQueue.filter(r => r.status === 'sent');

  const getTimeUntil = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Past due';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduling</h1>
          <p className="text-muted-foreground">View and manage all scheduled campaigns and reminders</p>
        </div>
        <Button onClick={() => navigate('/reminders/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Reminder Rule
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">
            Scheduled Campaigns ({scheduledCampaigns.length})
          </TabsTrigger>
          <TabsTrigger value="reminders">
            Upcoming Reminders ({upcomingReminders.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent Reminders ({sentReminders.length})
          </TabsTrigger>
          <TabsTrigger value="rules">
            Reminder Rules ({reminderRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {scheduledCampaigns.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No scheduled campaigns</h3>
                  <p className="text-muted-foreground">
                    Schedule campaigns from the campaign detail page
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            scheduledCampaigns.map(campaign => (
              <Card key={campaign.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{campaign.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{campaign.subject}</p>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Clock className="mr-1 h-3 w-3" />
                      {getTimeUntil(campaign.scheduled_at!)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Scheduled: {new Date(campaign.scheduled_at!).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          {upcomingReminders.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No upcoming reminders</h3>
                  <p className="text-muted-foreground">
                    Reminders will appear here when scheduled
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            upcomingReminders.map(reminder => (
              <Card key={reminder.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {reminder.contacts?.email || 'Unknown contact'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {reminder.campaigns?.name || 'Reminder campaign'}
                      </p>
                    </div>
                    <Badge variant="outline">
                      <Clock className="mr-1 h-3 w-3" />
                      {getTimeUntil(reminder.scheduled_for)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Scheduled: {new Date(reminder.scheduled_for).toLocaleString()}</span>
                    <span>•</span>
                    <span>Reminder #{reminder.reminder_count + 1}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          {sentReminders.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Send className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No sent reminders</h3>
                  <p className="text-muted-foreground">
                    Sent reminders will appear here
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            sentReminders.map(reminder => (
              <Card key={reminder.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {reminder.contacts?.email || 'Unknown contact'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {reminder.campaigns?.name || 'Reminder campaign'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {reminder.opened_at && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Eye className="mr-1 h-3 w-3" />
                          Opened {reminder.open_count || 1}x
                        </Badge>
                      )}
                      <Badge variant="secondary">Sent</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Sent: {reminder.sent_at ? formatDate(reminder.sent_at) : 'Unknown'}</span>
                    {reminder.opened_at && (
                      <>
                        <span>•</span>
                        <span>Opened: {formatDate(reminder.opened_at)}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          {reminderRules.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No reminder rules</h3>
                  <p className="text-muted-foreground mb-4">
                    Create reminder rules to automatically follow up with leads
                  </p>
                  <Button onClick={() => navigate('/reminders/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Reminder Rule
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            reminderRules.map(rule => (
              <Card key={rule.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/campaigns/${rule.source_campaign_id}`)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{rule.name}</CardTitle>
                    <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {rule.trigger_type === 'days_after_campaign' && `Send ${rule.trigger_value} day${rule.trigger_value !== 1 ? 's' : ''} after campaign`}
                        {rule.trigger_type === 'days_after_last_email' && `Send ${rule.trigger_value} day${rule.trigger_value !== 1 ? 's' : ''} after last email`}
                        {rule.trigger_type === 'no_response' && `Send ${rule.trigger_value} day${rule.trigger_value !== 1 ? 's' : ''} after campaign (if no response)`}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Max reminders: {rule.max_reminders} • Created {formatDate(rule.created_at)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

