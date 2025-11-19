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
  sendCampaign: (id: string) => Promise<void>;
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

export const useCampaignStore = create<CampaignState>((set) => ({
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
        if (response.status === 404) {
          throw new Error('NOT_FOUND');
        }
        throw new Error('Failed to fetch campaign');
      }
      const campaign = await response.json();
      set({ currentCampaign: campaign, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
    }
  },

  createCampaign: async (data) => {
    logger.debug('campaignStore', 'Creating campaign', {
      name: data.name,
      subject: data.subject,
      body_html_length: data.body_html?.length,
    });
    set({ loading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns/create`, {
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
      set((state) => ({
        campaigns: [...state.campaigns, campaign],
        loading: false,
      }));
      return campaign;
    } catch (error) {
      logger.error('Error in createCampaign:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateCampaign: async (id: string, data: Partial<Campaign>) => {
    set({ loading: true, error: null });
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
      set({ error: errorMessage, loading: false });
    }
  },

  deleteCampaign: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) throw new Error('Failed to delete campaign');
      set((state) => ({
        campaigns: state.campaigns.filter((c) => c.id !== id),
        currentCampaign: state.currentCampaign?.id === id ? null : state.currentCampaign,
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
    }
  },

  sendCampaign: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/campaigns/${id}/send`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send campaign');
      }
      set({ loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
    }
  },
}));

