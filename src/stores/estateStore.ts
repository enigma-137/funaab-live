import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';

export interface EstateState { renting: boolean; rent: number; capacity: number; paid_until: string | null; can_prepay: boolean; lodge: boolean; just_evicted: boolean }

interface EstateStore {
  state: EstateState | null;
  busy: boolean;
  error: string | null;
  load: () => Promise<void>;
  act: (fn: 'rent_estate' | 'pay_estate_rent' | 'leave_estate') => Promise<boolean>;
}

const valid = (s: any): s is EstateState => !!s && typeof s.renting === 'boolean';
let reminded = '';

export const useEstateStore = create<EstateStore>((set) => ({
  state: null, busy: false, error: null,
  load: async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('estate_state');
    if (error || !valid(data)) return;
    set({ state: data });
    if (data.just_evicted) toast({ icon: '🧳', text: 'Your estate week ended, so you moved back to your hostel room. Your things came with you.', tone: 'bad', ms: 7000 });
    // One reminder per due date, within a day of the week running out.
    if (data.renting && data.paid_until && Date.parse(data.paid_until) - Date.now() < 86400000 && reminded !== data.paid_until) {
      reminded = data.paid_until;
      toast({ icon: '🏡', text: 'Your Royal Gardens week ends within a day. Renew from Phone → Estate to stay.', tone: 'info', ms: 6000 });
    }
  },
  act: async (fn) => {
    set({ busy: true, error: null });
    try {
      const { data, error } = await supabase.rpc(fn);
      if (error) throw new Error(error.message);
      const { balance, ...state } = data as EstateState & { balance?: number };
      set({ state: state as EstateState });
      if (balance != null) useWalletStore.setState({ balance: Number(balance) });
      return true;
    } catch (e) { set({ error: (e as Error).message }); return false; } finally { set({ busy: false }); }
  },
}));
