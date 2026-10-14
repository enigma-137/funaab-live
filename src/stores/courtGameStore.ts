import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { BASKETBALL, BASKETBALL_COURT } from '../config/basketball';
import { VOLLEYBALL, VOLLEYBALL_COURT } from '../config/volleyball';
import type { ShootoutPlayer, ShootoutState } from '../config/shootout';
import { networkManager } from '../game/multiplayer/networkManager';
import { useAuthStore } from './authStore';
import { useGameStore } from './gameStore';
import { useHostelStore } from './hostelStore';
import { useInputStore } from './inputStore';

// Mirrors of the Worker's Sports Centre court games. Nothing here decides a result.
export type CourtGameId = 'basketball' | 'volleyball';
type AnyState = ShootoutState<string, { outcome: string }>;
export type CourtOp = 'practice' | 'create' | 'join' | 'cancel' | 'shoot' | 'rematch' | 'leave';

export interface CourtGameStore<S extends AnyState = AnyState> {
  state: S;
  /** Local clock when `state` arrived; turn countdowns are relative to it. */
  receivedAt: number;
  busy: boolean;
  error: string | null;
  receive: (state: S, fromSnapshot?: boolean) => void;
  act: (op: CourtOp, payload?: Record<string, unknown>) => Promise<boolean>;
  clearError: () => void;
}

export const isMeOnCourt = (p: ShootoutPlayer | null | undefined) =>
  !!p && (p.userId === useAuthStore.getState().user?.id || p.connectionId === useGameStore.getState().myConnectionId);
export const onCourt = (s: AnyState) => isMeOnCourt(s.player1) || isMeOnCourt(s.player2);

function courtStore<S extends AnyState>(id: CourtGameId, initial: S) {
  return create<CourtGameStore<S>>((set, get) => ({
    state: initial,
    receivedAt: 0,
    busy: false,
    error: null,
    receive: (next, fromSnapshot = false) => {
      const prev = get().state;
      if (next.id === prev.id && next.updatedAt < prev.updatedAt) return;
      set({ state: next, receivedAt: Date.now() });
      // Both players are pulled into the shared match view the moment it starts.
      const started = next.status === 'ACTIVE' && (prev.status !== 'ACTIVE' || prev.id !== next.id);
      if ((started || fromSnapshot) && next.status === 'ACTIVE' && onCourt(next)) {
        const game = useGameStore.getState();
        if (game.seatedAt) game.standUp();
        game.setActiveModal(id);
      }
    },
    act: async (op, payload = {}) => {
      if (get().busy) return false;
      set({ busy: true, error: null });
      try {
        const state = await networkManager.court(id, op, payload);
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
}

export const useBasketballStore = courtStore('basketball', BASKETBALL.create(0));
export const useVolleyballStore = courtStore('volleyball', VOLLEYBALL.create(0));
/** Untyped-by-game access for code that serves either court (panel, proximity checks). */
export const courtStores = { basketball: useBasketballStore, volleyball: useVolleyballStore } as unknown as
  Record<CourtGameId, UseBoundStore<StoreApi<CourtGameStore>>>;

/** Where to stand, which way to face and the camera yaw for each court's shooting spot. */
const SPOTS: Record<CourtGameId, { spot: [number, number, number]; waiting: [number, number, number]; facing: number; cameraYaw: number }> = {
  basketball: {
    spot: BASKETBALL_COURT.shooterSpot,
    waiting: [BASKETBALL_COURT.shooterSpot[0] + 0.8, 0, BASKETBALL_COURT.shooterSpot[2] + 1.9],
    facing: BASKETBALL_COURT.facing, cameraYaw: BASKETBALL_COURT.cameraYaw,
  },
  volleyball: {
    spot: VOLLEYBALL_COURT.serveSpot,
    waiting: [VOLLEYBALL_COURT.serveSpot[0] + 1.9, 0, VOLLEYBALL_COURT.serveSpot[2] + 0.4],
    facing: VOLLEYBALL_COURT.facing, cameraYaw: VOLLEYBALL_COURT.cameraYaw,
  },
};

/** Put the local student on the spot (or just beside it while the other player goes). */
export function stepUpToSpot(id: CourtGameId, shooting: boolean) {
  const s = SPOTS[id];
  const game = useGameStore.getState();
  if (game.seatedAt) game.standUp();
  useInputStore.getState().clearTargetDestination();
  useHostelStore.setState({ teleport: shooting ? s.spot : s.waiting });
  game.setFaceRotation(s.facing);
  useInputStore.getState().setCameraYaw(s.cameraYaw);
}

export function openCourtGame(id: CourtGameId) {
  stepUpToSpot(id, true);
  courtStores[id].getState().clearError();
  useGameStore.getState().setActiveModal(id);
}
