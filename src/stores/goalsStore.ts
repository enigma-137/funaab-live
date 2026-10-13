import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWalletStore } from './walletStore';
import { useAuthStore } from './authStore';
import { gameSound } from '../game/audio/gameAudio';
import type { AchievementCounts, DailyTaskId } from '../config/goals';

export type DailyTask = { id: DailyTaskId; title: string; target: number; reward: number; progress: number; claimed: boolean };
export type DailyTasks = { day: string; tasks: DailyTask[]; streak: number; best_streak: number; bonus: { claimed: boolean; reward: number } };
export type BoardRow = { username?: string; college: string; value: number; me?: boolean; students?: number };
export type Leaderboards = { week_start: string; earners: BoardRow[]; den_wins: BoardRow[]; colleges: BoardRow[]; me: { earned: number; rank: number | null } };

/** True when migration 015 isn't in the database yet (the function doesn't exist). */
const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? ''));

interface GoalsState {
  /** Goals aren't switched on in this database yet. */
  unavailable: boolean;
  tasks: DailyTasks | null;
  boards: Leaderboards | null;
  badges: Record<string, AchievementCounts>;
  claiming: string | null;
  error: string | null;
  loadTasks: () => Promise<void>;
  claim: (task: DailyTaskId | 'bonus') => Promise<boolean>;
  loadBoards: () => Promise<void>;
  loadBadges: (userId: string) => Promise<AchievementCounts | null>;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; missing: boolean; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, missing: true, error: null };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, missing: isMissing(error), error: error.message };
  return { data: data as T, missing: false, error: null };
}

export const useGoalsStore = create<GoalsState>()((set, get) => ({
  unavailable: false,
  tasks: null,
  boards: null,
  badges: {},
  claiming: null,
  error: null,

  loadTasks: async () => {
    const r = await call<DailyTasks>('get_daily_tasks');
    if (r.missing) return set({ unavailable: true });
    set(r.error ? { error: r.error } : { tasks: r.data, error: null, unavailable: false });
  },

  claim: async (task) => {
    if (get().claiming) return false;
    set({ claiming: task, error: null });
    const r = await call<{ reward: number; balance: number }>('claim_daily_task', { p_task: task });
    set({ claiming: null });
    if (r.missing) { set({ unavailable: true }); return false; }
    if (r.error || !r.data) { set({ error: r.error ?? 'Could not claim' }); await get().loadTasks(); return false; }
    useWalletStore.setState({ balance: Number(r.data.balance) });
    const user = useAuthStore.getState().user;
    if (user) void useWalletStore.getState().loadWallet(user.id);
    if (task === 'bonus') gameSound.success(); else gameSound.coin();
    await get().loadTasks();
    return true;
  },

  loadBoards: async () => {
    const r = await call<Leaderboards>('get_leaderboards');
    if (r.missing) return set({ unavailable: true });
    set(r.error ? { error: r.error } : { boards: r.data, error: null });
  },

  loadBadges: async (userId) => {
    const r = await call<AchievementCounts>('get_achievements', { p_user: userId });
    if (r.missing) { set({ unavailable: true }); return null; }
    if (!r.data) return null;
    set((s) => ({ badges: { ...s.badges, [userId]: r.data! } }));
    return r.data;
  },
}));

/** Tasks that are done but not yet claimed, plus the bonus when it's ready. */
export const claimableCount = (t: DailyTasks | null) => {
  if (!t) return 0;
  const tasks = t.tasks.filter((x) => !x.claimed && x.progress >= x.target).length;
  const bonusReady = !t.bonus.claimed && t.tasks.length > 0 && t.tasks.every((x) => x.claimed);
  return tasks + (bonusReady ? 1 : 0);
};
