import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';
import { CAR_HOME, CAR_MODELS, CAR_PAINTS, FUEL, HOSTEL_DRIVEWAY, isCarId, isPaintId } from '../config/cars';
import { HOSTEL_GARAGE } from '../config/hostelCompound';
import { useHostelStore } from './hostelStore';
import { useEstateStore } from './estateStore';
import { networkManager } from '../game/multiplayer/networkManager';

type Point = [number, number, number];
/** `where: 'hostel'`: in your hostel garage (position is in the compound); otherwise on campus. */
export interface ParkedCar { car: string; position: Point; rotation: number; where?: 'hostel' }
const inHostelGarage = (car: string): ParkedCar => ({ car, position: HOSTEL_GARAGE.car, rotation: HOSTEL_GARAGE.rotation, where: 'hostel' });
const atCampusHome = (p: ParkedCar) => !p.where && p.position[0] === CAR_HOME.campus[0] && p.position[2] === CAR_HOME.campus[2];

interface CarStore {
  /** Fuel in litres per owned car (from the database). */
  fuel: Record<string, number>;
  /** Respray colour id per owned car (null: the model's own colour). */
  paint: Record<string, string | null>;
  loaded: boolean;
  /** The car you're driving right now, if any. */
  driving: string | null;
  /** Where your car is parked (one car out at a time). */
  parked: ParkedCar | null;
  busy: boolean;
  error: string | null;
  load: () => Promise<void>;
  /** Put a car at home, ready to walk to: the estate car park, else your hostel garage. */
  takeOut: (car: string, estate: boolean) => void;
  enter: () => void;
  park: (position: Point, rotation: number) => void;
  /** Stopped at the hostel driveway on campus: put the car in your hostel garage and walk in. */
  parkAtHostel: () => Promise<void>;
  /** From your hostel garage: out to the hostel driveway on campus, at the wheel. */
  driveFromHostel: () => Promise<void>;
  buyFuel: (car: string, litres: number) => Promise<boolean>;
  /** Respray one of your cars (₦5,000, kept by the database). */
  paintCar: (car: string, paint: string) => Promise<boolean>;
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
  try { const p = JSON.parse(localStorage.getItem(storeKey) || 'null'); return p && isCarId(p.car) && Array.isArray(p.position) ? { ...p, where: p.where === 'hostel' ? 'hostel' : undefined } : null; } catch { return null; }
};
const saveParked = (p: ParkedCar | null) => { try { if (p) localStorage.setItem(storeKey, JSON.stringify(p)); else localStorage.removeItem(storeKey); } catch { /* private mode */ } };

let pendingBurn = 0;
let reporting = false;

export const useCarStore = create<CarStore>((set, get) => ({
  fuel: {}, paint: {}, loaded: false, driving: null, parked: readParked(), busy: false, error: null,
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
    const fuel: Record<string, number> = {}, paint: Record<string, string | null> = {};
    for (const c of (data as { cars: Array<{ car: string; litres: number; paint?: string | null }> }).cars) { fuel[c.car] = Number(c.litres); paint[c.car] = isPaintId(c.paint) ? c.paint : null; }
    set({ fuel, paint, loaded: true });
    // A parked car you no longer own disappears.
    const p = get().parked;
    if (p && !(p.car in fuel)) { saveParked(null); set({ parked: null }); }
    // Own a car but none is out: park it at home (the estate if you rent there) so you can see it.
    const first = Object.keys(fuel).find((id) => CAR_MODELS[id]);
    const old = get().parked;
    if (!get().driving && first && (!old || atCampusHome(old))) {
      if (!useEstateStore.getState().state) await useEstateStore.getState().load();
      const estate = !!useEstateStore.getState().state?.renting;
      // A car left at the old campus car park home moves home too.
      get().takeOut(old?.car ?? first, estate);
      toast({ icon: '🚗', text: `Your ${CAR_MODELS[old?.car ?? first].name} is parked ${estate ? 'at the Royal Gardens Estate car park' : 'in your hostel garage'}. Phone → Garage → Show me my car.`, tone: 'info', ms: 7000 });
    }
  },
  takeOut: (car, estate) => {
    const parked: ParkedCar = estate ? { car, position: CAR_HOME.estate, rotation: -Math.PI / 2 } : inHostelGarage(car);
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
  parkAtHostel: async () => {
    const car = get().driving;
    if (!car) return;
    const parked = inHostelGarage(car);
    saveParked(parked);
    set({ driving: null, parked, view: 'outside' });
    void flushBurn(car);
    await useHostelStore.getState().travel('hostel', undefined, HOSTEL_GARAGE.stepOut);
    toast({ icon: '🚗', text: `${CAR_MODELS[car]?.name ?? 'Your car'} is in your hostel garage. Walk up to it and tap Drive out when you need it.`, tone: 'good', ms: 6000 });
  },
  driveFromHostel: async () => {
    const p = get().parked;
    if (!p || p.where !== 'hostel' || get().driving || useHostelStore.getState().transition) return;
    const parked: ParkedCar = { car: p.car, position: HOSTEL_DRIVEWAY.position, rotation: HOSTEL_DRIVEWAY.rotation };
    saveParked(parked);
    set({ parked });
    await useHostelStore.getState().travel('campus', undefined, HOSTEL_DRIVEWAY.stepOut);
    if (useHostelStore.getState().roomId === 'world:funaab:main') get().enter();
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
  paintCar: async (car, paint) => {
    set({ busy: true, error: null });
    try {
      const { data, error } = await supabase.rpc('paint_car', { p_car: car, p_paint: paint });
      if (error) throw new Error(error.message);
      const r = data as { paint: string; cost: number; balance: number };
      set({ paint: { ...get().paint, [car]: r.paint } });
      useWalletStore.setState({ balance: Number(r.balance) });
      toast({ icon: '🎨', text: `${CAR_MODELS[car]?.name ?? 'Your car'} resprayed ${CAR_PAINTS[r.paint]?.name ?? r.paint}`, amount: -r.cost, tone: 'good' });
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
