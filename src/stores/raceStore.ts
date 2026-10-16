import { create } from 'zustand';
import { RACE, RACE_PRIZE_DAILY_LIMIT, formatRaceTime } from '../config/carRace';
import { networkManager } from '../game/multiplayer/networkManager';
import { useCarStore } from './carStore';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';

export type RaceStatus = 'idle' | 'countdown' | 'racing' | 'finished';

/** The server's verdict on a lap: what it paid (0 once today's prizes are used up). */
export interface RacePrize { ok: boolean; place?: number; ms?: number; prize?: number; paidToday?: number; balance?: number; reason?: string }

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
  /** The server's verdict on this race, once it arrives. */
  prize: RacePrize | null;
  start: () => void;
  /** From the server: the lap counted (and what it paid), or why it didn't. */
  prizeResult: (r: RacePrize) => void;
  quit: (why?: string) => void;
  finish: (ms: number, place: number) => void;
  dismiss: () => void;
}

const bestKey = 'funaab:race-best:grand-prix:v1';
const readBest = () => { try { const n = Number(localStorage.getItem(bestKey)); return n > 0 ? n : null; } catch { return null; } };
const saveBest = (ms: number) => { try { localStorage.setItem(bestKey, String(ms)); } catch { /* private mode */ } };
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export const useRaceStore = create<RaceStore>((set, get) => ({
  status: 'idle', goAt: 0, gridPending: false, gate: 0, place: 1, finishMs: null, best: readBest(), prize: null,
  start: () => {
    const car = useCarStore.getState();
    if (!car.driving) return;
    if ((car.fuel[car.driving] ?? 0) < RACE.minFuel) { toast({ icon: '⛽', text: `You need at least ${RACE.minFuel} litres of fuel for a lap. Fill up at the fuel station.`, tone: 'bad' }); return; }
    set({ status: 'countdown', goAt: performance.now() + RACE.countdownMs, gridPending: true, gate: 0, place: 1, finishMs: null, prize: null });
    // The server watches the same lap and pays the prize; it starts its own clock now.
    networkManager.raceStart();
  },
  quit: (why) => {
    if (get().status === 'idle') return;
    if (get().status !== 'finished') networkManager.raceQuit();
    set({ status: 'idle', gridPending: false });
    if (why) toast({ icon: '🏁', text: why, tone: 'info' });
  },
  finish: (ms, place) => {
    const best = get().best, record = best === null || ms < best;
    if (record) saveBest(ms);
    set({ status: 'finished', finishMs: ms, place, best: record ? ms : best });
    toast({ icon: place === 1 ? '🏆' : '🏁', text: `${ordinal(place)} place in ${formatRaceTime(ms)}${record ? ' · new best time!' : ''}`, tone: place === 1 ? 'good' : 'info', ms: 6000 });
  },
  prizeResult: (r) => {
    set({ prize: r });
    if (r.ok && r.prize) {
      if (typeof r.balance === 'number') useWalletStore.setState({ balance: r.balance });
      toast({ icon: '💰', text: `Race prize · ${r.paidToday}/${RACE_PRIZE_DAILY_LIMIT} paid races today`, amount: r.prize, tone: 'good', ms: 6000 });
    } else if (r.ok) {
      toast({ icon: '🏁', text: `Lap counted, but you've had today's ${RACE_PRIZE_DAILY_LIMIT} paid races. Prizes are back tomorrow.`, tone: 'info', ms: 6000 });
    } else if (r.reason && get().status !== 'idle') {
      // (Already out of the race on screen: that message said why.)
      toast({ icon: '🏁', text: `No prize this time: ${r.reason}`, tone: 'info', ms: 6000 });
    }
  },
  dismiss: () => set({ status: 'idle' }),
}));

export { ordinal };
