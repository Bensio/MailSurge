import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCampaignStore } from '@/stores/campaignStore';
import { useAuthStore } from '@/stores/authStore';
import { CreateCampaignSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmailEditorWrapper, type EmailEditorRef } from '@/components/editor/EmailEditor';
import { getConnectedGmailAccounts } from '@/lib/gmail';
import { logger } from '@/lib/logger';
import { Save } from 'lucide-react';

export function NewCampaign() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = !!id;
  const { createCampaign, updateCampaign, fetchCampaign, loading } = useCampaignStore();
  const { user, refreshUser } = useAuthStore();
  const [step, setStep] = useState<'details' | 'editor'>('details');
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body_html: '',
    body_text: '',
    from_email: '',
    settings: {
      delay: 45,
      ccEmail: '',
    },
  });
  const [delayInputValue, setDelayInputValue] = useState<string>('45');

  // Sync delayInputValue with formData when formData changes externally
  useEffect(() => {
    setDelayInputValue(String(formData.settings.delay || 45));
  }, [formData.settings.delay]);
  const [design, setDesign] = useState<unknown>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editorRef = useRef<EmailEditorRef>(null);
  const exportedHtmlRef = useRef<{ html: string; text: string } | null>(null);
  const [gmailAccounts, setGmailAccounts] = useState<Array<{ email: string }>>([]);
  const [loadingCampaign, setLoadingCampaign] = useState(false);

  // Load campaign data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      setLoadingCampaign(true);
      fetchCampaign(id)
        .then(() => {
          const campaign = useCampaignStore.getState().currentCampaign;
          if (campaign) {
            setFormData({
              name: campaign.name,
              subject: campaign.subject,
              body_html: campaign.body_html,
              body_text: campaign.body_text,
              from_email: campaign.from_email || '',
              settings: {
                delay: campaign.settings?.delay || 45,
                ccEmail: campaign.settings?.ccEmail || '',
              },
            });
            setDelayInputValue(String(campaign.settings?.delay || 45));
            if (campaign.design_json) {
              setDesign(campaign.design_json);
            }
          }
        })
        .catch((err) => {
          logger.error('Error loading campaign for edit:', err);
          navigate('/campaigns');
        })
        .finally(() => {
          setLoadingCampaign(false);
        });
    }
  }, [isEditMode, id, fetchCampaign, navigate]);

  useEffect(() => {
    // Refresh user data on mount to ensure we have latest metadata
    const loadAccounts = async () => {
      await refreshUser();
      // Wait a bit for state to update, then check accounts
      setTimeout(() => {
        // Get fresh user from store
        const store = useAuthStore.getState();
        if (store.user?.user_metadata) {
          const accounts = getConnectedGmailAccounts(store.user.user_metadata);
          setGmailAccounts(accounts);
          // Set default from_email to first account if available and not in edit mode
          if (accounts.length > 0 && !formData.from_email && !isEditMode) {
            const firstAccount = accounts[0];
            if (firstAccount?.email) {
              setFormData(prev => ({ ...prev, from_email: firstAccount.email }));
            }
          }
        }
      }, 200);
    };
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshUser]); // Only run on mount

  // Also update when user changes
  useEffect(() => {
    if (user?.user_metadata) {
      const accounts = getConnectedGmailAccounts(user.user_metadata);
      setGmailAccounts(accounts);
      
      // Clear from_email if it's invalid (doesn't contain '@')
      if (formData.from_email && !formData.from_email.includes('@')) {
        const firstAccount = accounts.length > 0 ? accounts[0] : null;
        setFormData(prev => ({ ...prev, from_email: firstAccount?.email || '' }));
      } else if (accounts.length > 0 && !formData.from_email) {
        // Set default from_email to first account if available
        const firstAccount = accounts[0];
        if (firstAccount?.email) {
          setFormData(prev => ({ ...prev, from_email: firstAccount.email }));
        }
      } else if (accounts.length === 0) {
        // Clear from_email if no valid accounts
        setFormData(prev => ({ ...prev, from_email: '' }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleInputChange = (field: string, value: string | number) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (parent === 'settings') {
        setFormData((prev) => {
          if (child === 'delay') {
            // Ensure delay is always a number
            const delayValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseInt(value, 10) : prev.settings.delay);
            return {
              ...prev,
              settings: {
                ...prev.settings,
                delay: isNaN(delayValue) ? prev.settings.delay : delayValue,
                ccEmail: prev.settings.ccEmail,
              },
            };
          } else if (child === 'ccEmail') {
            return {
              ...prev,
              settings: {
                ...prev.settings,
                delay: prev.settings.delay,
                ccEmail: typeof value === 'string' ? value : prev.settings.ccEmail,
              },
            };
          }
          return prev;
        });
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSaveDesign = (savedData: unknown) => {
    // Extract HTML and text from the exported data
    if (savedData && typeof savedData === 'object') {
      const data = savedData as { design?: unknown; html?: string };
      
      // Store the design JSON for future editing
      if (data.design) {
        setDesign(data.design);
      }
      
      if (data.html) {
        logger.debug('NewCampaign', 'Saving exported HTML', { length: data.html.length });
        // Extract plain text from HTML (simple version)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.html;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        // Store in ref for immediate access
        exportedHtmlRef.current = {
          html: data.html,
          text: plainText,
        };
        
        setFormData((prev) => ({
          ...prev,
          body_html: data.html || prev.body_html || '<p>Email content</p>',
          body_text: plainText || prev.body_text || 'Email content',
        }));
      }
    }
  };

  const handleNext = () => {
    // Basic validation - just check required fields
    if (!formData.name || !formData.subject) {
      const newErrors: Record<string, string> = {};
      if (!formData.name) {
        newErrors.name = 'Campaign name is required';
      }
      if (!formData.subject) {
        newErrors.subject = 'Email subject is required';
      }
      setErrors(newErrors);
      return;
    }

    // Clear errors and proceed to editor
    setErrors({});
    setStep('editor');
  };

  const handleCreate = async () => {
    try {
      setErrors({});
      logger.debug('NewCampaign', 'Creating campaign');
      
      // Try to export the design from the editor
      let exportAttempted = false;
      if (editorRef.current) {
        try {
          editorRef.current.exportDesign();
          exportAttempted = true;
          // Wait longer for the export callback to update formData
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          logger.warn('Failed to export from editor:', error);
        }
      }
      
      // Also try window export function as fallback
      if (!exportAttempted) {
        const exportFunction = (window as unknown as { exportEmailDesign?: () => void }).exportEmailDesign;
        if (exportFunction) {
          try {
            exportFunction();
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            logger.warn('Failed to export via window function:', error);
          }
        }
      }

      // Use exported HTML from ref if available (captured synchronously in callback)
      // Otherwise fall back to formData (which may not be updated yet due to async setState)
      const exportedData = exportedHtmlRef.current;
      const finalHtml = exportedData?.html && exportedData.html.length > 100
        ? exportedData.html
        : (formData.body_html && formData.body_html.length > 100 && formData.body_html !== '<p>Placeholder</p>'
          ? formData.body_html
          : '<p>Email content - design your email in the editor</p>');
      
      const finalText = exportedData?.text && exportedData.text.length > 50
        ? exportedData.text
        : (formData.body_text && formData.body_text.length > 50 && formData.body_text !== 'Placeholder'
          ? formData.body_text
          : 'Email content - design your email in the editor');

      // Clean up settings - convert empty string to null for ccEmail
      const cleanedSettings = {
        delay: Math.max(1, Math.min(300, formData.settings?.delay || 45)), // Ensure delay is between 1 and 300
        ccEmail: formData.settings?.ccEmail === '' ? null : formData.settings?.ccEmail || null,
      };

      const validationData = {
        ...formData,
        body_html: finalHtml,
        body_text: finalText,
        settings: cleanedSettings,
      };
      
      const validation = CreateCampaignSchema.safeParse(validationData);
      
      if (!validation.success) {
        logger.error('Validation failed:', validation.error.errors);
        const newErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }

      const campaignData = {
        ...validation.data,
        settings: validation.data.settings || { delay: 45, ccEmail: null },
        design_json: design || null, // Include design JSON for visual editing
      };
      
      if (isEditMode && id) {
        // Update existing campaign
        logger.debug('NewCampaign', 'Updating campaign', {
          id,
          name: campaignData.name,
          subject: campaignData.subject,
        });
        await updateCampaign(id, campaignData);
        logger.debug('NewCampaign', 'Campaign updated', { id });
        navigate(`/campaigns/${id}`);
      } else {
        // Create new campaign
        logger.debug('NewCampaign', 'Creating campaign', {
          name: campaignData.name,
          subject: campaignData.subject,
          body_html_length: campaignData.body_html?.length,
        });
        const campaign = await createCampaign(campaignData);
        logger.debug('NewCampaign', 'Campaign created', { id: campaign.id });
        navigate(`/campaigns/${campaign.id}`);
      }
    } catch (error) {
      logger.error('Error creating campaign:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create campaign';
      setErrors({ general: errorMessage });
    }
  };

  if (loadingCampaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading campaign...</div>
      </div>
    );
  }

  if (step === 'editor') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{isEditMode ? 'Edit Email Design' : 'Design Email'}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('details')}>
              Back
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={loading}
              className="min-w-[150px]"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Campaign')}
            </Button>
            {errors.general && (
              <div className="text-sm text-destructive mt-2">{errors.general}</div>
            )}
            {errors.design && (
              <div className="text-sm text-destructive mt-2">{errors.design}</div>
            )}
          </div>
        </div>
        <EmailEditorWrapper 
          ref={editorRef} 
          onSave={handleSaveDesign} 
          initialDesign={design || undefined}
        />
      </div>
    );
  }

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{isEditMode ? 'Edit Campaign' : 'New Campaign'}</h1>
          <p className="text-muted-foreground">{isEditMode ? 'Edit your email campaign' : 'Create a new email campaign'}</p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>Enter basic information about your campaign</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.general && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {errors.general}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Q4 Product Launch"
              required
            />
            {errors.name && (
              <div className="text-sm text-destructive">{errors.name}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder="Exciting news from {{company}}"
              required
            />
            {errors.subject && (
              <div className="text-sm text-destructive">{errors.subject}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delay">Delay Between Emails (seconds)</Label>
            <Input
              id="delay"
              type="number"
              min="1"
              max="300"
              value={delayInputValue}
              onChange={(e) => {
                // Allow free typing - just update the input value
                setDelayInputValue(e.target.value);
              }}
              onBlur={(e) => {
                // Validate and update formData when user finishes typing
                const inputValue = e.target.value.trim();
                if (inputValue === '') {
                  // If empty, set to default
                  const defaultValue = 45;
                  setDelayInputValue(String(defaultValue));
                  handleInputChange('settings.delay', defaultValue);
                  return;
                }
                const delayValue = parseInt(inputValue, 10);
                if (!isNaN(delayValue) && delayValue >= 1) {
                  // Clamp to valid range (1-300)
                  const clampedValue = Math.max(1, Math.min(300, delayValue));
                  setDelayInputValue(String(clampedValue));
                  handleInputChange('settings.delay', clampedValue);
                } else {
                  // If invalid, reset to default
                  const defaultValue = 45;
                  setDelayInputValue(String(defaultValue));
                  handleInputChange('settings.delay', defaultValue);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Must be between 1 and 300 seconds
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ccEmail">CC Email (optional)</Label>
            <Input
              id="ccEmail"
              type="email"
              value={formData.settings.ccEmail}
              onChange={(e) => handleInputChange('settings.ccEmail', e.target.value)}
              placeholder="cc@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="from_email">From Email *</Label>
            {gmailAccounts.length > 0 ? (
              <select
                id="from_email"
                value={formData.from_email}
                onChange={(e) => handleInputChange('from_email', e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
                required
              >
                {gmailAccounts.map((account) => (
                  <option key={account.email} value={account.email}>
                    {account.email}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                No Gmail accounts connected. Please connect a Gmail account in Settings first.
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Select which email address to send this campaign from
            </p>
          </div>

          <Button onClick={handleNext} className="w-full" disabled={!formData.from_email || gmailAccounts.length === 0}>
            Next: Design Email
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

