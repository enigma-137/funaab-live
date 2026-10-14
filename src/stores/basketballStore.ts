import { create } from 'zustand';
import { BASKETBALL_COURT, createCourt, type BasketballMatchState, type BasketballPlayer } from '../config/basketball';
import { networkManager } from '../game/multiplayer/networkManager';
import { useAuthStore } from './authStore';
import { useGameStore } from './gameStore';
import { useHostelStore } from './hostelStore';
import { useInputStore } from './inputStore';

// Mirror of the Worker's single basketball court. Nothing here decides a result.
interface BasketballStore {
  state: BasketballMatchState;
  /** Local clock when `state` arrived; turn countdowns are relative to it. */
  receivedAt: number;
  busy: boolean;
  error: string | null;
  receive: (state: BasketballMatchState, fromSnapshot?: boolean) => void;
  act: (op: 'practice' | 'create' | 'join' | 'cancel' | 'shoot' | 'rematch' | 'leave', payload?: Record<string, unknown>) => Promise<boolean>;
  clearError: () => void;
}

export const isMeOnCourt = (p: BasketballPlayer | null | undefined) =>
  !!p && (p.userId === useAuthStore.getState().user?.id || p.connectionId === useGameStore.getState().myConnectionId);

export const onCourt = (s: BasketballMatchState) => isMeOnCourt(s.player1) || isMeOnCourt(s.player2);

export const useBasketballStore = create<BasketballStore>((set, get) => ({
  state: createCourt(0),
  receivedAt: 0,
  busy: false,
  error: null,
  receive: (next, fromSnapshot = false) => {
    const prev = get().state;
    if (next.id === prev.id && next.updatedAt < prev.updatedAt) return;
    set({ state: next, receivedAt: Date.now() });
    // Both players are pulled into the shared shootout view the moment it starts.
    const started = next.status === 'ACTIVE' && (prev.status !== 'ACTIVE' || prev.id !== next.id);
    if ((started || fromSnapshot) && next.status === 'ACTIVE' && onCourt(next)) {
      const game = useGameStore.getState();
      if (game.seatedAt) game.standUp();
      game.setActiveModal('basketball');
    }
  },
  act: async (op, payload = {}) => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const state = await networkManager.basketball(op, payload);
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

const WAITING_SPOT: [number, number, number] = [BASKETBALL_COURT.shooterSpot[0] + 0.8, 0, BASKETBALL_COURT.shooterSpot[2] + 1.9];

/** Put the local student on the free-throw line (or just beside it while the other player shoots). */
export function stepUpToLine(shooting: boolean) {
  const game = useGameStore.getState();
  if (game.seatedAt) game.standUp();
  useInputStore.getState().clearTargetDestination();
  useHostelStore.setState({ teleport: shooting ? BASKETBALL_COURT.shooterSpot : WAITING_SPOT });
  game.setFaceRotation(BASKETBALL_COURT.facing);
  // Camera behind the shooter, looking at the hoop.
  useInputStore.getState().setCameraYaw(BASKETBALL_COURT.cameraYaw);
}

export function openBasketball() {
  stepUpToLine(true);
  useBasketballStore.getState().clearError();
  useGameStore.getState().setActiveModal('basketball');
}
