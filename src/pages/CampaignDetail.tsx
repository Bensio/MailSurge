import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignStore } from '@/stores/campaignStore';
import { useAuthStore } from '@/stores/authStore';
import { CampaignProgress } from '@/components/campaigns/CampaignProgress';
import { ContactsUpload } from '@/components/contacts/ContactsUpload';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Trash2, ArrowLeft, Plus, X, RotateCcw, Archive, RefreshCw } from 'lucide-react';
import { formatDate, validateEmail } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Contact } from '@/types';

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCampaign, loading, error, fetchCampaign, sendCampaign, deleteCampaign } = useCampaignStore();
  const { user } = useAuthStore();
  const [showUpload, setShowUpload] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [showAddFromLibrary, setShowAddFromLibrary] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  
  // Library contacts state
  const [libraryContacts, setLibraryContacts] = useState<Contact[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCampaign(id);
    }
  }, [id, fetchCampaign]);

  // Auto-refresh campaign status when sending
  useEffect(() => {
    if (!id || !currentCampaign) {
      setIsRefreshing(false);
      return;
    }

    // Only poll if campaign status is explicitly "sending"
    // Don't poll for draft, completed, failed, or paused campaigns
    if (currentCampaign.status !== 'sending') {
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);

    // Poll every 5 seconds while sending (less aggressive)
    const interval = setInterval(() => {
      if (id) {
        fetchCampaign(id).catch((err) => {
          logger.error('Error refreshing campaign:', err);
          // If we get a 404, stop polling
          if (err instanceof Error && err.message === 'NOT_FOUND') {
            setIsRefreshing(false);
            clearInterval(interval);
          }
        });
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      setIsRefreshing(false);
    };
  }, [id, currentCampaign?.status, fetchCampaign]);

  // Fetch library contacts when "Add from Library" is opened
  useEffect(() => {
    if (showAddFromLibrary && user && currentCampaign) {
      fetchLibraryContacts();
    }
    // fetchLibraryContacts is defined in component and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddFromLibrary, user, currentCampaign]);

  const fetchLibraryContacts = async () => {
    if (!user || !currentCampaign) return;
    setLoadingLibrary(true);
    try {
      // Only get contacts that are in the library (campaign_id IS NULL)
      // This prevents showing duplicates from other campaigns
      logger.debug('Library', 'Fetching library contacts', { userId: user.id, campaignId: currentCampaign.id });
      
      const { data: libraryContacts, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .is('campaign_id', null) // Only true library contacts (no campaign)
        .order('email', { ascending: true });

      if (error) {
        logger.error('Error fetching library contacts:', error);
        setLibraryContacts([]);
      } else {
        logger.debug('Library', 'Contacts fetched', { count: libraryContacts?.length || 0 });
        
        // Filter out contacts already in this campaign (by email, not ID, since we're creating new records)
        const campaignContactEmails = new Set(
          (currentCampaign.contacts || []).map((c: Contact) => c.email.toLowerCase())
        );
        
        const availableContacts = (libraryContacts || []).filter(
          contact => !campaignContactEmails.has(contact.email.toLowerCase())
        );
        
        logger.debug('Library', 'Available contacts after filtering', { count: availableContacts.length });
        setLibraryContacts(availableContacts);
      }
    } catch (error) {
      logger.error('Error fetching library contacts:', error);
      setLibraryContacts([]);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleAddFromLibrary = async (contactId: string) => {
    if (!id || !user) return;
    setAddingContact(true);
    try {
      // Get the contact to copy
      const { data: sourceContact, error: fetchError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (fetchError || !sourceContact) {
        throw new Error('Contact not found');
      }

      // Create a NEW contact record for this campaign (don't move the existing one)
      // This allows the same contact to exist in multiple campaigns
      const newContactData: Record<string, unknown> = {
        campaign_id: id,
        user_id: user.id,
        email: sourceContact.email,
        company: sourceContact.company,
        status: 'pending', // Always start fresh as pending
        sent_at: null,
        error: null,
      };

      // Copy optional fields if they exist
      if (sourceContact.name) {
        newContactData.name = sourceContact.name;
      }
      if (sourceContact.custom_fields) {
        newContactData.custom_fields = sourceContact.custom_fields;
      }

      const { error: insertError } = await supabase
        .from('contacts')
        .insert(newContactData);

      if (insertError) {
        // If it's a duplicate (same email already in this campaign), that's okay
        if (insertError.code === '23505') {
          alert('This contact already exists in this campaign');
        } else {
          throw insertError;
        }
      }

      // Refresh both campaign and library
      if (id) {
        fetchCampaign(id);
      }
      fetchLibraryContacts();
    } catch (error) {
      logger.error('Error adding contact from library:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add contact to campaign';
      alert(`Error: ${errorMessage}`);
    } finally {
      setAddingContact(false);
    }
  };

  const handleSend = async () => {
    if (!id) return;
    if (contacts.length === 0) {
      alert('This campaign has no contacts. Please add contacts before sending.');
      return;
    }
    if (!confirm(`Are you sure you want to send this campaign to ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }
    try {
      await sendCampaign(id);
      const delay = currentCampaign?.settings?.delay || 45;
      // Refresh immediately to get updated status
      if (id) {
        await fetchCampaign(id);
      }
      alert(`Campaign sending started! Emails will be sent to ${contacts.length} contact${contacts.length !== 1 ? 's' : ''} with a ${delay} second delay between each. The page will auto-refresh to show progress.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send campaign';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleRetry = async () => {
    if (!id) return;
    const failedContacts = contacts.filter((c: Contact) => c.status === 'failed');
    const pendingContacts = contacts.filter((c: Contact) => c.status === 'pending');
    // Also include contacts that aren't 'sent' - they might have wrong status
    const unsentContacts = contacts.filter((c: Contact) => c.status !== 'sent');
    const totalToRetry = unsentContacts.length;
    
    if (totalToRetry === 0) {
      alert('No contacts to retry. All contacts are already sent.');
      return;
    }
    
    if (!confirm(`Are you sure you want to retry sending this campaign? This will attempt to send to ${totalToRetry} contact${totalToRetry !== 1 ? 's' : ''} (${failedContacts.length} failed, ${pendingContacts.length} pending, ${unsentContacts.length - failedContacts.length - pendingContacts.length} other).`)) {
      return;
    }
    
    try {
      // Reset all non-sent contacts to pending (including failed, pending, and any other status)
      const unsentContactIds = unsentContacts.map((c: Contact) => c.id);
      if (unsentContactIds.length > 0) {
        const { error: resetError } = await supabase
          .from('contacts')
          .update({ 
            status: 'pending',
            error: null,
            sent_at: null
          })
          .in('id', unsentContactIds);
        
        if (resetError) {
          throw new Error(`Failed to reset contacts: ${resetError.message}`);
        }
      }
      
      // Reset campaign status to draft
      const { error: campaignResetError } = await supabase
        .from('campaigns')
        .update({ 
          status: 'draft',
          sent_at: null,
          completed_at: null
        })
        .eq('id', id);
      
      if (campaignResetError) {
        throw new Error(`Failed to reset campaign: ${campaignResetError.message}`);
      }
      
      // Refresh campaign data
      await fetchCampaign(id);
      
      // Now send the campaign
      await sendCampaign(id);
      const delay = currentCampaign?.settings?.delay || 45;
      alert(`Campaign retry started! Emails will be sent to ${totalToRetry} contact${totalToRetry !== 1 ? 's' : ''} with a ${delay} second delay between each.`);
      
      // Refresh campaign data after a short delay
      setTimeout(() => {
        if (id) {
          fetchCampaign(id);
        }
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry campaign';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to archive this campaign? You can still view it later.')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'archived' })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      // Refresh campaign data
      if (id) {
        fetchCampaign(id);
      }
    } catch (error) {
      logger.error('Error archiving campaign:', error);
      alert('Failed to archive campaign');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }
    await deleteCampaign(id);
    navigate('/campaigns');
  };

  const handleAddContact = async () => {
    if (!id || !user) return;
    if (!contactEmail || !contactCompany) {
      alert('Please fill in both email and company');
      return;
    }
    if (!validateEmail(contactEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    setAddingContact(true);
    try {
      const contactData: Record<string, unknown> = {
        campaign_id: id,
        email: contactEmail.trim(),
        company: contactCompany.trim(),
        status: 'pending',
      };
      
      if (user.id) {
        contactData.user_id = user.id;
      }
      
      if (contactName.trim()) {
        contactData.name = contactName.trim();
      }

      const { error: insertError } = await supabase
        .from('contacts')
        .insert(contactData)
        .select();

      if (insertError) {
        logger.error('Error inserting contact:', insertError);
        if (insertError.code === '23505') {
          alert('This contact already exists in this campaign');
        } else {
          alert(`Failed to add contact: ${insertError.message || 'Unknown error'}`);
          throw insertError;
        }
      } else {
        // Reset form and close modal
        setContactName('');
        setContactEmail('');
        setContactCompany('');
        setShowAddNew(false);
        // Refresh campaign data
        if (id) {
          fetchCampaign(id);
        }
      }
    } catch (error) {
      logger.error('Error adding contact:', error);
      alert('Failed to add contact');
    } finally {
      setAddingContact(false);
    }
  };

  if (loading && !currentCampaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading campaign...</div>
      </div>
    );
  }

  // Handle 404 redirect
  useEffect(() => {
    if (error === 'NOT_FOUND' || (error && error.includes('NOT_FOUND'))) {
      const timer = setTimeout(() => {
        navigate('/campaigns');
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, navigate]);

  if (error || !currentCampaign) {
    // If 404 error, show redirect message
    if (error === 'NOT_FOUND' || (error && (error.includes('NOT_FOUND') || error.includes('not found')))) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-destructive">Campaign not found</div>
          <div className="text-sm text-muted-foreground">Redirecting to campaigns list...</div>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error: {error || 'Campaign not found'}</div>
      </div>
    );
  }

  const contacts = currentCampaign.contacts || [];
  const canSend = currentCampaign.status === 'draft' && contacts.length > 0;
  
  // Check contact statuses
  const failedContacts = contacts.filter((c: Contact) => c.status === 'failed');
  const sentContacts = contacts.filter((c: Contact) => c.status === 'sent');
  const allSent = contacts.length > 0 && sentContacts.length === contacts.length;
  const hasFailed = failedContacts.length > 0;
  
  // Show retry if campaign is failed/completed AND there are failed contacts
  // Allow retry if:
  // 1. Campaign is failed or completed AND has failed contacts, OR
  // 2. Campaign is completed AND has contacts that aren't sent (might have wrong status)
  const hasUnsentContacts = contacts.some((c: Contact) => c.status !== 'sent');
  const canRetry = (currentCampaign.status === 'failed' || currentCampaign.status === 'completed') && (hasFailed || hasUnsentContacts);
  
  // Show archive if campaign is completed AND all contacts are sent (no failed contacts)
  const canArchive = currentCampaign.status === 'completed' && allSent && !hasFailed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{currentCampaign.name}</h1>
            <p className="text-muted-foreground">{currentCampaign.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{currentCampaign.status}</Badge>
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Updating...</span>
            </div>
          )}
          {canSend && (
            <Button onClick={handleSend} disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              Send Campaign
            </Button>
          )}
          {canRetry && (
            <Button onClick={handleRetry} disabled={loading} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Failed ({failedContacts.length})
            </Button>
          )}
          {canArchive && (
            <Button onClick={handleArchive} disabled={loading} variant="outline">
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Created:</span>
              <span className="ml-2">{formatDate(currentCampaign.created_at)}</span>
            </div>
            {currentCampaign.sent_at && (
              <div>
                <span className="text-sm text-muted-foreground">Sent:</span>
                <span className="ml-2">{formatDate(currentCampaign.sent_at)}</span>
              </div>
            )}
            {currentCampaign.completed_at && (
              <div>
                <span className="text-sm text-muted-foreground">Completed:</span>
                <span className="ml-2">{formatDate(currentCampaign.completed_at)}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-muted-foreground">Delay:</span>
              <span className="ml-2">{currentCampaign.settings.delay} seconds</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <CampaignProgress campaign={currentCampaign} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''} in this campaign
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setShowAddFromLibrary(!showAddFromLibrary);
                setShowAddNew(false);
                setShowUpload(false);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add from Library
              </Button>
              <Button variant="outline" onClick={() => {
                setShowAddNew(!showAddNew);
                setShowAddFromLibrary(false);
                setShowUpload(false);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Contact
              </Button>
              <Button variant="outline" onClick={() => {
                setShowUpload(!showUpload);
                setShowAddFromLibrary(false);
                setShowAddNew(false);
              }}>
                {showUpload ? 'Hide Upload' : 'Upload CSV'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddFromLibrary && (
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Add Contacts from Library</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowAddFromLibrary(false);
                      setSearchQuery('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search-contacts">Search Contacts</Label>
                  <Input
                    id="search-contacts"
                    placeholder="Search by name, email, or company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {loadingLibrary ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading contacts...
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {libraryContacts
                      .filter(contact => {
                        if (!searchQuery) return true;
                        const query = searchQuery.toLowerCase();
                        return (
                          contact.email.toLowerCase().includes(query) ||
                          contact.company.toLowerCase().includes(query) ||
                          (contact.name && contact.name.toLowerCase().includes(query))
                        );
                      })
                      .map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="font-medium">
                              {contact.name || contact.email}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {contact.name && <span>{contact.email} • </span>}
                              {contact.company}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddFromLibrary(contact.id)}
                            disabled={addingContact}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      ))}
                    {libraryContacts.filter(contact => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        contact.email.toLowerCase().includes(query) ||
                        contact.company.toLowerCase().includes(query) ||
                        (contact.name && contact.name.toLowerCase().includes(query))
                      );
                    }).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'No contacts found matching your search' : 'No contacts available in your library'}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {showAddNew && (
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Add New Contact to Campaign</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowAddNew(false);
                      setContactName('');
                      setContactEmail('');
                      setContactCompany('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Name (Optional)</Label>
                  <Input
                    id="contact-name"
                    placeholder="John Doe"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="john@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-company">Company *</Label>
                  <Input
                    id="contact-company"
                    placeholder="Acme Inc"
                    value={contactCompany}
                    onChange={(e) => setContactCompany(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddContact} disabled={addingContact}>
                    {addingContact ? 'Adding...' : 'Add Contact'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddNew(false);
                      setContactName('');
                      setContactEmail('');
                      setContactCompany('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {showUpload && id && (
            <ContactsUpload
              campaignId={id}
              onUploadComplete={() => {
                setShowUpload(false);
                if (id) {
                  fetchCampaign(id);
                }
              }}
            />
          )}
          <ContactsTable 
            contacts={contacts} 
            campaignId={id}
            onContactRemoved={() => {
              if (id) {
                fetchCampaign(id);
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

