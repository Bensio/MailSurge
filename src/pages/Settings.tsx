import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getGmailAuthUrl, getConnectedGmailAccounts } from '@/lib/gmail';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { CheckCircle2, XCircle, Trash2, RefreshCw, X, Plus } from 'lucide-react';
import { validateEmail } from '@/lib/utils';
import { SystemStatus } from '@/components/Settings/SystemStatus';
import { EmailAccounts } from '@/components/Settings/EmailAccounts';

export function Settings() {
  const { user, refreshUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [gmailAccounts, setGmailAccounts] = useState<Array<{ email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testEmails, setTestEmails] = useState<string[]>(['']);
  const [savingTestEmail, setSavingTestEmail] = useState(false);

  useEffect(() => {
    // Always refresh user data first to ensure we have latest metadata
    const loadData = async () => {
      await refreshUser();
      // Small delay to ensure state is updated
      setTimeout(() => {
        checkGmailConnection();
        loadTestEmail();
      }, 300);
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const checkGmailConnection = async () => {
    setLoading(true);
    
    // Get fresh user from store (should already be refreshed by useEffect)
    const store = useAuthStore.getState();
    let currentUser = store.user;
    
    // If no user or user seems stale, refresh
    if (!currentUser) {
      await refreshUser();
      currentUser = useAuthStore.getState().user;
    }
    
    if (!currentUser) {
      setLoading(false);
      return;
    }

    let accounts = getConnectedGmailAccounts(currentUser.user_metadata || {});
    
    // If we have tokens but no email, try to fetch it from Gmail API
    if (accounts.length === 0 && currentUser.user_metadata?.gmail_token && currentUser.user_metadata?.gmail_refresh_token) {
      logger.debug('Settings', 'Has tokens but no email - attempting to fetch from Gmail API');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch('/api/campaigns?type=gmail', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            await response.json();
            // Refresh user data to get updated metadata
            await refreshUser();
            // Get updated accounts
            const updatedUser = useAuthStore.getState().user;
            if (updatedUser) {
              accounts = getConnectedGmailAccounts(updatedUser.user_metadata || {});
            }
          } else {
            // Handle non-JSON responses (like 404)
            let errorData;
            try {
              errorData = await response.json();
            } catch {
              errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
            }
            logger.error('Failed to fetch Gmail email:', errorData);
            if (response.status === 404) {
              logger.warn('Endpoint not found - server may need to be restarted');
            }
          }
        }
      } catch (error) {
        logger.error('Error fetching Gmail email:', error);
      }
    }
    
    setGmailAccounts(accounts);
    
    // If we came from OAuth callback but no accounts found, clear success message
    if (searchParams.get('gmail') === 'connected') {
      if (accounts.length > 0) {
        setSuccessMessage('Gmail connected successfully!');
      } else {
        setSuccessMessage(null);
        logger.warn('OAuth callback completed but no accounts found - connection may have failed');
      }
      setSearchParams({}); // Clear the parameter
    }
    
    setLoading(false);
  };

  const handleRemoveAccount = async (email: string) => {
    if (!user || !confirm(`Are you sure you want to remove ${email}?`)) {
      return;
    }

    try {
      const accounts = getConnectedGmailAccounts(user.user_metadata || {});
      const updatedAccounts = accounts.filter(acc => acc.email !== email);
      
      // Update user metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          gmail_accounts: updatedAccounts,
          // Update old format if this was the first account
          gmail_token: updatedAccounts[0]?.access_token || null,
          gmail_refresh_token: updatedAccounts[0]?.refresh_token || null,
          gmail_token_expiry: updatedAccounts[0]?.expiry_date || null,
          gmail_email: updatedAccounts[0]?.email || null,
        },
      });

      if (error) throw error;
      
      // Refresh
      await checkGmailConnection();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove account';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleConnectGmail = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please sign in first');
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId || clientId === 'placeholder-client-id') {
        alert('Google OAuth is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file and restart the server.');
        return;
      }

      const authUrl = getGmailAuthUrl();
      const state = session.access_token;
      window.location.href = `${authUrl}&state=${encodeURIComponent(state)}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect Gmail';
      alert(`Error: ${errorMessage}`);
    }
  };

  const loadTestEmail = () => {
    const store = useAuthStore.getState();
    const currentUser = store.user;
    // Support both old format (single test_email) and new format (test_emails array)
    if (currentUser?.user_metadata?.test_emails && Array.isArray(currentUser.user_metadata.test_emails)) {
      setTestEmails(currentUser.user_metadata.test_emails.length > 0 ? currentUser.user_metadata.test_emails : ['']);
    } else if (currentUser?.user_metadata?.test_email) {
      // Migrate old single email to array format
      setTestEmails([currentUser.user_metadata.test_email]);
    } else {
      setTestEmails(['']);
    }
  };

  const handleAddTestEmail = () => {
    setTestEmails([...testEmails, '']);
  };

  const handleRemoveTestEmail = (index: number) => {
    if (testEmails.length > 1) {
      setTestEmails(testEmails.filter((_, i) => i !== index));
    }
  };

  const handleTestEmailChange = (index: number, value: string) => {
    const updated = [...testEmails];
    updated[index] = value;
    setTestEmails(updated);
  };

  const handleSaveTestEmail = async () => {
    if (!user) return;

    // Filter out empty emails and validate
    const validEmails = testEmails.filter(email => email.trim() !== '');
    
    for (const email of validEmails) {
      if (!validateEmail(email)) {
        alert(`Please enter a valid email address: ${email}`);
        return;
      }
    }

    if (validEmails.length === 0) {
      alert('Please add at least one test email address');
      return;
    }

    setSavingTestEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          test_emails: validEmails,
          // Keep old format for backward compatibility
          test_email: validEmails[0] || null,
        },
      });

      if (error) throw error;

      await refreshUser();
      alert(`Test email${validEmails.length > 1 ? 's' : ''} saved successfully!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save test emails';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSavingTestEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and integrations</p>
      </div>

      <SystemStatus />

      <Card>
        <CardHeader>
          <CardTitle>Gmail Integration (OAuth)</CardTitle>
          <CardDescription>
            Connect your Gmail account to send emails using your own Gmail address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              {successMessage}
            </div>
          )}
          
          {loading ? (
            <div className="text-muted-foreground">Checking connection...</div>
          ) : (
            <>
              {gmailAccounts.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">{gmailAccounts.length} Gmail account{gmailAccounts.length !== 1 ? 's' : ''} connected</span>
                  </div>
                  <div className="space-y-2">
                    {gmailAccounts.map((account) => (
                      <div key={account.email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <span className="text-sm font-medium">{account.email}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAccount(account.email)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Emails will be sent from your connected Gmail account. Add more accounts or connect custom domains in Email Accounts section.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-yellow-500" />
                    <span>No Gmail account connected</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connect your Gmail to send from your own address. You can also add custom domain email accounts below.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleConnectGmail} 
                  disabled={!import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID === 'placeholder-client-id'}
                >
                  {gmailAccounts.length > 0 ? 'Add Another Gmail Account' : 'Connect Gmail'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={checkGmailConnection}
                  disabled={loading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {(!import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID === 'placeholder-client-id') && (
                <p className="text-xs text-muted-foreground">
                  Configure Google OAuth credentials in <code className="bg-gray-100 px-1 rounded">.env</code> to enable Gmail connection.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <EmailAccounts />

      <Card>
        <CardHeader>
          <CardTitle>Test Emails</CardTitle>
          <CardDescription>
            Add email addresses to receive test sends before sending campaigns to your contacts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Test Email Addresses</Label>
            {testEmails.map((email, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={email}
                  onChange={(e) => handleTestEmailChange(index, e.target.value)}
                  className="max-w-md"
                />
                {testEmails.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTestEmail(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddTestEmail}
              className="w-fit"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Another Email
            </Button>
            <p className="text-xs text-muted-foreground">
              These emails will receive test sends when you click "Test Send" on a campaign
            </p>
          </div>
          <Button 
            onClick={handleSaveTestEmail} 
            disabled={savingTestEmail}
          >
            {savingTestEmail ? 'Saving...' : 'Save Test Emails'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MailSurge Account</CardTitle>
          <CardDescription>
            Your MailSurge account information (separate from Gmail integration)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Email:</span>
              <span className="ml-2">{user?.email}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">User ID:</span>
              <span className="ml-2 font-mono text-xs">{user?.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

