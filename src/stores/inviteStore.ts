import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { INVITES, normalizeInviteCode } from '../config/invites';
import { useSocialStore } from './socialStore';
import { toast } from './toastStore';
import { useWalletStore } from './walletStore';
import { useAuthStore } from './authStore';

// Mirror of my_invite() (migrations 056, 057). The database links invites and pays rewards.
export interface InvitedFriend { id: string; username: string; college: string; level: number; join_paid: boolean; level_paid: boolean }
export interface InviteState { code: string; join_reward: number; level_reward: number; level: number; max_paid: number; earned: number; friends: InvitedFriend[] }
interface InviteNews { kind: 'join' | 'level'; amount: number; username: string }

const KEY = 'funaab_invite_code';
const read = () => { try { return normalizeInviteCode(localStorage.getItem(KEY)); } catch { return null; } };
const write = (c: string | null) => { try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch { /* private mode */ } };

// Keep ?invite=CODE from the link until the visitor has signed up, then drop it from the address bar.
if (typeof window !== 'undefined') {
  const url = new URL(window.location.href);
  const code = normalizeInviteCode(url.searchParams.get(INVITES.PARAM));
  if (url.searchParams.has(INVITES.PARAM)) {
    if (code) write(code);
    url.searchParams.delete(INVITES.PARAM);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
}

interface InviteStore {
  state: InviteState | null;
  /** Code from the invite link this browser arrived with, until it is used. */
  pending: string | null;
  load: () => Promise<void>;
  /** Links a freshly signed-up student to whoever invited them. */
  redeemPending: (userId: string) => Promise<void>;
  /** Tells the inviter about payments they haven't seen yet. */
  checkNews: () => Promise<void>;
}

let checking = false;

export const useInviteStore = create<InviteStore>((set, get) => ({
  state: null,
  pending: read(),
  load: async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase.rpc('my_invite');
      if (error || !data || typeof data.code !== 'string') return;
      set({ state: { ...data, earned: Number(data.earned) || 0, friends: Array.isArray(data.friends) ? data.friends : [] } });
    } catch { /* Older databases without migration 056 just hide invites. */ }
  },
  redeemPending: async (userId) => {
    const code = get().pending;
    if (!code || !isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('redeem_invite', { p_code: code });
    // Network trouble: keep the code and try again next session. Any answer from the server is final.
    if (error && !error.code && /fetch|network/i.test(error.message)) return;
    write(null);
    set({ pending: null });
    if (error || !data?.id) return;
    useSocialStore.getState().addFriend(userId, { id: data.id, username: data.username, college: data.college });
    toast({ icon: '🤝', text: `You joined with @${data.username}'s invite. You're now friends!`, tone: 'good', ms: 6000 });
  },
  checkNews: async () => {
    if (!isSupabaseConfigured || checking) return;
    checking = true;
    try {
      const { data, error } = await supabase.rpc('invite_news');
      if (error || !Array.isArray(data) || !data.length) return;
      for (const n of data as InviteNews[]) {
        const text = n.kind === 'join' ? `@${n.username} joined with your invite link!` : `@${n.username} reached Level ${INVITES.UNLOCK_LEVEL}. Invite bonus!`;
        toast({ icon: '🤝', text, amount: Number(n.amount), tone: 'good', ms: 7000 });
      }
      const user = useAuthStore.getState().user;
      if (user) void useWalletStore.getState().loadWallet(user.id);
      if (get().state) void get().load();
    } catch { /* older database or offline: try again next time */ } finally { checking = false; }
  },
}));

/** Who invited this visitor (for the sign-up page), or null. */
export async function inviteOwner(code: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('invite_owner', { p_code: code });
    return error || typeof data !== 'string' ? null : data;
  } catch { return null; }
}
