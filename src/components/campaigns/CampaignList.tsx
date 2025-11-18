import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignStore } from '@/stores/campaignStore';
import { CampaignCard } from './CampaignCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function CampaignList() {
  const navigate = useNavigate();
  const { campaigns, loading, error, fetchCampaigns } = useCampaignStore();

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading campaigns...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  // Separate active and archived campaigns
  const activeCampaigns = campaigns.filter((c) => c.status !== 'archived');
  const archivedCampaigns = campaigns.filter((c) => c.status === 'archived');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Campaigns</h2>
        <Button onClick={() => navigate('/campaigns/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {activeCampaigns.length === 0 && archivedCampaigns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No campaigns yet</p>
          <Button onClick={() => navigate('/campaigns/new')}>
            Create your first campaign
          </Button>
        </div>
      ) : (
        <>
          {activeCampaigns.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}

          {archivedCampaigns.length > 0 && (
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-xl font-semibold text-muted-foreground">Archived Campaigns</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


