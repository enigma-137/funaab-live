import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';
import type { BackgroundId } from '../config/backgrounds';

// Private home background + weekly money from home. The database pays; this only asks.
export interface BackgroundState { chosen: boolean; background?: BackgroundId; title?: string; weekly?: number; hustle_bonus_percent?: number; allowance_ready?: boolean; next_allowance_at?: string }

interface BackgroundStore {
  state: BackgroundState | null;
  busy: boolean;
  error: string | null;
  /** "Maybe later" hides the chooser for this visit only. */
  deferred: boolean;
  load: () => Promise<void>;
  choose: (id: BackgroundId) => Promise<boolean>;
  defer: () => void;
}

const valid = (s: unknown): s is BackgroundState => !!s && typeof (s as BackgroundState).chosen === 'boolean';
let claiming = false;

export const useBackgroundStore = create<BackgroundStore>((set, get) => ({
  state: null, busy: false, error: null, deferred: false,
  load: async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('background_state');
    if (error || !valid(data)) return;
    set({ state: data });
    // Money from home lands every Sunday: collect it automatically the first time you're on.
    if (data.chosen && data.allowance_ready && !claiming) {
      claiming = true;
      try {
        const r = await supabase.rpc('claim_home_allowance');
        if (!r.error && valid(r.data)) {
          const { paid, balance, ...state } = r.data as BackgroundState & { paid: number; balance: number };
          set({ state });
          if (paid > 0) {
            useWalletStore.setState({ balance: Number(balance) });
            toast({ icon: '🏠', text: 'Money from home arrived', amount: paid, tone: 'good', ms: 5000 });
          }
        }
      } finally { claiming = false; }
    }
  },
  choose: async (id) => {
    set({ busy: true, error: null });
    try {
      const { data, error } = await supabase.rpc('choose_background', { p_background: id });
      if (error) throw new Error(error.message);
      const { paid, balance, ...state } = data as BackgroundState & { paid: number; balance: number };
      set({ state });
      useWalletStore.setState({ balance: Number(balance) });
      if (paid > 0) toast({ icon: '🏠', text: 'Resumption money from home', amount: paid, tone: 'good', ms: 5000 });
      return true;
    } catch (e) { set({ error: (e as Error).message }); return false; } finally { set({ busy: false }); }
  },
  defer: () => set({ deferred: true }),
}));
