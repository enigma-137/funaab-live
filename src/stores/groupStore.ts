import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toast } from './toastStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { GROUP_CHAT, hasLink } from '../config/groupChat';

export interface GroupSummary {
  id: string; name: string; owner: string; count: number; unread: number;
  last: { id: number; kind: 'text' | 'system'; body: string; sender: string | null; at: string } | null;
  at: string;
}
export interface GroupMessage { id: number; kind: 'text' | 'system'; body: string; sender_id: string | null; sender: string | null; college: string | null; at: string }
export interface GroupMember { id: string; username: string; college: string }
export interface GroupView { id: string; name: string; owner: string; members: GroupMember[]; messages: GroupMessage[] }

interface GroupStore {
  groups: GroupSummary[];
  unread: number;
  /** The group open on screen. */
  open: GroupView | null;
  busy: boolean;
  error: string | null;
  loadList: () => Promise<void>;
  openGroup: (id: string) => Promise<void>;
  close: () => void;
  refresh: () => Promise<void>;
  send: (body: string) => Promise<boolean>;
  create: (name: string, members: string[]) => Promise<string | null>;
  add: (user: string) => Promise<boolean>;
  remove: (user: string) => Promise<boolean>;
  rename: (name: string) => Promise<boolean>;
  leave: () => Promise<boolean>;
  /** Someone in a group sent something: refresh what's on screen, or note it as unread. */
  pinged: (groupId: string, from: string) => void;
}

const fail = (e: unknown) => (e as { message?: string })?.message || 'Something went wrong';
/** Tell the other members who are online to fetch the new message. */
const ping = (groupId: string, members: string[] | undefined) => { if (members?.length) networkManager.groupPing(groupId, members); };

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [], unread: 0, open: null, busy: false, error: null,

  loadList: async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('group_list');
    if (error || !Array.isArray(data)) return;
    const groups = (data as GroupSummary[]).map((g) => ({ ...g, count: Number(g.count), unread: get().open?.id === g.id ? 0 : Number(g.unread) }));
    set({ groups, unread: groups.reduce((n, g) => n + g.unread, 0) });
  },

  openGroup: async (id) => {
    set({ busy: true, error: null });
    const { data, error } = await supabase.rpc('group_messages', { p_group: id, p_after: 0 });
    set({ busy: false });
    if (error) { toast({ icon: '👥', text: fail(error), tone: 'bad' }); void get().loadList(); return; }
    set({ open: data as GroupView });
    const groups = get().groups.map((g) => (g.id === id ? { ...g, unread: 0 } : g));
    set({ groups, unread: groups.reduce((n, g) => n + g.unread, 0) });
  },

  close: () => set({ open: null, error: null }),

  refresh: async () => {
    const cur = get().open;
    if (!cur) return;
    const after = cur.messages[cur.messages.length - 1]?.id ?? 0;
    const { data, error } = await supabase.rpc('group_messages', { p_group: cur.id, p_after: after });
    if (error) { // Removed from the group, or it was deleted.
      if (get().open?.id === cur.id) { set({ open: null }); toast({ icon: '👥', text: fail(error), tone: 'bad' }); }
      void get().loadList();
      return;
    }
    const v = data as GroupView, now = get().open;
    if (!now || now.id !== cur.id) return;
    const seen = new Set(now.messages.map((m) => m.id));
    const messages = [...now.messages, ...v.messages.filter((m) => !seen.has(m.id))].slice(-GROUP_CHAT.keep);
    set({ open: { ...v, messages } });
  },

  send: async (body) => {
    const cur = get().open, text = body.trim();
    if (!cur || !text) return false;
    if (hasLink(text)) { set({ error: 'Links are not allowed in groups.' }); return false; }
    set({ error: null });
    const { data, error } = await supabase.rpc('group_send', { p_group: cur.id, p_body: text });
    if (error) { set({ error: fail(error) }); return false; }
    ping(cur.id, (data as { members: string[] }).members);
    await get().refresh();
    return true;
  },

  create: async (name, members) => {
    if (hasLink(name)) { set({ error: 'Links are not allowed in groups.' }); return null; }
    set({ busy: true, error: null });
    const { data, error } = await supabase.rpc('group_create', { p_name: name, p_members: members });
    set({ busy: false });
    if (error) { set({ error: fail(error) }); return null; }
    const r = data as { id: string; members: string[] };
    ping(r.id, r.members);
    await get().loadList();
    return r.id;
  },

  add: async (user) => adminCall('group_add', { p_user: user }),
  remove: async (user) => adminCall('group_remove', { p_user: user }),
  rename: async (name) => {
    if (hasLink(name)) { set({ error: 'Links are not allowed in groups.' }); return false; }
    return adminCall('group_rename', { p_name: name });
  },

  leave: async () => {
    const cur = get().open;
    if (!cur) return false;
    const { data, error } = await supabase.rpc('group_leave', { p_group: cur.id });
    if (error) { set({ error: fail(error) }); return false; }
    ping(cur.id, (data as { members: string[] }).members);
    set({ open: null });
    await get().loadList();
    return true;
  },

  pinged: (groupId, from) => {
    if (get().open?.id === groupId) { void get().refresh(); return; }
    void get().loadList().then(() => {
      const g = get().groups.find((x) => x.id === groupId);
      if (g && g.unread > 0 && g.last?.kind === 'text') toast({ icon: '👥', text: `${g.name} · ${from}: ${g.last.body.slice(0, 60)}`, tone: 'info' });
    });
  },
}));

async function adminCall(fn: 'group_add' | 'group_remove' | 'group_rename', args: Record<string, string>) {
  const s = useGroupStore.getState(), cur = s.open;
  if (!cur) return false;
  useGroupStore.setState({ busy: true, error: null });
  const { data, error } = await supabase.rpc(fn, { p_group: cur.id, ...args });
  useGroupStore.setState({ busy: false });
  if (error) { useGroupStore.setState({ error: fail(error) }); return false; }
  // A removed member is pinged too, so their screen closes the group.
  ping(cur.id, [...(data as { members: string[] }).members, ...(fn === 'group_remove' ? [args.p_user] : [])]);
  await s.refresh();
  void s.loadList();
  return true;
}
