import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { X, Plus } from 'lucide-react';
import { validateEmail } from '@/lib/utils';
import { SystemStatus } from '@/components/Settings/SystemStatus';
import { EmailAccounts } from '@/components/Settings/EmailAccounts';

export function Settings() {
  const { user, refreshUser } = useAuthStore();
  const [testEmails, setTestEmails] = useState<string[]>(['']);
  const [savingTestEmail, setSavingTestEmail] = useState(false);

  useEffect(() => {
    loadTestEmail();
  }, []);

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
    <div className="space-y-6 max-w-4xl">
      <div className="pb-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1.5">Manage your account and integrations</p>
      </div>

      <SystemStatus />

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
            <Label className="text-sm font-medium">Test Email Addresses</Label>
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
            <p className="text-xs text-muted-foreground pt-1">
              These emails will receive test sends when you click "Test Send" on a campaign
            </p>
          </div>
          <Button 
            onClick={handleSaveTestEmail} 
            disabled={savingTestEmail}
            className="mt-2"
          >
            {savingTestEmail ? 'Saving...' : 'Save Test Emails'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MailSurge Account</CardTitle>
          <CardDescription>
            Your MailSurge account information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-sm font-medium text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-sm font-medium text-muted-foreground">User ID</span>
              <span className="text-xs font-mono text-muted-foreground">{user?.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

