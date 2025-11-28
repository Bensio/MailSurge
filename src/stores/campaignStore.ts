import { create } from 'zustand';
import type { Campaign, CampaignWithContacts } from '@/types';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface CampaignState {
  campaigns: Campaign[];
  currentCampaign: CampaignWithContacts | null;
  loading: boolean;
  error: string | null;
  fetchCampaigns: () => Promise<void>;
  fetchCampaign: (id: string) => Promise<void>;
  createCampaign: (data: Omit<Campaign, 'id' | 'user_id' | 'created_at' | 'status'>) => Promise<Campaign>;
  updateCampaign: (id: string, data: Partial<Campaign>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  sendCampaign: (id: string, scheduledAt?: string) => Promise<void>;
  testSend: (id: string) => Promise<{ testEmails: string[] }>;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  currentCampaign: null,
  loading: false,
  error: null,

  fetchCampaigns: async () => {
    set({ loading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns`, { headers });
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const campaigns = await response.json();
      set({ campaigns, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
    }
  },

  fetchCampaign: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns/${id}`, { headers });
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch campaign';
        
        // Try to parse error message from response
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response isn't JSON, use status text
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        
        // Handle 404 specifically - don't log these as they're expected
        if (response.status === 404 || errorMessage.toLowerCase().includes('not found')) {
          set({ currentCampaign: null, loading: false, error: 'NOT_FOUND' });
          const notFoundError = new Error('NOT_FOUND');
          // Mark as handled so it doesn't get logged
          (notFoundError as any).isNotFound = true;
          throw notFoundError;
        }
        
        // Other errors
        set({ currentCampaign: null, loading: false, error: errorMessage });
        throw new Error(errorMessage);
      }
      
      const campaign = await response.json();
      set({ currentCampaign: campaign, loading: false, error: null });
    } catch (error) {
      // Only update state if error wasn't already set above
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const currentState = get();
      
      // Skip logging NOT_FOUND errors - they're handled by redirect
      const isNotFound = error instanceof Error && (errorMessage === 'NOT_FOUND' || (error as any).isNotFound);
      
      if (currentState.error === null) {
        if (isNotFound) {
          set({ currentCampaign: null, loading: false, error: 'NOT_FOUND' });
        } else if (!errorMessage.includes('Failed to fetch campaign')) {
          // Don't overwrite with generic error if we already have a specific one
          set({ loading: false, error: errorMessage });
        } else {
          set({ loading: false, error: 'Failed to fetch campaign' });
        }
      }
      throw error; // Re-throw so callers can handle it
    }
  },

  createCampaign: async (data) => {
    logger.debug('campaignStore', 'Creating campaign', {
      name: data.name,
      subject: data.subject,
      body_html_length: data.body_html?.length,
    });
    
    // Optimistic update: create temporary campaign
    const tempId = `temp-${Date.now()}`;
    const tempCampaign: Campaign = {
      id: tempId,
      user_id: '',
      name: data.name,
      subject: data.subject,
      body_html: data.body_html || '',
      body_text: data.body_text || '',
      from_email: data.from_email || null,
      status: 'draft',
      settings: data.settings || { delay: 45, ccEmail: null },
      created_at: new Date().toISOString(),
      sent_at: null,
      completed_at: null,
      design_json: data.design_json || null,
    };
    
    // Optimistically add to list
    set((state) => ({
      campaigns: [...state.campaigns, tempCampaign],
      loading: true,
      error: null,
    }));
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        logger.error('API returned non-JSON response:', { status: response.status, contentType, text: text.substring(0, 200) });
        throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
      }
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          const text = await response.text();
          throw new Error(`Failed to create campaign: ${response.status} ${text.substring(0, 100)}`);
        }
        logger.error('API error creating campaign:', errorData);
        throw new Error(errorData.error || 'Failed to create campaign');
      }
      
      const campaign = await response.json();
      logger.debug('campaignStore', 'Campaign created', { id: campaign.id });
      
      // Replace temp campaign with real one
      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === tempId ? campaign : c)),
        loading: false,
      }));
      return campaign;
    } catch (error) {
      logger.error('Error in createCampaign:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Rollback optimistic update
      set((state) => ({
        campaigns: state.campaigns.filter((c) => c.id !== tempId),
        error: errorMessage,
        loading: false,
      }));
      throw error;
    }
  },

  updateCampaign: async (id: string, data: Partial<Campaign>) => {
    // Optimistic update
    const previousCampaign = get().campaigns.find((c) => c.id === id);
    const previousCurrentCampaign = get().currentCampaign;
    
    set((state) => ({
      campaigns: state.campaigns.map((c) => 
        c.id === id ? { ...c, ...data } : c
      ),
      currentCampaign: state.currentCampaign?.id === id
        ? { ...state.currentCampaign, ...data } as CampaignWithContacts
        : state.currentCampaign,
      loading: true,
      error: null,
    }));
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update campaign');
      const updated = await response.json();
      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === id ? updated : c)),
        currentCampaign: state.currentCampaign?.id === id
          ? { ...state.currentCampaign, ...updated }
          : state.currentCampaign,
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Rollback optimistic update
      set((state) => ({
        campaigns: previousCampaign
          ? state.campaigns.map((c) => (c.id === id ? previousCampaign : c))
          : state.campaigns,
        currentCampaign: previousCurrentCampaign,
        error: errorMessage,
        loading: false,
      }));
      throw error;
    }
  },

  deleteCampaign: async (id: string) => {
    // Optimistic update: store deleted campaign for rollback
    const deletedCampaign = get().campaigns.find((c) => c.id === id);
    const deletedCurrentCampaign = get().currentCampaign?.id === id ? get().currentCampaign : null;
    
    // Optimistically remove
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
      currentCampaign: state.currentCampaign?.id === id ? null : state.currentCampaign,
      loading: true,
      error: null,
    }));
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) throw new Error('Failed to delete campaign');
      set({ loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Rollback optimistic update
      set((state) => ({
        campaigns: deletedCampaign
          ? [...state.campaigns, deletedCampaign]
          : state.campaigns,
        currentCampaign: deletedCurrentCampaign,
        error: errorMessage,
        loading: false,
      }));
      throw error;
    }
  },

  sendCampaign: async (id: string, scheduledAt?: string) => {
    // Optimistic update: set status based on whether it's scheduled
    const previousCampaign = get().campaigns.find((c) => c.id === id);
    const previousCurrentCampaign = get().currentCampaign;
    
    const newStatus = scheduledAt ? 'draft' as const : 'sending' as const;
    
    set((state) => ({
      campaigns: state.campaigns.map((c) => 
        c.id === id ? { ...c, status: newStatus, scheduled_at: scheduledAt || null } : c
      ),
      currentCampaign: state.currentCampaign?.id === id
        ? { ...state.currentCampaign, status: newStatus, scheduled_at: scheduledAt || null }
        : state.currentCampaign,
      loading: true,
      error: null,
    }));
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns/${id}?action=send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ scheduled_at: scheduledAt }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send campaign');
      }
      set({ loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Rollback optimistic update
      set((state) => ({
        campaigns: previousCampaign
          ? state.campaigns.map((c) => (c.id === id ? previousCampaign : c))
          : state.campaigns,
        currentCampaign: previousCurrentCampaign,
        error: errorMessage,
        loading: false,
      }));
      throw error;
    }
  },

  testSend: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns/${id}?action=test-send`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send test email');
      }
      const result = await response.json();
      set({ loading: false });
      return { testEmails: result.testEmails || [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },
}));

