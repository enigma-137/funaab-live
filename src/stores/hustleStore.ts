import { create } from 'zustand';
import { FARM_SHIFT, FARM_STEPS } from '../config/fpyFarm';
import { useGameStore } from './gameStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { networkManager } from '../game/multiplayer/networkManager';
import { useWalletStore } from './walletStore';
import { toast } from './toastStore';
import { HUSTLE_RULES, POS_KIOSK, PHOTO_RULES, TUTORING, type ErrandKind, type ShopStockId } from '../config/hustles';

/** Hustle pay shares one daily cap, so the last shift of the day can pay less than listed. Say so. */
const capNote = (paid: number | undefined, expected: number) =>
  paid != null && paid < expected ? ` · daily hustle limit (₦${HUSTLE_RULES.DAILY_CAP.toLocaleString()}) reached, paid ₦${Math.max(0, paid).toLocaleString()} of ₦${expected.toLocaleString()}` : '';

export interface ShopItem { item: ShopStockId; title: string; cost: number; units_per_restock: number; unit_price: number; units: number; ready: number }
export interface ShopState { items: ShopItem[]; earned_today: number; sales_today: number; max_sales_per_day: number; hustle_today: number; daily_cap: number }
export interface Errand { id: string; kind: ErrandKind; reward: number; poster?: string; mine?: boolean; status?: string; role?: 'poster' | 'runner'; other?: string | null; other_id?: string | null }
export interface ErrandBoard { open: Errand[]; mine: Errand[] }
export interface TutorSession { session: string; ends_at: string; questions: Array<{ id: string; question: string; options: string[] }> }

interface HustleStore {
  shop: ShopState | null;
  errands: ErrandBoard | null;
  posEndsAt: number | null;
  /** FPY farm shift in progress: next step index, when the last one finished, and any step being worked. */
  farm: { step: number; lastAt: number; working: { step: number; until: number } | null } | null;
  tutor: TutorSession | null;
  tutorAnswers: Record<string, number>;
  tutorResult: { score: number; total: number; paid: number; answers: Record<string, number> } | null;
  busy: string | null;
  error: string | null;
  loadShop: () => Promise<void>;
  loadErrands: () => Promise<void>;
  restock: (item: ShopStockId) => Promise<void>;
  collect: () => Promise<void>;
  startPos: () => Promise<void>;
  finishPos: () => Promise<void>;
  startFarm: () => Promise<void>;
  /** Do the farm job at this plot: starts a shift if needed, waits out the job, then reports it. */
  farmAt: (plot: string) => Promise<void>;
  photo: (spot: string) => Promise<void>;
  startTutor: () => Promise<void>;
  pickTutor: (id: string, option: number) => void;
  submitTutor: () => Promise<void>;
  postErrand: (kind: ErrandKind, reward: number) => Promise<void>;
  acceptErrand: (id: string) => Promise<void>;
  cancelErrand: (id: string) => Promise<void>;
  handOver: (id: string) => Promise<void>;
}

const rpc = async <T,>(name: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
};
const validShop = (s: any): s is ShopState => !!s && Array.isArray(s.items);
const validBoard = (b: any): b is ErrandBoard => !!b && Array.isArray(b.open) && Array.isArray(b.mine);
const setBalance = (b: unknown) => { if (b != null && Number.isFinite(Number(b))) useWalletStore.setState({ balance: Number(b) }); };

export const useHustleStore = create<HustleStore>((set, get) => {
  /** Run an action with a busy flag and a friendly error. */
  const run = async (key: string, fn: () => Promise<void>) => {
    if (get().busy) return;
    set({ busy: key, error: null });
    try { await fn(); } catch (e) { set({ error: (e as Error).message }); } finally { set({ busy: null }); }
  };
  return {
    shop: null, errands: null, posEndsAt: null, farm: null, tutor: null, tutorAnswers: {}, tutorResult: null, busy: null, error: null,
    loadShop: async () => {
      if (!isSupabaseConfigured) return;
      try { const s = await rpc<ShopState>('shop_state'); if (validShop(s)) set({ shop: s }); } catch { /* older database */ }
    },
    loadErrands: async () => {
      if (!isSupabaseConfigured) return;
      try { const b = await rpc<ErrandBoard>('errand_board'); if (validBoard(b)) set({ errands: b }); } catch { /* older database */ }
    },
    restock: (item) => run(`restock-${item}`, async () => {
      const r = await rpc<ShopState & { balance: number }>('restock_shop', { p_item: item });
      set({ shop: r }); setBalance(r.balance);
      toast({ icon: '📦', text: 'Stock is on your shelf. It sells while you’re away.', tone: 'good' });
    }),
    collect: () => run('collect', async () => {
      const r = await rpc<ShopState & { paid: number; balance: number }>('collect_shop');
      set({ shop: r }); setBalance(r.balance);
      toast({ icon: '🛒', text: r.paid > 0 ? 'Room shop sales collected' : 'Nothing sold yet. Check back later.', amount: r.paid > 0 ? r.paid : undefined, tone: r.paid > 0 ? 'good' : 'info' });
    }),
    startPos: () => run('pos', async () => {
      const r = await networkManager.hustle('pos_start');
      set({ posEndsAt: Date.now() + Math.max(0, r.endsAt - Date.now()) });
    }),
    finishPos: () => run('pos', async () => {
      try {
        const r = await networkManager.hustle('pos_finish');
        toast({ icon: '🏧', text: `POS shift done${capNote(r.paid, POS_KIOSK.pay)}`, amount: r.paid || undefined, tone: r.paid ? 'good' : 'info', ms: 5000 });
      } finally { set({ posEndsAt: null }); void get().loadShop(); }
    }),
    startFarm: () => run('farm', async () => {
      const r = await networkManager.hustle('farm_start');
      const cur = get().farm;
      set({ farm: cur && cur.step === r.step ? cur : { step: r.step, lastAt: Date.now(), working: null } });
      const next = FARM_STEPS[r.step];
      useGameStore.getState().setNavigationDestination({ id: `farm-${next.id}`, name: next.label, shortName: next.label, position: next.spot, icon: next.icon });
      useGameStore.getState().setActiveModal(null);
    }),
    farmAt: async (plot) => {
      if (!get().farm) { await get().startFarm(); if (!get().farm) return; }
      const f = get().farm!;
      if (f.working) return;
      const step = FARM_STEPS[f.step];
      if (`farm-${step.id}` !== plot) {
        toast({ icon: step.icon, text: `Next job: ${step.label.toLowerCase()} at the ${step.icon} plot.`, tone: 'info' });
        return;
      }
      // The job takes a few seconds; the Worker refuses anything faster.
      const until = Math.max(Date.now(), f.lastAt + FARM_SHIFT.minStepSeconds * 1000) + 400;
      set({ farm: { ...f, working: { step: f.step, until } } });
      toast({ icon: step.icon, text: `${step.label}… stay at the plot`, tone: 'info', ms: until - Date.now() });
      await new Promise((r) => setTimeout(r, until - Date.now()));
      try {
        const r = await networkManager.hustle('farm_step');
        if (r.paid != null || r.step >= FARM_STEPS.length) {
          set({ farm: null });
          useGameStore.getState().setNavigationDestination(null);
          toast({ icon: '🧺', text: `Farm shift done — good work!${capNote(r.paid, FARM_SHIFT.pay)}`, amount: r.paid || undefined, tone: r.paid ? 'good' : 'info', ms: 5000 });
          void get().loadShop();
          return;
        }
        set({ farm: { step: r.step, lastAt: Date.now(), working: null } });
        const next = FARM_STEPS[r.step];
        useGameStore.getState().setNavigationDestination({ id: `farm-${next.id}`, name: next.label, shortName: next.label, position: next.spot, icon: next.icon });
        toast({ icon: '✅', text: `Done! Next: ${next.label.toLowerCase()} ${next.icon}`, tone: 'good' });
      } catch (e) {
        const msg = (e as Error).message;
        set({ farm: /Start a farm shift/.test(msg) ? null : { ...get().farm!, working: null }, error: msg });
        toast({ icon: '🌱', text: msg, tone: 'bad' });
      }
    },
    photo: (spot) => run('photo', async () => {
      const r = await networkManager.hustle('photo', { spot });
      toast({ icon: '📸', text: `${r.clients ? `Shoot done · ${r.clients} student${r.clients === 1 ? '' : 's'} paid for photos` : 'Shoot done · bring friends for bigger jobs'}${capNote(r.paid, PHOTO_RULES.base + PHOTO_RULES.perClient * (r.clients || 0))}`, amount: r.paid || undefined, tone: r.paid ? 'good' : 'info', ms: 5000 });
      void get().loadShop();
    }),
    startTutor: () => run('tutor', async () => {
      const t = await networkManager.hustle('tutor_start');
      set({ tutor: t, tutorAnswers: {}, tutorResult: null });
    }),
    pickTutor: (id, option) => { if (!get().tutorResult) set({ tutorAnswers: { ...get().tutorAnswers, [id]: option } }); },
    submitTutor: () => run('tutor', async () => {
      const t = get().tutor; if (!t) return;
      const r = await networkManager.hustle('tutor_submit', { session: t.session, answers: get().tutorAnswers });
      set({ tutorResult: r });
      const due = TUTORING.payPerCorrect * r.score;
      if (r.paid > 0 || due > 0) toast({ icon: '📚', text: `Tutoring: ${r.score}/${r.total} right${capNote(r.paid, due)}`, amount: r.paid || undefined, tone: r.paid ? 'good' : 'info', ms: 5000 });
      void get().loadShop();
    }),
    postErrand: (kind, reward) => run('post', async () => {
      const b = await rpc<ErrandBoard & { balance: number }>('post_errand', { p_kind: kind, p_reward: reward });
      set({ errands: b }); setBalance(b.balance);
      toast({ icon: '📌', text: 'Errand posted. The reward is held until someone does it.', tone: 'info' });
    }),
    acceptErrand: (id) => run(`accept-${id}`, async () => { set({ errands: await rpc<ErrandBoard>('accept_errand', { p_errand: id }) }); }),
    cancelErrand: (id) => run(`cancel-${id}`, async () => { set({ errands: await rpc<ErrandBoard>('cancel_errand', { p_errand: id }) }); }),
    handOver: (id) => run(`hand-${id}`, async () => {
      const r = await networkManager.hustle('errand_handover', { errand: id });
      toast({ icon: '✅', text: 'Errand done', amount: r.paid, tone: 'good' });
      void get().loadErrands();
    }),
  };
});
