import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';

// Mirror of the server's daily_plan(): goals, progress and streak are all computed in the database.
export interface PlanGoal { id: string; title: string; icon: string; target: number; reward: number; progress: number; claimed: boolean }
export interface DailyPlan {
  day: string;
  goals: PlanGoal[];
  all_done_bonus: number;
  streak: { current: number; best: number; badges: string[]; done_today: boolean };
}

interface DailyPlanStore {
  plan: DailyPlan | null;
  loading: boolean;
  claiming: string | null;
  /** Card expanded (tapped, or opened from the phone / Earn). */
  open: boolean;
  setOpen: (open: boolean) => void;
  error: string | null;
  load: () => Promise<void>;
  claim: (goalId: string) => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const useDailyPlanStore = create<DailyPlanStore>((set, get) => ({
  plan: null,
  loading: false,
  claiming: null,
  open: false,
  setOpen: (open) => set({ open }),
  error: null,
  load: () => {
    if (!isSupabaseConfigured) return Promise.resolve();
    // Coalesce bursts (Worker refreshes, wallet refreshes, timers) into one request.
    inFlight ??= (async () => {
      set({ loading: true });
      try {
        const { data, error } = await supabase.rpc('daily_plan');
        if (error) throw error;
        // Only accept a well-formed plan; anything else (old database, proxy error page) hides the card.
        const plan = data as DailyPlan | null;
        set({ plan: plan && Array.isArray(plan.goals) && plan.streak ? plan : null, error: null });
      } catch (e) {
        // Older databases without migration 016 just don't show a plan.
        set({ error: (e as Error).message });
      } finally { set({ loading: false }); inFlight = null; }
    })();
    return inFlight;
  },
  claim: async (goalId) => {
    if (get().claiming) return;
    set({ claiming: goalId, error: null });
    try {
      const { data, error } = await supabase.rpc('claim_daily_goal', { p_goal: goalId });
      if (error) throw error;
      const { balance, paid, ...plan } = data as DailyPlan & { balance: number; paid: number };
      set({ plan });
      useWalletStore.setState({ balance: Number(balance) });
      const goal = plan.goals.find((g) => g.id === goalId);
      const allDone = plan.goals.every((g) => g.claimed);
      toast({
        icon: allDone ? '🔥' : goal?.icon ?? '✅',
        text: allDone ? `Today's Plan complete! ${plan.streak.current}-day streak` : `${goal?.title ?? 'Goal'} done`,
        amount: Number(paid), tone: 'good', ms: allDone ? 5000 : 3200,
      });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally { set({ claiming: null }); }
  },
}));
