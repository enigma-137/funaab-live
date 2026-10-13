import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';

export interface LodgeState { renting: boolean; rent: number; grace_days: number; capacity: number; paid_until: string | null; grace_until: string | null; overdue: boolean; can_prepay: boolean; just_evicted: boolean }

interface LodgeStore {
  state: LodgeState | null;
  busy: boolean;
  error: string | null;
  load: () => Promise<void>;
  act: (fn: 'rent_lodge' | 'pay_lodge_rent' | 'leave_lodge') => Promise<boolean>;
}

const valid = (s: any): s is LodgeState => !!s && typeof s.renting === 'boolean';
let reminded = '';

export const useLodgeStore = create<LodgeStore>((set) => ({
  state: null, busy: false, error: null,
  load: async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('lodge_state');
    if (error || !valid(data)) return;
    set({ state: data });
    if (data.just_evicted) toast({ icon: '🧳', text: 'Lodge rent went unpaid, so you moved back to your hostel room. Your things came with you.', tone: 'bad', ms: 7000 });
    // One reminder per due date when rent is due within a day (or already late).
    const dueSoon = data.renting && data.paid_until && Date.parse(data.paid_until) - Date.now() < 86400000;
    if (dueSoon && reminded !== data.paid_until) {
      reminded = data.paid_until!;
      toast({ icon: '🏠', text: data.overdue ? 'Lodge rent is overdue. Pay before the grace period ends.' : 'Lodge rent is due within a day.', tone: data.overdue ? 'bad' : 'info', ms: 6000 });
    }
  },
  act: async (fn) => {
    set({ busy: true, error: null });
    try {
      const { data, error } = await supabase.rpc(fn);
      if (error) throw new Error(error.message);
      const { balance, ...state } = data as LodgeState & { balance?: number };
      set({ state: state as LodgeState });
      if (balance != null) useWalletStore.setState({ balance: Number(balance) });
      return true;
    } catch (e) { set({ error: (e as Error).message }); return false; } finally { set({ busy: false }); }
  },
}));
