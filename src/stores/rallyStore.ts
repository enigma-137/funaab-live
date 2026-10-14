import { create } from 'zustand';
import { createRally, serveSpot, slotSpot, teamCameraYaw, teamFacing, type RallyState, type Team } from '../config/volleyRally';
import { networkManager } from '../game/multiplayer/networkManager';
import { useAuthStore } from './authStore';
import { useGameStore } from './gameStore';
import { useHostelStore } from './hostelStore';
import { useInputStore } from './inputStore';

// Mirror of the Worker's 2v2 volleyball rally. Nothing here decides a result.
interface RallyStore {
  state: RallyState;
  /** Local clock when the current lastEvent arrived: flights and timing bars run from here (no clock skew). */
  eventAt: number;
  receivedAt: number;
  busy: boolean;
  error: string | null;
  receive: (state: RallyState, fromSnapshot?: boolean) => void;
  act: (op: 'join' | 'leave' | 'again' | 'serve' | 'touch', payload?: Record<string, unknown>) => Promise<boolean>;
  clearError: () => void;
}

const myId = () => useAuthStore.getState().user?.id;
/** My team and slot (index), or null when I'm not playing. */
export function mySeat(s: RallyState): { team: Team; slot: number } | null {
  const id = myId(), conn = useGameStore.getState().myConnectionId;
  for (const team of ['A', 'B'] as const) {
    const slot = s.teams[team].findIndex((p) => !p.bot && (p.userId === id || (!!conn && p.connectionId === conn)));
    if (slot >= 0) return { team, slot };
  }
  return null;
}
export const isMyMove = (s: RallyState) => {
  const seat = mySeat(s);
  return !!seat && !!s.pending && s.pending.team === seat.team && s.pending.slot === seat.slot;
};

let placedKey = '';
/** Stand on my spot: behind the end line to serve, otherwise my half of the court. */
function placeMe(s: RallyState) {
  const seat = mySeat(s);
  if (!seat || s.status !== 'ACTIVE') { placedKey = ''; return; }
  const serving = s.phase === 'SERVE' && isMyMove(s);
  const key = `${s.id}:${seat.team}${seat.slot}:${serving}`;
  if (key === placedKey) return;
  placedKey = key;
  const game = useGameStore.getState();
  if (game.seatedAt) game.standUp();
  useInputStore.getState().clearTargetDestination();
  useHostelStore.setState({ teleport: serving ? serveSpot(seat.team, seat.slot) : slotSpot(seat.team, seat.slot) });
  game.setFaceRotation(teamFacing(seat.team));
  useInputStore.getState().setCameraYaw(teamCameraYaw(seat.team));
}

export const useRallyStore = create<RallyStore>((set, get) => ({
  state: createRally(0),
  eventAt: 0,
  receivedAt: 0,
  busy: false,
  error: null,
  receive: (next, fromSnapshot = false) => {
    const prev = get().state;
    if (next.id === prev.id && next.updatedAt < prev.updatedAt) return;
    const newEvent = next.lastEvent && next.lastEvent.seq !== prev.lastEvent?.seq;
    // A snapshot mid-flight shouldn't replay an old flight: treat it as already landed.
    set({ state: next, receivedAt: Date.now(), ...(newEvent ? { eventAt: fromSnapshot ? 0 : Date.now() } : {}) });
    const seat = mySeat(next);
    if (!seat) return;
    const started = next.status === 'ACTIVE' && (prev.status !== 'ACTIVE' || prev.id !== next.id);
    if (started || (fromSnapshot && next.status === 'ACTIVE')) {
      const game = useGameStore.getState();
      if (game.seatedAt) game.standUp();
      game.setActiveModal('volleyball_rally');
    }
    placeMe(next);
  },
  act: async (op, payload = {}) => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const state = await networkManager.court('volleyball_rally', op, payload);
      if (state) get().receive(state);
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    } finally {
      set({ busy: false });
    }
  },
  clearError: () => set({ error: null }),
}));

export function openRally() {
  useRallyStore.getState().clearError();
  useGameStore.getState().setActiveModal('volleyball_rally');
}
