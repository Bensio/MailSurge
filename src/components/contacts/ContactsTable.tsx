import { useState } from 'react';
import type { Contact } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { Trash2, Mail, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

interface ContactsTableProps {
  contacts: Contact[];
  showCampaign?: boolean;
  onContactRemoved?: () => void;
  campaignId?: string; // If provided, show remove button
  selectedContacts?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

const statusColors: Record<Contact['status'], string> = {
  pending: 'bg-gray-500',
  queued: 'bg-blue-500',
  sent: 'bg-green-500',
  failed: 'bg-red-500',
  bounced: 'bg-orange-500',
};

// Simple checkbox component
const Checkbox = ({ checked, onCheckedChange, ...props }: { checked: boolean; onCheckedChange: (checked: boolean) => void; [key: string]: unknown }) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
    className="h-4 w-4 rounded border-gray-300"
    {...props}
  />
);

export function ContactsTable({ 
  contacts, 
  showCampaign = false, 
  onContactRemoved, 
  campaignId,
  selectedContacts = new Set(),
  onSelectionChange,
}: ContactsTableProps) {
  const [removing, setRemoving] = useState<string | null>(null);
  const { toast } = useToast();
  
  const handleRemoveContact = async (contactId: string) => {
    if (!confirm('Remove this contact from the campaign? (The contact will remain in your library)')) {
      return;
    }
    
    setRemoving(contactId);
    
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ campaign_id: null })
        .eq('id', contactId);
      
      if (error) {
        throw error;
      }
      
      if (onContactRemoved) {
        onContactRemoved();
      }
      toast({
        title: 'Contact removed',
        description: 'The contact has been removed from the campaign.',
      });
    } catch (error) {
      logger.error('Error removing contact:', error);
      toast({
        title: 'Failed to remove contact',
        description: 'An error occurred while removing the contact.',
        variant: 'destructive',
      });
    } finally {
      setRemoving(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(new Set(contacts.map(c => c.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    const newSelected = new Set(selectedContacts);
    if (checked) {
      newSelected.add(contactId);
    } else {
      newSelected.delete(contactId);
    }
    onSelectionChange(newSelected);
  };

  const allSelected = contacts.length > 0 && contacts.every(c => selectedContacts.has(c.id));

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No contacts found
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {onSelectionChange && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {showCampaign && <TableHead>Name</TableHead>}
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            {showCampaign && <TableHead>Campaign</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Sent At</TableHead>
            <TableHead>Opened</TableHead>
            <TableHead>Error</TableHead>
            {(campaignId || onSelectionChange) && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const contactWithCampaign = contact as Contact & { campaign_name?: string; name?: string | null; campaigns?: string[] };
            const isSelected = selectedContacts.has(contact.id);
            
            return (
              <TableRow 
                key={contact.id}
                className={isSelected ? 'bg-muted/50' : ''}
              >
                {onSelectionChange && (
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                      aria-label={`Select ${contact.email}`}
                    />
                  </TableCell>
                )}
                {showCampaign && (
                  <TableCell>
                    {contactWithCampaign.name || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                )}
                <TableCell className="font-medium">{contact.email}</TableCell>
                <TableCell>{contact.company}</TableCell>
                {showCampaign && (
                  <TableCell>
                    {contactWithCampaign.campaign_name ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 w-fit">
                          {contactWithCampaign.campaign_name}
                        </Badge>
                        {contactWithCampaign.campaigns && contactWithCampaign.campaigns.length > 1 && (
                          <span className="text-xs text-muted-foreground">
                            +{contactWithCampaign.campaigns.length - 1} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        Library
                      </Badge>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <Badge className={statusColors[contact.status]}>
                    {contact.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {contact.sent_at ? formatDate(contact.sent_at) : '-'}
                </TableCell>
                <TableCell>
                  {contact.opened_at ? (
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-green-600" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-green-600">
                          {contact.open_count || 1}x
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(contact.opened_at)}
                        </span>
                      </div>
                    </div>
                  ) : contact.status === 'sent' ? (
                    <span className="text-muted-foreground text-sm">Not opened</span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-sm text-destructive max-w-xs truncate">
                  {contact.error || '-'}
                </TableCell>
                {(campaignId || onSelectionChange) && (
                  <TableCell>
                    {campaignId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveContact(contact.id)}
                        disabled={removing === contact.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        {contact.campaign_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveContact(contact.id)}
                            disabled={removing === contact.id}
                            title="Remove from campaign (keep in library)"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
