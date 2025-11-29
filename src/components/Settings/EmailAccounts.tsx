import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  RefreshCw, 
  Mail, 
  Globe, 
  Loader2,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getGmailAuthUrl } from '@/lib/gmail';

interface EmailAccount {
  id: string;
  account_type: 'google_oauth' | 'microsoft_oauth' | 'esp_domain';
  email_address: string;
  display_name?: string;
  is_default: boolean;
  domain_name?: string;
  domain_verified?: boolean;
  esp_provider?: 'sendgrid' | 'postmark' | 'ses' | 'mailgun';
  created_at: string;
}

export function EmailAccounts() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<'google' | 'microsoft' | 'esp'>('google');
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    espProvider: 'sendgrid' as 'sendgrid' | 'postmark' | 'ses' | 'mailgun',
    espApiKey: '',
    domainName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[EmailAccounts] Session error:', sessionError);
        // If refresh token is invalid, user needs to sign in again
        if (sessionError.message?.includes('Refresh Token')) {
          toast({
            title: 'Session Expired',
            description: 'Please sign in again to continue.',
            variant: 'destructive',
          });
          // Redirect to login or refresh
          window.location.href = '/login';
          return;
        }
        throw new Error(sessionError.message || 'Not authenticated');
      }

      if (!session) {
        throw new Error('Not authenticated. Please sign in.');
      }

      const response = await fetch('/api/campaigns?type=email-accounts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAccounts(data || []);
    } catch (error) {
      console.error('[EmailAccounts] Error loading accounts:', error);
      // Don't show toast for session errors (already handled above)
      if (!(error instanceof Error && error.message.includes('Session'))) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load email accounts',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId || clientId === 'placeholder-client-id') {
        toast({
          title: 'Configuration Error',
          description: 'Google OAuth is not configured. Please add VITE_GOOGLE_CLIENT_ID to your environment variables.',
          variant: 'destructive',
        });
        return;
      }

      const authUrl = getGmailAuthUrl();
      const state = session.access_token;
      window.location.href = `${authUrl}&state=${encodeURIComponent(state)}`;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to connect Google account',
        variant: 'destructive',
      });
    }
  };

  const handleAddESPAccount = async () => {
    if (!user) return;

    if (!formData.email || !formData.espApiKey || !formData.domainName) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/campaigns?type=email-accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_type: 'esp_domain',
          email_address: formData.email,
          display_name: formData.displayName || formData.email,
          esp_provider: formData.espProvider,
          esp_api_key: formData.espApiKey,
          domain_name: formData.domainName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add ESP account');
      }

      toast({
        title: 'Success',
        description: 'ESP account added successfully. Please verify your domain.',
      });

      setShowAddForm(false);
      setFormData({
        email: '',
        displayName: '',
        espProvider: 'sendgrid',
        espApiKey: '',
        domainName: '',
      });
      await loadAccounts();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add ESP account',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this email account?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/campaigns?type=email-accounts&id=${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }

      toast({
        title: 'Success',
        description: 'Email account deleted successfully',
      });

      await loadAccounts();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete account',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (accountId: string) => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/campaigns?type=email-accounts&id=${accountId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_default: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set default account');
      }

      toast({
        title: 'Success',
        description: 'Default account updated',
      });

      await loadAccounts();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to set default account',
        variant: 'destructive',
      });
    }
  };

  const handleVerifyDomain = async (accountId: string) => {
    setVerifyingDomain(accountId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/campaigns?type=verify-domain&account_id=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify domain');
      }

      const verification = await response.json();
      
      if (verification.ownership && verification.spf.valid && verification.dkim.valid && verification.dmarc.valid) {
        toast({
          title: 'Success',
          description: 'Domain verified successfully!',
        });
      } else {
        const issues = [];
        if (!verification.ownership) issues.push('Ownership TXT record');
        if (!verification.spf.valid) issues.push('SPF record');
        if (!verification.dkim.valid) issues.push('DKIM record');
        if (!verification.dmarc.valid) issues.push('DMARC record');
        
        toast({
          title: 'Domain Verification Incomplete',
          description: `Missing or invalid: ${issues.join(', ')}. Please check your DNS settings.`,
          variant: 'destructive',
        });
      }

      await loadAccounts();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to verify domain',
        variant: 'destructive',
      });
    } finally {
      setVerifyingDomain(null);
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'google_oauth':
        return 'Google Workspace';
      case 'microsoft_oauth':
        return 'Microsoft 365';
      case 'esp_domain':
        return 'Custom Domain';
      default:
        return type;
    }
  };

  const getProviderLabel = (provider?: string) => {
    switch (provider) {
      case 'sendgrid':
        return 'SendGrid';
      case 'postmark':
        return 'Postmark';
      case 'ses':
        return 'AWS SES';
      case 'mailgun':
        return 'Mailgun';
      default:
        return provider || 'Unknown';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Accounts</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading email accounts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Accounts</CardTitle>
        <CardDescription>
          Manage your email accounts for sending campaigns. Connect Google Workspace, Microsoft 365, or custom domains.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No email accounts configured</p>
            <p className="text-sm">Add an account to start sending campaigns</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="p-4 border rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{account.email_address}</span>
                      {account.is_default && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <span>Type: {getAccountTypeLabel(account.account_type)}</span>
                        {account.esp_provider && (
                          <span>• Provider: {getProviderLabel(account.esp_provider)}</span>
                        )}
                      </div>
                      {account.domain_name && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-3 w-3" />
                          <span>Domain: {account.domain_name}</span>
                          {account.domain_verified ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!account.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(account.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    {account.account_type === 'esp_domain' && !account.domain_verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyDomain(account.id)}
                        disabled={verifyingDomain === account.id}
                      >
                        {verifyingDomain === account.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Verify Domain'
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAccount(account.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!showAddForm ? (
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleConnectGoogle} variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              Connect Google Workspace
            </Button>
            <Button 
              onClick={() => {
                setFormType('esp');
                setShowAddForm(true);
              }}
              variant="outline"
            >
              <Globe className="mr-2 h-4 w-4" />
              Add Custom Domain (ESP)
            </Button>
            <Button
              variant="outline"
              onClick={loadAccounts}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {formType === 'google' && 'Connect Google Workspace'}
                {formType === 'microsoft' && 'Connect Microsoft 365'}
                {formType === 'esp' && 'Add Custom Domain (ESP)'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({
                    email: '',
                    displayName: '',
                    espProvider: 'sendgrid',
                    espApiKey: '',
                    domainName: '',
                  });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {formType === 'esp' && (
              <>
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    placeholder="noreply@yourdomain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    placeholder="Your Company Name"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>ESP Provider *</Label>
                  <Select
                    value={formData.espProvider}
                    onValueChange={(value: 'sendgrid' | 'postmark' | 'ses' | 'mailgun') =>
                      setFormData({ ...formData, espProvider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="postmark">Postmark</SelectItem>
                      <SelectItem value="ses">AWS SES</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ESP API Key *</Label>
                  <Input
                    type="password"
                    placeholder="Enter your ESP API key"
                    value={formData.espApiKey}
                    onChange={(e) => setFormData({ ...formData, espApiKey: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your API key is encrypted and stored securely
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Domain Name *</Label>
                  <Input
                    placeholder="yourdomain.com"
                    value={formData.domainName}
                    onChange={(e) => setFormData({ ...formData, domainName: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The domain you'll be sending emails from
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddESPAccount}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Account'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <p className="font-medium mb-1">After adding your account:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Add the required DNS records (SPF, DKIM, DMARC) to your domain</li>
                    <li>Click "Verify Domain" to check if DNS records are configured correctly</li>
                    <li>Once verified, you can use this account to send campaigns</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

