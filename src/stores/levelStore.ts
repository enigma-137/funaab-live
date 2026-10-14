import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useGameStore } from './gameStore';
import { toast } from './toastStore';

// Mirror of my_level() (migration 031). The database awards XP; the client only shows it.
export interface LevelState { xp: number; level: number; today: number; cap: number }

interface LevelStore {
  state: LevelState | null;
  load: () => Promise<void>;
  open: () => void;
}

export const levelLabel = (s: Pick<LevelState, 'level'>) => `Lv ${s.level}`;

export const useLevelStore = create<LevelStore>((set, get) => ({
  state: null,
  load: async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase.rpc('my_level');
      if (error || !data || typeof data.level !== 'number' || typeof data.xp !== 'number') return;
      const before = get().state;
      set({ state: data as LevelState });
      if (before && data.level > before.level) toast({ icon: '⭐', text: `Level up! You're now Level ${data.level}.`, tone: 'good', ms: 5000 });
    } catch { /* Older databases without migration 031 just hide the level. */ }
  },
  open: () => { void get().load(); useGameStore.getState().setActiveModal('level'); },
}));
