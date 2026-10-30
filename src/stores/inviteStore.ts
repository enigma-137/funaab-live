import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { INVITES, normalizeInviteCode } from '../config/invites';
import { useSocialStore } from './socialStore';
import { toast } from './toastStore';

// Mirror of my_invite() (migration 056). The database links invites and pays rewards.
export interface InvitedFriend { id: string; username: string; college: string; level: number; paid: boolean }
export interface InviteState { code: string; reward: number; level: number; max_paid: number; earned: number; friends: InvitedFriend[] }

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
}

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
}));

/** Who invited this visitor (for the sign-up page), or null. */
export async function inviteOwner(code: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('invite_owner', { p_code: code });
    return error || typeof data !== 'string' ? null : data;
  } catch { return null; }
}
