import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Campaign } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface CampaignCardProps {
  campaign: Campaign;
}

const statusColors: Record<Campaign['status'], string> = {
  draft: 'bg-gray-500',
  sending: 'bg-blue-500',
  paused: 'bg-yellow-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  archived: 'bg-gray-400',
};

export const CampaignCard = memo(function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    navigate(`/campaigns/${campaign.id}`);
  }, [navigate, campaign.id]);

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
          <Badge className={statusColors[campaign.status]}>
            {campaign.status}
          </Badge>
        </div>
        <CardDescription>{campaign.subject}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Created {formatDate(campaign.created_at)}
        </div>
      </CardContent>
    </Card>
  );
});



