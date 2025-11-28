import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, Mail, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

export function Reminders() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/reminders/rules`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch reminder rules');
      }
      
      const data = await response.json();
      setRules(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching reminder rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (ruleId: string, currentStatus: boolean) => {
    // Optimistic update
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, is_active: !currentStatus } : rule
    ));

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/reminders/rules?id=${ruleId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update rule');
      }
      
      // Refresh rules to ensure consistency
      await fetchRules();
      
      toast({
        title: 'Rule updated',
        description: `Reminder rule ${!currentStatus ? 'activated' : 'deactivated'}`,
        variant: 'success',
      });
    } catch (err) {
      // Revert optimistic update
      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? { ...rule, is_active: currentStatus } : rule
      ));
      
      console.error('Error toggling rule:', err);
      toast({
        title: 'Failed to update rule',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!confirm(`Are you sure you want to delete "${rule?.name || 'this reminder rule'}"? This cannot be undone.`)) {
      return;
    }
    
    // Optimistic update
    const originalRules = [...rules];
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/reminders/rules?id=${ruleId}`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }
      
      toast({
        title: 'Rule deleted',
        description: 'Reminder rule has been removed',
        variant: 'success',
      });
    } catch (err) {
      // Revert optimistic update
      setRules(originalRules);
      console.error('Error deleting rule:', err);
      toast({
        title: 'Failed to delete rule',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const getTriggerDescription = (rule: ReminderRule) => {
    switch (rule.trigger_type) {
      case 'days_after_campaign':
        return `Send ${rule.trigger_value} day${rule.trigger_value !== 1 ? 's' : ''} after campaign`;
      case 'days_after_last_email':
        return `Send ${rule.trigger_value} day${rule.trigger_value !== 1 ? 's' : ''} after last email`;
      case 'no_response':
        return `Send ${rule.trigger_value} day${rule.trigger_value !== 1 ? 's' : ''} after campaign (if no response)`;
      default:
        return 'Unknown trigger';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading reminder rules...</div>
      </div>
    );
  }

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

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {rules.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reminder rules yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first reminder rule to automatically follow up with leads
              </p>
              <Button onClick={() => navigate('/reminders/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Reminder Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    {rule.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(rule.id, rule.is_active)}
                      title={rule.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {rule.is_active ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{getTriggerDescription(rule)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Max reminders: {rule.max_reminders}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Created {formatDate(rule.created_at)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

