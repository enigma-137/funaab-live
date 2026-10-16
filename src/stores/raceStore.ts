import { create } from 'zustand';
import { RACE, RIVALS, formatRaceTime } from '../config/carRace';
import { useCarStore } from './carStore';
import { toast } from './toastStore';

export type RaceStatus = 'idle' | 'countdown' | 'racing' | 'finished';

/** The rivals' live state, stepped every frame by the race runner (not React state: no re-renders). */
export const rivalState = RIVALS.map(() => ({ dist: 0, speed: 0, finishMs: null as number | null }));

interface RaceStore {
  status: RaceStatus;
  /** performance.now() when the lights go green (in the future during the countdown). */
  goAt: number;
  /** Set when the race starts: LocalPlayer moves your car onto the grid, then clears it. */
  gridPending: boolean;
  /** Next checkpoint to pass (index into RACE_GATES). */
  gate: number;
  /** Your place right now (1 = leading) and your result once finished. */
  place: number;
  finishMs: number | null;
  best: number | null;
  start: () => void;
  quit: (why?: string) => void;
  finish: (ms: number, place: number) => void;
  dismiss: () => void;
}

const bestKey = 'funaab:race-best:grand-prix:v1';
const readBest = () => { try { const n = Number(localStorage.getItem(bestKey)); return n > 0 ? n : null; } catch { return null; } };
const saveBest = (ms: number) => { try { localStorage.setItem(bestKey, String(ms)); } catch { /* private mode */ } };
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export const useRaceStore = create<RaceStore>((set, get) => ({
  status: 'idle', goAt: 0, gridPending: false, gate: 0, place: 1, finishMs: null, best: readBest(),
  start: () => {
    const car = useCarStore.getState();
    if (!car.driving) return;
    if ((car.fuel[car.driving] ?? 0) < RACE.minFuel) { toast({ icon: '⛽', text: `You need at least ${RACE.minFuel} litres of fuel for a lap. Fill up at the fuel station.`, tone: 'bad' }); return; }
    for (const r of rivalState) { r.dist = 0; r.speed = 0; r.finishMs = null; }
    set({ status: 'countdown', goAt: performance.now() + RACE.countdownMs, gridPending: true, gate: 0, place: 1, finishMs: null });
  },
  quit: (why) => {
    if (get().status === 'idle') return;
    set({ status: 'idle', gridPending: false });
    if (why) toast({ icon: '🏁', text: why, tone: 'info' });
  },
  finish: (ms, place) => {
    const best = get().best, record = best === null || ms < best;
    if (record) saveBest(ms);
    set({ status: 'finished', finishMs: ms, place, best: record ? ms : best });
    toast({ icon: place === 1 ? '🏆' : '🏁', text: `${ordinal(place)} place in ${formatRaceTime(ms)}${record ? ' · new best time!' : ''}`, tone: place === 1 ? 'good' : 'info', ms: 6000 });
  },
  dismiss: () => set({ status: 'idle' }),
}));

export { ordinal };
