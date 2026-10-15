import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';
import { CAR_HOME, CAR_MODELS, FUEL, isCarId } from '../config/cars';
import { useEstateStore } from './estateStore';
import { networkManager } from '../game/multiplayer/networkManager';

type Point = [number, number, number];
export interface ParkedCar { car: string; position: Point; rotation: number }

interface CarStore {
  /** Fuel in litres per owned car (from the database). */
  fuel: Record<string, number>;
  loaded: boolean;
  /** The car you're driving right now, if any. */
  driving: string | null;
  /** Where your car is parked (one car out at a time). */
  parked: ParkedCar | null;
  busy: boolean;
  error: string | null;
  load: () => Promise<void>;
  /** Put a car at its home car park, ready to walk to. */
  takeOut: (car: string, estate: boolean) => void;
  enter: () => void;
  park: (position: Point, rotation: number) => void;
  buyFuel: (car: string, litres: number) => Promise<boolean>;
  /** Count metres driven; reports burnt fuel to the database in small steps. */
  drove: (metres: number) => void;
  /** A lift in someone else's car: their connection id and your seat. */
  ride: { driver: string; seat: number } | null;
  /** Camera while in a car: behind it, or from your seat. */
  view: 'outside' | 'inside';
  toggleView: () => void;
  askRide: (driver: string) => void;
  leaveRide: () => void;
  rideResult: (r: { ok: boolean; driver?: string; seat?: number; error?: string }) => void;
  rideEnded: (reason: string) => void;
}

const storeKey = 'funaab:parked-car:v1';
const readParked = (): ParkedCar | null => {
  try { const p = JSON.parse(localStorage.getItem(storeKey) || 'null'); return p && isCarId(p.car) && Array.isArray(p.position) ? p : null; } catch { return null; }
};
const saveParked = (p: ParkedCar | null) => { try { if (p) localStorage.setItem(storeKey, JSON.stringify(p)); else localStorage.removeItem(storeKey); } catch { /* private mode */ } };

let pendingBurn = 0;
let reporting = false;

export const useCarStore = create<CarStore>((set, get) => ({
  fuel: {}, loaded: false, driving: null, parked: readParked(), busy: false, error: null,
  ride: null, view: 'outside',
  toggleView: () => set({ view: get().view === 'inside' ? 'outside' : 'inside' }),
  askRide: (driver) => { if (!get().driving && !get().ride) networkManager.carRide(driver); },
  leaveRide: () => { if (!get().ride) return; networkManager.carRideLeave(); set({ ride: null, view: 'outside' }); window.dispatchEvent(new Event('car-ride-exit')); },
  rideResult: (r) => {
    if (r.ok && r.driver != null && r.seat != null) { set({ ride: { driver: r.driver, seat: r.seat } }); toast({ icon: '🚗', text: 'You hopped in. Tap Get out to leave.', tone: 'info' }); }
    else toast({ icon: '🚗', text: r.error || 'You could not get in.', tone: 'bad' });
  },
  rideEnded: (reason) => {
    if (!get().ride) return;
    set({ ride: null, view: 'outside' });
    window.dispatchEvent(new Event('car-ride-exit'));
    toast({ icon: '🚗', text: reason === 'driver_left' ? 'The driver left, so you got out.' : 'The driver parked. You got out.', tone: 'info' });
  },
  load: async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('car_garage');
    if (error || !data) return;
    const fuel: Record<string, number> = {};
    for (const c of (data as { cars: Array<{ car: string; litres: number }> }).cars) fuel[c.car] = Number(c.litres);
    set({ fuel, loaded: true });
    // A parked car you no longer own disappears.
    const p = get().parked;
    if (p && !(p.car in fuel)) { saveParked(null); set({ parked: null }); }
    // Own a car but none is out: park it at home (the estate if you rent there) so you can see it.
    const first = Object.keys(fuel).find((id) => CAR_MODELS[id]);
    if (!get().parked && !get().driving && first) {
      if (!useEstateStore.getState().state) await useEstateStore.getState().load();
      const estate = !!useEstateStore.getState().state?.renting;
      get().takeOut(first, estate);
      toast({ icon: '🚗', text: `Your ${CAR_MODELS[first].name} is parked at ${estate ? 'the Royal Gardens Estate car park' : 'the campus car park'}. Phone → Garage → Show me my car.`, tone: 'info', ms: 7000 });
    }
  },
  takeOut: (car, estate) => {
    const parked: ParkedCar = { car, position: estate ? CAR_HOME.estate : CAR_HOME.campus, rotation: estate ? -Math.PI / 2 : 0 };
    saveParked(parked);
    set({ parked, driving: null });
  },
  enter: () => {
    const p = get().parked;
    if (!p) return;
    if ((get().fuel[p.car] ?? 0) <= 0.01) toast({ icon: '⛽', text: 'The tank is empty. You can sit in it, but you need fuel to move: buy some at the fuel station.', tone: 'bad', ms: 6000 });
    set({ driving: p.car, ride: null });
  },
  park: (position, rotation) => {
    const car = get().driving;
    if (!car) return;
    const parked = { car, position, rotation };
    saveParked(parked);
    set({ driving: null, parked, view: 'outside' });
    void flushBurn(car);
  },
  buyFuel: async (car, litres) => {
    set({ busy: true, error: null });
    try {
      const { data, error } = await supabase.rpc('buy_fuel', { p_car: car, p_litres: litres });
      if (error) throw new Error(error.message);
      const r = data as { litres: number; bought: number; cost: number; balance: number };
      set({ fuel: { ...get().fuel, [car]: Number(r.litres) } });
      useWalletStore.setState({ balance: Number(r.balance) });
      toast({ icon: '⛽', text: `Filled ${r.bought} litres`, amount: -r.cost, tone: 'good' });
      return true;
    } catch (e) { set({ error: (e as Error).message }); return false; } finally { set({ busy: false }); }
  },
  drove: (metres) => {
    const car = get().driving;
    if (!car || metres <= 0) return;
    const litres = metres / FUEL.metresPerLitre;
    const left = Math.max(0, (get().fuel[car] ?? 0) - litres);
    set({ fuel: { ...get().fuel, [car]: left } });
    pendingBurn += litres;
    if (pendingBurn >= 0.4) void flushBurn(car);
  },
}));

async function flushBurn(car: string) {
  if (reporting || pendingBurn <= 0 || !isSupabaseConfigured) return;
  reporting = true;
  const litres = Math.min(FUEL.maxBurnPerReport, Math.round(pendingBurn * 100) / 100);
  pendingBurn -= litres;
  try { await supabase.rpc('burn_fuel', { p_car: car, p_litres: litres }); } catch { /* reported again on the next step */ pendingBurn += litres; }
  finally { reporting = false; }
}
