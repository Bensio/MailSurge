import { useEffect, useState } from 'react';
import { debounce } from '@/lib/debounce';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContactsUpload } from '@/components/contacts/ContactsUpload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Mail, X, Plus, FileUp, Search, Trash2, Download } from 'lucide-react';
import type { Contact } from '@/types';
import { validateEmail } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface ContactWithCampaign extends Contact {
  campaign_name?: string;
  campaigns?: string[]; // List of campaign names this contact is in
}

export function Contacts() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { campaigns, fetchCampaigns } = useCampaignStore();
  const [contacts, setContacts] = useState<ContactWithCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'upload' | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'library' | 'all' | 'campaigns'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  // Debounce search query to avoid filtering on every keystroke
  useEffect(() => {
    const debounced = debounce((value: string) => {
      setDebouncedSearchQuery(value);
    }, 300);
    
    debounced(searchQuery);
    
    // Cleanup function
    return () => {
      // Debounce cleanup is handled internally
    };
  }, [searchQuery]);
  
  // Single contact form
  const [singleName, setSingleName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singleCompany, setSingleCompany] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchAllContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchCampaigns]);

  const fetchAllContacts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      logger.debug('Contacts', 'Fetching contacts', { userId: user.id });
      
      // Get all contacts for this user
      const { data: contactsData, error: errorWithUserId } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('email', { ascending: true });
      
      if (errorWithUserId && errorWithUserId.code === '42703') {
        // Fallback to campaign-based query if user_id doesn't exist
        const { data: campaignsData } = await supabase
          .from('campaigns')
          .select('id, name')
          .eq('user_id', user.id);

        if (campaignsData && campaignsData.length > 0) {
          const campaignIds = campaignsData.map((c) => c.id);
          const result = await supabase
            .from('contacts')
            .select('*')
            .in('campaign_id', campaignIds)
            .order('email', { ascending: true });
          
          if (result.error) {
            throw result.error;
          }
          await processContacts(result.data || []);
        } else {
          await processContacts([]);
        }
      } else {
        if (errorWithUserId) {
          throw errorWithUserId;
        }
        await processContacts(contactsData || []);
      }
    } catch (error) {
      logger.error('Error fetching contacts:', error);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const processContacts = async (contactsData: Contact[]) => {
    // Remove duplicate library contacts
    const seenLibraryEmails = new Set<string>();
    const uniqueContacts = contactsData.filter((contact) => {
      if (!contact.campaign_id) {
        const emailKey = `${contact.user_id || ''}_${contact.email.toLowerCase()}`;
        if (seenLibraryEmails.has(emailKey)) {
          logger.warn('Duplicate library contact removed:', contact.email);
          return false;
        }
        seenLibraryEmails.add(emailKey);
      }
      return true;
    });

    // Get campaign names
    const campaignIds = [...new Set(uniqueContacts.filter(c => c.campaign_id).map(c => c.campaign_id))] as string[];
    const campaignMap = new Map<string, string>();
    
    if (campaignIds.length > 0) {
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', campaignIds);
      
      campaignsData?.forEach((c) => campaignMap.set(c.id, c.name));
    }
    
    // Group contacts by email to show which campaigns they're in
    const emailToCampaigns = new Map<string, string[]>();
    uniqueContacts.forEach((contact) => {
      if (contact.campaign_id) {
        const emailKey = contact.email.toLowerCase();
        const campaignName = campaignMap.get(contact.campaign_id);
        if (campaignName) {
          if (!emailToCampaigns.has(emailKey)) {
            emailToCampaigns.set(emailKey, []);
          }
          emailToCampaigns.get(emailKey)!.push(campaignName);
        }
      }
    });
    
    // Add campaign names to contacts
    const contactsWithCampaigns = uniqueContacts.map((contact) => {
      const emailKey = contact.email.toLowerCase();
      const campaigns = emailToCampaigns.get(emailKey) || [];
      
      return {
        ...contact,
        campaign_name: contact.campaign_id ? campaignMap.get(contact.campaign_id) : 'Library',
        campaigns: campaigns,
      };
    });
    
    setContacts(contactsWithCampaigns);
  };

  const handleAddSingleContact = async () => {
    if (!user) return;
    if (!singleEmail || !singleCompany) {
      alert('Please fill in both email and company');
      return;
    }
    if (!validateEmail(singleEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    setAddingContact(true);
    try {
      const contactData: Record<string, unknown> = {
        campaign_id: selectedCampaignId || null,
        email: singleEmail.trim(),
        company: singleCompany.trim(),
        status: 'pending',
        user_id: user.id,
      };
      
      if (singleName.trim()) {
        contactData.name = singleName.trim();
      }
      
      const { error } = await supabase
        .from('contacts')
        .insert(contactData)
        .select();

      if (error) {
        logger.error('Error inserting contact:', error);
        if (error.code === '23505') {
          alert('This contact already exists');
        } else {
          alert(`Failed to add contact: ${error.message || 'Unknown error'}`);
        }
      } else {
        setSingleName('');
        setSingleEmail('');
        setSingleCompany('');
        setSelectedCampaignId('');
        setAddMode(null);
        setShowAddModal(false);
        fetchAllContacts();
      }
    } catch (error) {
      logger.error('Error adding contact:', error);
      alert('Failed to add contact');
    } finally {
      setAddingContact(false);
    }
  };

  const handleUploadComplete = () => {
    setShowAddModal(false);
    setAddMode(null);
    setSelectedCampaignId('');
    fetchAllContacts();
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    if (!confirm(`Delete ${selectedContacts.size} contact(s)? This cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', Array.from(selectedContacts));
      
      if (error) throw error;
      
      setSelectedContacts(new Set());
      fetchAllContacts();
    } catch (error) {
      logger.error('Error deleting contacts:', error);
      alert('Failed to delete contacts');
    }
  };

  const handleBulkMoveToLibrary = async () => {
    if (selectedContacts.size === 0) return;
    if (!confirm(`Move ${selectedContacts.size} contact(s) to library?`)) return;
    
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ campaign_id: null })
        .in('id', Array.from(selectedContacts));
      
      if (error) throw error;
      
      setSelectedContacts(new Set());
      fetchAllContacts();
    } catch (error) {
      logger.error('Error moving contacts:', error);
      alert('Failed to move contacts to library');
    }
  };

  const handleExport = () => {
    const filtered = getFilteredContacts();
    const csv = [
      ['Name', 'Email', 'Company', 'Campaign', 'Status'].join(','),
      ...filtered.map(c => [
        c.name || '',
        c.email,
        c.company,
        c.campaign_name || 'Library',
        c.status,
      ].map(v => `"${v}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFilteredContacts = () => {
    let filtered = contacts;
    
    // Filter by tab
    if (activeTab === 'library') {
      filtered = filtered.filter(c => !c.campaign_id);
    } else if (activeTab === 'campaigns') {
      filtered = filtered.filter(c => c.campaign_id);
    }
    
    // Filter by search
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.email.toLowerCase().includes(query) ||
        c.company.toLowerCase().includes(query) ||
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.campaign_name && c.campaign_name.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading contacts...</div>
      </div>
    );
  }

  const libraryContacts = contacts.filter(c => !c.campaign_id);
  const campaignContacts = contacts.filter(c => c.campaign_id);
  const filteredContacts = getFilteredContacts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contact Library</h1>
          <p className="text-muted-foreground">
            {libraryContacts.length} in library • {campaignContacts.length} in campaigns • {contacts.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              setShowAddModal(true);
              setAddMode(null);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
          <Button variant="outline" onClick={() => navigate('/campaigns/new')}>
            <Mail className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Add Contact Modal - Keep existing modal code */}
      {showAddModal && (
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Add Contact</CardTitle>
                <CardDescription>
                  Add to library or directly to a campaign
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowAddModal(false);
                  setAddMode(null);
                  setSelectedCampaignId('');
                  setSingleName('');
                  setSingleEmail('');
                  setSingleCompany('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!addMode ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setAddMode('single')}
                >
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <Plus className="h-8 w-8 mx-auto text-muted-foreground" />
                      <h3 className="font-semibold">Add Single Contact</h3>
                      <p className="text-sm text-muted-foreground">
                        Manually add one contact at a time
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setAddMode('upload')}
                >
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <FileUp className="h-8 w-8 mx-auto text-muted-foreground" />
                      <h3 className="font-semibold">Upload CSV</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload multiple contacts from a CSV file
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : addMode === 'single' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign">Campaign (Optional)</Label>
                  <select
                    id="campaign"
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">-- Add to library (no campaign) --</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to add to your contact library
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name (Optional)</Label>
                  <Input
                    id="name"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    value={singleCompany}
                    onChange={(e) => setSingleCompany(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddSingleContact}
                    disabled={addingContact || !singleEmail || !singleCompany}
                    className="flex-1"
                  >
                    {addingContact ? 'Adding...' : 'Add Contact'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setAddMode(null)}
                  >
                    Back
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="upload-campaign">Campaign (Optional)</Label>
                  <select
                    id="upload-campaign"
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">-- Add to library (no campaign) --</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ContactsUpload
                  campaignId={selectedCampaignId || ''}
                  onUploadComplete={handleUploadComplete}
                />
                <Button 
                  variant="outline"
                  onClick={() => setAddMode(null)}
                  className="w-full"
                >
                  Back
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content with Tabs */}
      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No contacts yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Start building your contact library
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Contact
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Contact Management</CardTitle>
                <CardDescription>
                  Manage your contact library and campaign contacts
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedContacts.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkMoveToLibrary}
                    >
                      Move to Library
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete ({selectedContacts.size})
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="library">
                    Library ({libraryContacts.length})
                  </TabsTrigger>
                  <TabsTrigger value="all">
                    All ({contacts.length})
                  </TabsTrigger>
                  <TabsTrigger value="campaigns">
                    Campaigns ({campaignContacts.length})
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
              
              <TabsContent value="library" className="mt-4">
                <ContactsTable 
                  contacts={filteredContacts} 
                  showCampaign={false}
                  onContactRemoved={fetchAllContacts}
                  selectedContacts={selectedContacts}
                  onSelectionChange={setSelectedContacts}
                />
              </TabsContent>
              
              <TabsContent value="all" className="mt-4">
                <ContactsTable 
                  contacts={filteredContacts} 
                  showCampaign={true}
                  onContactRemoved={fetchAllContacts}
                  selectedContacts={selectedContacts}
                  onSelectionChange={setSelectedContacts}
                />
              </TabsContent>
              
              <TabsContent value="campaigns" className="mt-4">
                <ContactsTable 
                  contacts={filteredContacts} 
                  showCampaign={true}
                  onContactRemoved={fetchAllContacts}
                  selectedContacts={selectedContacts}
                  onSelectionChange={setSelectedContacts}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
