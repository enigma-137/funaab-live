import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { cleanListing, type AdListing } from '../config/adSpaces';
import { useGameStore } from './gameStore';

interface AdStore {
  /** Live listings by spot id. A spot without one is closed / coming soon. */
  listings: Record<string, AdListing>;
  /** Open in the ad sheet: a spot id, or the plaza directory. */
  selected: string | null;
  load: () => Promise<void>;
  open: (id: string) => void;
}

export const useAdStore = create<AdStore>((set) => ({
  listings: {},
  selected: null,
  load: async () => {
    if (!isSupabaseConfigured) return;
    // RLS only returns listings that are live right now.
    const { data, error } = await supabase.from('ad_listings')
      .select('spot_id,business_name,tagline,description,flyer_url,link_url,contact');
    if (error || !Array.isArray(data)) return;
    const listings: Record<string, AdListing> = {};
    for (const row of data) { const l = cleanListing(row); if (l) listings[l.spot_id] = l; }
    set({ listings });
  },
  open: (id) => { set({ selected: id }); useGameStore.getState().setActiveModal('ad_space'); },
}));
