import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { SugPhase } from '../config/sug';
import { useGameStore } from './gameStore';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';

// Mirror of sug_state() (migration 034). The database runs the election.
export interface SugCandidate { user_id: string; username: string; college: string; level: number; manifesto: string; votes?: number }
export interface SugState {
  cycle: number;
  phase: SugPhase;
  my_level: number;
  am_candidate: boolean;
  my_vote: string | null;
  candidates: SugCandidate[];
  last_results: SugCandidate[] | null;
  president: { user_id: string; username: string; college: string; cycle: number } | null;
  announcement: { body: string; created_at: string; username: string } | null;
  can_announce: boolean;
}

interface SugStore {
  state: SugState | null;
  busy: boolean;
  error: string | null;
  load: () => Promise<void>;
  open: () => void;
  run: (fn: string, args?: Record<string, unknown>, done?: string) => Promise<boolean>;
}

export const useSugStore = create<SugStore>((set, get) => ({
  state: null,
  busy: false,
  error: null,
  load: async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase.rpc('sug_state');
      if (!error && data && Array.isArray(data.candidates)) set({ state: data as SugState });
    } catch { /* Older databases without migration 034 just hide the election. */ }
  },
  open: () => { set({ error: null }); void get().load(); useGameStore.getState().setActiveModal('sug'); },
  run: async (fn, args, done) => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw new Error(error.message);
      if (data && typeof data === 'object' && 'balance' in data) useWalletStore.setState({ balance: Number(data.balance) });
      if (done) toast({ icon: '🗳️', text: done, tone: 'good' });
      await get().load();
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    } finally { set({ busy: false }); }
  },
}));
