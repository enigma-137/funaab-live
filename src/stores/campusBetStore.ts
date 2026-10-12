import { create } from 'zustand';
import { networkManager } from '../game/multiplayer/networkManager';
import { useAuthStore } from './authStore';
import { CAMPUS_BET_STAKE, type CampusBetPick, type CampusBetState } from '../config/campusBet';

interface CampusBetStore {
  state: CampusBetState | null;
  /** serverNow − Date.now() at the last response; the countdown uses server time, not the device clock. */
  clockOffset: number;
  loading: boolean;
  placing: boolean;
  error: string | null;
  stake: number;
  picks: Array<CampusBetPick | null>;
  draftRoundId: string | null;
  /** quiet: refresh without replacing the current error message. */
  load: (quiet?: boolean) => Promise<void>;
  setStake: (stake: number) => void;
  pick: (index: number, pick: CampusBetPick) => void;
  place: () => Promise<boolean>;
}

const emptyPicks = () => [null, null, null, null, null] as Array<CampusBetPick | null>;

export const useCampusBetStore = create<CampusBetStore>((set, get) => {
  const receive = (state: CampusBetState) => {
    const roundId = state.current?.id ?? null;
    set({
      state,
      clockOffset: Date.parse(state.server_now) - Date.now(),
      // A new matchday clears the previous draft.
      ...(roundId !== get().draftRoundId ? { draftRoundId: roundId, picks: emptyPicks() } : {}),
    });
  };
  return {
    state: null, clockOffset: 0, loading: false, placing: false, error: null,
    stake: CAMPUS_BET_STAKE.default, picks: emptyPicks(), draftRoundId: null,
    load: async (quiet = false) => {
      if (get().loading) return;
      const owner = useAuthStore.getState().user?.id;
      set({ loading: true });
      try {
        const state = await networkManager.campusBet('state');
        if (useAuthStore.getState().user?.id === owner) { receive(state); if (!quiet) set({ error: null }); }
      } catch (e) { if (!quiet) set({ error: (e as Error).message }); }
      finally { set({ loading: false }); }
    },
    setStake: (stake) => set({ stake }),
    pick: (index, pick) => set((s) => { const picks = [...s.picks]; picks[index] = pick; return { picks }; }),
    place: async () => {
      const { state, stake, picks, placing } = get();
      if (placing || !state?.current || picks.some((p) => !p)) return false;
      set({ placing: true, error: null });
      try {
        receive(await networkManager.campusBet('place', { roundId: state.current.id, stake, picks }));
        return true;
      } catch (e) {
        set({ error: (e as Error).message });
        // The ticket may have been saved before a timeout or a "closed" race; show the truth.
        setTimeout(() => void get().load(true), 1200);
        return false;
      } finally { set({ placing: false }); }
    },
  };
});
