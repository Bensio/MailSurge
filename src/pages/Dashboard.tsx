import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignStore } from '@/stores/campaignStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { Plus, TrendingUp, Mail, CheckCircle2, Clock } from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const { campaigns, fetchCampaigns } = useCampaignStore();

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Memoize filtered campaigns to avoid recalculation on every render
  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.status !== 'archived'),
    [campaigns]
  );
  
  // Memoize stats calculation
  const stats = useMemo(() => ({
    total: activeCampaigns.length,
    sending: activeCampaigns.filter((c) => c.status === 'sending').length,
    completed: activeCampaigns.filter((c) => c.status === 'completed').length,
    draft: activeCampaigns.filter((c) => c.status === 'draft').length,
    failed: activeCampaigns.filter((c) => c.status === 'failed').length,
  }), [activeCampaigns]);

  // Memoize recent campaigns calculation
  const recentCampaigns = useMemo(
    () => activeCampaigns
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
    [activeCampaigns]
  );

  const handleNewCampaign = useCallback(() => {
    navigate('/campaigns/new');
  }, [navigate]);

  const handleViewAll = useCallback(() => {
    navigate('/campaigns');
  }, [navigate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your email campaigns</p>
        </div>
        <Button onClick={handleNewCampaign}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Active campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
            <p className="text-xs text-muted-foreground">Not sent yet</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sending}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {recentCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
            {activeCampaigns.length > 5 && (
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={handleViewAll}>
                  View All Campaigns
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeCampaigns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No campaigns yet</p>
            <Button onClick={handleNewCampaign}>
              Create your first campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

