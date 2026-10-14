import { create } from 'zustand';
import { networkManager } from '../game/multiplayer/networkManager';
import { partyNight } from '../config/partyHall';
import { createTtt, type TttState } from '../config/ticTacToe';
import { createPool, type PoolState } from '../config/pool';
import { TTT_TABLES, type ArcadeTableId } from '../config/partyHall';
import { useGameStore } from './gameStore';
import { toast } from './toastStore';

// Mirror of The Arena: tonight's ticket and the arcade tables. The Worker decides everything.
interface PartyStore {
  /** Night (Lagos date) we hold a ticket for, as confirmed by the Worker. */
  ticketNight: string | null;
  ttt: Record<string, TttState>;
  pool: PoolState;
  /** When the current pool lastShot arrived, so its replay starts then. */
  shotAt: number;
  table: ArcadeTableId | null;
  busy: boolean;
  error: string | null;
  hasTicket: () => boolean;
  enter: () => Promise<boolean>;
  openTable: (table: ArcadeTableId) => void;
  act: (op: string, payload?: Record<string, unknown>) => Promise<void>;
  receive: (data: { ttt?: Record<string, TttState>; pool?: PoolState }) => void;
}

export const usePartyStore = create<PartyStore>((set, get) => ({
  ticketNight: null,
  ttt: Object.fromEntries(TTT_TABLES.map((id) => [id, createTtt(id, 0)])),
  pool: createPool(0),
  shotAt: 0,
  table: null,
  busy: false,
  error: null,
  hasTicket: () => get().ticketNight === partyNight(Date.now()),
  enter: async () => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const r = await networkManager.court('party', 'enter');
      set({ ticketNight: r.night });
      toast({ icon: '🪩', text: r.charged ? 'Welcome to The Arena! Your ticket is good all night.' : 'Welcome back — your ticket is still good tonight.', amount: r.charged ? -500 : undefined, tone: 'good' });
      useGameStore.getState().setActiveModal(null);
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    } finally { set({ busy: false }); }
  },
  openTable: (table) => { set({ table, error: null }); useGameStore.getState().setActiveModal('arcade'); },
  act: async (op, payload = {}) => {
    const table = get().table;
    if (!table || get().busy) return;
    set({ busy: true, error: null });
    try {
      const state = await networkManager.court('arcade', op, { table, ...payload });
      get().receive(table === 'pool' ? { pool: state } : { ttt: { [table]: state } });
    } catch (e) { set({ error: (e as Error).message }); } finally { set({ busy: false }); }
  },
  receive: ({ ttt, pool }) => {
    if (ttt) set({ ttt: { ...get().ttt, ...ttt } });
    if (pool) {
      const prev = get().pool;
      set({ pool, shotAt: pool.lastShot && pool.lastShot.seq !== prev.lastShot?.seq ? Date.now() : get().shotAt });
    }
  },
}));
