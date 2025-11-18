import type { CampaignWithContacts } from '@/types';

interface CampaignProgressProps {
  campaign: CampaignWithContacts;
}

export function CampaignProgress({ campaign }: CampaignProgressProps) {
  const contacts = campaign.contacts || [];
  const total = contacts.length;
  const sent = contacts.filter((c) => c.status === 'sent').length;
  const failed = contacts.filter((c) => c.status === 'failed').length;
  const pending = contacts.filter((c) => c.status === 'pending').length;

  const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Sent: {sent}</span>
        <span>Failed: {failed}</span>
        <span>Pending: {pending}</span>
        <span>Total: {total}</span>
      </div>
    </div>
  );
}



