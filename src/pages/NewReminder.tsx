import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignStore } from '@/stores/campaignStore';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

export function NewReminder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { campaigns, fetchCampaigns } = useCampaignStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    trigger_type: 'days_after_campaign' as 'days_after_campaign' | 'days_after_last_email' | 'no_response',
    trigger_value: 3,
    reminder_campaign_id: '',
    source_campaign_id: '',
    max_reminders: 3,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.source_campaign_id) {
      newErrors.source_campaign_id = 'Source campaign is required';
    }
    if (!formData.reminder_campaign_id) {
      newErrors.reminder_campaign_id = 'Reminder campaign is required';
    }
    if (formData.trigger_value < 1) {
      newErrors.trigger_value = 'Days must be at least 1';
    }
    if (formData.max_reminders < 1) {
      newErrors.max_reminders = 'Max reminders must be at least 1';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns?type=reminders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create reminder rule');
      }

      // Success - show toast and navigate
      toast({
        title: 'Reminder rule created',
        description: 'Your reminder rule has been set up successfully',
        variant: 'success',
      });
      navigate('/reminders');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors({ submit: errorMessage });
      console.error('Error creating reminder rule:', error);
      toast({
        title: 'Failed to create rule',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter campaigns - only show completed campaigns for source (they've been sent)
  const availableSourceCampaigns = campaigns.filter(
    (c) => c.status === 'completed' || c.status === 'sending'
  );
  
  // All campaigns can be used as reminder campaigns
  const availableReminderCampaigns = campaigns.filter(
    (c) => c.status !== 'archived'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/reminders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Reminder Rule</h1>
          <p className="text-muted-foreground">Set up automated follow-up emails for your campaigns</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reminder Rule Details</CardTitle>
          <CardDescription>
            Configure when and how reminders should be sent to your leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Follow up after 3 days"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            {/* Source Campaign */}
            <div className="space-y-2">
              <Label htmlFor="source_campaign">Source Campaign *</Label>
              <select
                id="source_campaign"
                value={formData.source_campaign_id}
                onChange={(e) => setFormData({ ...formData, source_campaign_id: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md bg-background ${errors.source_campaign_id ? 'border-red-500' : ''}`}
              >
                <option value="">-- Select source campaign --</option>
                {availableSourceCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} ({campaign.status})
                  </option>
                ))}
              </select>
              {errors.source_campaign_id && (
                <p className="text-sm text-red-500">{errors.source_campaign_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The campaign that triggers reminders (must be completed or sending)
              </p>
            </div>

            {/* Reminder Campaign */}
            <div className="space-y-2">
              <Label htmlFor="reminder_campaign">Reminder Campaign *</Label>
              <select
                id="reminder_campaign"
                value={formData.reminder_campaign_id}
                onChange={(e) => setFormData({ ...formData, reminder_campaign_id: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md bg-background ${errors.reminder_campaign_id ? 'border-red-500' : ''}`}
              >
                <option value="">-- Select reminder campaign --</option>
                {availableReminderCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              {errors.reminder_campaign_id && (
                <p className="text-sm text-red-500">{errors.reminder_campaign_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The email campaign to send as a reminder
              </p>
            </div>

            {/* Trigger Type */}
            <div className="space-y-2">
              <Label htmlFor="trigger_type">Trigger Type *</Label>
              <select
                id="trigger_type"
                value={formData.trigger_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    trigger_type: e.target.value as typeof formData.trigger_type,
                  })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="days_after_campaign">Days after campaign completes</option>
                <option value="days_after_last_email">Days after last email sent</option>
                <option value="no_response">Days after campaign (if no response)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                When to send the reminder relative to the source campaign
              </p>
            </div>

            {/* Trigger Value (Days) */}
            <div className="space-y-2">
              <Label htmlFor="trigger_value">Days to Wait *</Label>
              <Input
                id="trigger_value"
                type="number"
                min="1"
                value={formData.trigger_value}
                onChange={(e) =>
                  setFormData({ ...formData, trigger_value: parseInt(e.target.value) || 1 })
                }
                className={errors.trigger_value ? 'border-red-500' : ''}
              />
              {errors.trigger_value && (
                <p className="text-sm text-red-500">{errors.trigger_value}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Number of days to wait before sending the reminder
              </p>
            </div>

            {/* Max Reminders */}
            <div className="space-y-2">
              <Label htmlFor="max_reminders">Max Reminders *</Label>
              <Input
                id="max_reminders"
                type="number"
                min="1"
                value={formData.max_reminders}
                onChange={(e) =>
                  setFormData({ ...formData, max_reminders: parseInt(e.target.value) || 1 })
                }
                className={errors.max_reminders ? 'border-red-500' : ''}
              />
              {errors.max_reminders && (
                <p className="text-sm text-red-500">{errors.max_reminders}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Maximum number of reminders to send per contact
              </p>
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Reminder Rule'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/reminders')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

