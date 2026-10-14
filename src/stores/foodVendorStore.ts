import { create } from 'zustand';
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { useWalletStore } from './walletStore';
import { useGameStore } from './gameStore';
import { holdPurchasedItem } from '../game/player/holdItem';
import { toast as pushToast } from './toastStore';
import { FOOD_VENDORS, getVendorStatus, nextVendorTransition, type FoodVendorId, type VendorStatus } from '../config/foodVendors';

interface FoodVendorStore {
  /** server − device clock (ms). Display uses the server clock, so a wrong phone clock can't fake hours. */
  clockOffset: number;
  activeVendor: FoodVendorId | null;
  buying: string | null;
  error: string | null;
  syncClock: () => Promise<void>;
  open: (vendor: FoodVendorId) => void;
  buy: (vendor: FoodVendorId, itemId: string) => Promise<boolean>;
}

export const vendorNow = () => Date.now() + useFoodVendorStore.getState().clockOffset;

/** Opens the menu only while the vendor is open (server clock). A closed stall just shows its hours. */
export function openFoodVendor(vendorId: string | undefined) {
  if (!vendorId || !(vendorId in FOOD_VENDORS)) return;
  const id = vendorId as FoodVendorId;
  if (!getVendorStatus(id, vendorNow()).isOpen) return;
  useFoodVendorStore.getState().open(id);
  useGameStore.getState().setActiveModal('food_vendor');
}

export const useFoodVendorStore = create<FoodVendorStore>((set, get) => ({
  clockOffset: 0, activeVendor: null, buying: null, error: null,
  syncClock: async () => {
    if (!isSupabaseConfigured) return;
    const sent = Date.now();
    const { data, error } = await supabase.rpc('food_vendor_status');
    if (error || !data?.server_now) return;
    // Midpoint of the round trip approximates when the server read its clock.
    set({ clockOffset: Date.parse(data.server_now) - (sent + (Date.now() - sent) / 2) });
  },
  open: (vendor) => set({ activeVendor: vendor, error: null }),
  buy: async (vendor, itemId) => {
    if (get().buying) return false;
    const user = useAuthStore.getState().user;
    if (!user || !isSupabaseConfigured) { set({ error: 'Sign in to buy food.' }); return false; }
    set({ buying: itemId, error: null });
    try {
      // Only ids go to the server; it decides price and opening hours.
      const { data, error } = await supabase.rpc('food_vendor_purchase', { p_vendor: vendor, p_item: itemId, p_request: crypto.randomUUID() });
      if (error) throw new Error(error.message);
      useWalletStore.setState({ balance: Number(data.balance) });
      pushToast({ icon: '🛍️', text: `${data.name} bought`, amount: -Number(data.price), tone: 'good' });
      holdPurchasedItem(itemId);
      void useWalletStore.getState().loadWallet(user.id); // ledger + inventory
      return true;
    } catch (e) {
      set({ error: (e as Error).message || 'Purchase failed' });
      return false;
    } finally { set({ buying: null }); }
  },
}));

/** Live vendor status on the server clock; re-renders exactly at the next open/close instant. */
export function useVendorStatus(vendor: FoodVendorId): VendorStatus {
  const offset = useFoodVendorStore((s) => s.clockOffset);
  const [status, setStatus] = useState(() => getVendorStatus(vendor, Date.now() + offset));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = Date.now() + useFoodVendorStore.getState().clockOffset;
      setStatus(getVendorStatus(vendor, now));
      // Wake at the next transition, but at least every minute (sleeping tabs, clock drift).
      timer = setTimeout(tick, Math.min(60000, Math.max(250, nextVendorTransition(now) - now + 50)));
    };
    tick();
    return () => clearTimeout(timer);
  }, [vendor, offset]);
  return status;
}
