import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface LeagueRow { college: string; active: number; total: number; average: number; ranked: boolean }
export interface LeagueState { week_ends_at: string; my_college: string; my_points: number; cap: number; table: LeagueRow[]; last_champion: string | null }

interface LeagueStore {
  state: LeagueState | null;
  champion: string | null;
  load: () => Promise<void>;
  loadChampion: () => Promise<void>;
}

export const useLeagueStore = create<LeagueStore>((set) => ({
  state: null,
  champion: null,
  load: async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('college_league');
    if (!error && data && Array.isArray(data.table)) set({ state: data, champion: data.last_champion ?? null });
  },
  loadChampion: async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('league_champion');
    if (!error) set({ champion: typeof data === 'string' && /^[A-Z]{2,12}$/.test(data) ? data : null });
  },
}));
