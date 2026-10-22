import { create } from 'zustand';
import { networkManager } from '../game/multiplayer/networkManager';
import { GYM, gymPassKey, gymStation, type GymStationId } from '../config/gym';
import { useGameStore } from './gameStore';
import { toast } from './toastStore';

// Mirror of the gym: this session's pass and the set in progress. The Worker decides everything.
interface GymStore {
  /** Session pass ("2026-10-22-am") we hold, as confirmed by the Worker. */
  pass: string | null;
  /** The set in progress: which station, and when it started (local clock, for the progress bar). */
  workout: { station: GymStationId; startedAt: number } | null;
  /** Stations finished this session. */
  done: GymStationId[];
  busy: boolean;
  error: string | null;
  hasPass: () => boolean;
  enter: () => Promise<boolean>;
  start: (station: GymStationId) => Promise<void>;
  stop: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useGymStore = create<GymStore>((set, get) => ({
  pass: null,
  workout: null,
  done: [],
  busy: false,
  error: null,
  hasPass: () => !!get().pass && get().pass === gymPassKey(Date.now()),
  enter: async () => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const r = await networkManager.court('gym', 'enter');
      set({ pass: r.pass, done: r.pass === get().pass ? get().done : [] });
      toast({ icon: '🏋️', text: r.charged ? 'Welcome to the gym! Your pass is good this whole session.' : 'Welcome back, your pass is still good.', amount: r.charged ? -GYM.fee : undefined, tone: 'good' });
      useGameStore.getState().setActiveModal(null);
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    } finally { set({ busy: false }); }
  },
  start: async (id) => {
    const station = gymStation(id);
    if (!station || get().busy) return;
    set({ busy: true, error: null });
    try {
      const call = () => networkManager.court('gym', 'start', { station: id });
      try { await call(); } catch (e) {
        // The Worker forgets passes when the connection drops. Show this session's pass again (free).
        if (!/pass at the door/i.test((e as Error).message) || !get().hasPass()) throw e;
        await networkManager.court('gym', 'enter');
        await call();
      }
      const g = useGameStore.getState();
      // Lock onto the station like a seat, in the workout pose; stepping off ends the set.
      g.sitAtPosition([station.spot[0], station.deck, station.spot[2]], station.yaw, { animation: station.pose });
      set({ workout: { station: id, startedAt: Date.now() } });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void finish(id), GYM.setSeconds * 1000);
    } catch (e) {
      set({ error: (e as Error).message });
      toast({ icon: '🏋️', text: (e as Error).message, tone: 'bad' });
    } finally { set({ busy: false }); }
  },
  stop: () => {
    const w = get().workout;
    if (timer) clearTimeout(timer);
    timer = null;
    set({ workout: null });
    if (w) void networkManager.court('gym', 'stop', { station: w.station }).catch(() => {});
    const g = useGameStore.getState();
    if (g.seatedAt && w) g.standUp();
  },
}));

async function finish(id: GymStationId) {
  const s = useGymStore.getState();
  if (s.workout?.station !== id) return;
  timer = null;
  try {
    await networkManager.court('gym', 'finish', { station: id });
    const first = !s.done.includes(id);
    useGymStore.setState({ done: first ? [...s.done, id] : s.done });
    toast({ icon: gymStation(id)!.icon, text: first ? `Set done at the ${gymStation(id)!.label.toLowerCase()}! XP earned.` : 'Another set done. Keep it up!', tone: 'good' });
  } catch (e) {
    toast({ icon: '🏋️', text: (e as Error).message, tone: 'bad' });
  }
  useGymStore.setState({ workout: null });
  const g = useGameStore.getState();
  if (g.seatedAt) g.standUp();
}

// Standing up (Stand button, tapping the ground) ends the set early.
useGameStore.subscribe((s, prev) => {
  if (prev.seatedAt && !s.seatedAt && useGymStore.getState().workout) useGymStore.getState().stop();
});
