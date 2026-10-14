import { create } from 'zustand';
import { FOOTBALL_PITCH, createLobby, type FootballMatchState, type FootballPlayer } from '../config/football';
import { networkManager } from '../game/multiplayer/networkManager';
import { useAuthStore } from './authStore';
import { useGameStore } from './gameStore';
import { useHostelStore } from './hostelStore';
import { useInputStore } from './inputStore';

// Mirror of the Worker's single Sports Centre pitch. Nothing here decides a result.
interface FootballStore {
  state: FootballMatchState;
  /** Local clock when `state` arrived; turn countdowns are relative to it (no clock-skew issues). */
  receivedAt: number;
  busy: boolean;
  error: string | null;
  receive: (state: FootballMatchState, fromSnapshot?: boolean) => void;
  act: (op: 'practice' | 'create' | 'join' | 'cancel' | 'shoot' | 'rematch' | 'leave', payload?: Record<string, unknown>) => Promise<boolean>;
  clearError: () => void;
}

export const isMe = (p: FootballPlayer | null | undefined) =>
  !!p && (p.userId === useAuthStore.getState().user?.id || p.connectionId === useGameStore.getState().myConnectionId);

export const amParticipant = (s: FootballMatchState) => isMe(s.player1) || isMe(s.player2);

export const useFootballStore = create<FootballStore>((set, get) => ({
  state: createLobby(0),
  receivedAt: 0,
  busy: false,
  error: null,
  receive: (next, fromSnapshot = false) => {
    const prev = get().state;
    // Ignore an out-of-order reply that is older than what a broadcast already delivered.
    if (next.id === prev.id && next.updatedAt < prev.updatedAt) return;
    set({ state: next, receivedAt: Date.now() });
    // Both players are pulled into the shared match view the moment it starts.
    const started = next.status === 'ACTIVE' && (prev.status !== 'ACTIVE' || prev.id !== next.id);
    if ((started || fromSnapshot) && next.status === 'ACTIVE' && amParticipant(next)) {
      const game = useGameStore.getState();
      if (game.seatedAt) game.standUp();
      game.setActiveModal('football');
    }
  },
  act: async (op, payload = {}) => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const state = await networkManager.football(op, payload);
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

const FACING_GOAL = Math.PI; // the goal is due -z from the penalty spot
const WAITING_SPOT: [number, number, number] = [FOOTBALL_PITCH.shooterSpot[0] + 1.9, 0, FOOTBALL_PITCH.shooterSpot[2] + 0.7];

/** Put the local student behind the ball (or just beside it while the other player shoots). */
export function stepUpToBall(shooting: boolean) {
  const game = useGameStore.getState();
  if (game.seatedAt) game.standUp();
  useInputStore.getState().clearTargetDestination();
  useHostelStore.setState({ teleport: shooting ? FOOTBALL_PITCH.shooterSpot : WAITING_SPOT });
  game.setFaceRotation(FACING_GOAL);
  // Camera behind the shooter, looking down the pitch at the goal.
  useInputStore.getState().setCameraYaw(0);
}

export function openFootball() {
  stepUpToBall(true);
  useFootballStore.getState().clearError();
  useGameStore.getState().setActiveModal('football');
}
