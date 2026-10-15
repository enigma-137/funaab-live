import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Send, UserPlus, UserMinus, LogOut, Pencil, ArrowLeft } from 'lucide-react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useGroupStore } from '../stores/groupStore';
import { GROUP_CHAT, hasLink } from '../config/groupChat';

const time = (at: string) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const LINK_NOTE = 'Links are not allowed in groups.';

/** Keeps the group list (and unread badge) fresh while you play. */
export function GroupWatcher() {
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (!user) return;
    const load = () => { if (document.visibilityState === 'visible') void useGroupStore.getState().loadList(); };
    load();
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, [user?.id]);
  return null;
}

/** Phone → Messages → New group: a name and some friends. */
export function NewGroupSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const friends = useSocialStore((s) => s.friends);
  const { busy, error } = useGroupStore();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= GROUP_CHAT.maxMembers - 1 ? p : [...p, id]));
  const nameLink = hasLink(name);
  const create = async () => {
    const id = await useGroupStore.getState().create(name, picked);
    if (id) { await useGroupStore.getState().openGroup(id); setModal('group_chat'); }
  };
  useEffect(() => { useGroupStore.setState({ error: null }); }, []);

  return (
    <Sheet title="New group" subtitle={`Up to ${GROUP_CHAT.maxMembers} people · friends only`} icon={<Users className="h-4 w-4" />} accent="#059669" onClose={() => setModal('inbox')}
      footer={(
        <div className="space-y-2">
          {(error || nameLink) && <p className="text-xs font-semibold text-red-400">{nameLink ? LINK_NOTE : error}</p>}
          <button type="button" disabled={busy || !name.trim() || nameLink} onClick={create}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            {busy ? 'Creating…' : `Create group${picked.length ? ` with ${picked.length} friend${picked.length > 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
      )}>
      <div className="space-y-4 p-4">
        <label className="block">
          <span className="text-xs font-semibold text-slate-400">Group name</span>
          <input value={name} maxLength={GROUP_CHAT.nameMax} onChange={(e) => setName(e.target.value)} placeholder="e.g. COLENG 200L"
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-400">Add friends ({picked.length}/{GROUP_CHAT.maxMembers - 1})</div>
          {friends.length === 0 ? (
            <p className="rounded-xl bg-slate-950/70 p-4 text-center text-xs text-slate-400">No friends yet. Tap a student on campus to add them as a friend, then add them here. You can also make the group now and add people later.</p>
          ) : (
            <ul className="space-y-1.5">
              {friends.map((f) => {
                const on = picked.includes(f.id);
                return (
                  <li key={f.id}>
                    <button type="button" onClick={() => toggle(f.id)} aria-pressed={on}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${on ? 'border-emerald-500 bg-emerald-950/50' : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'}`}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-sm font-bold text-emerald-200">{f.username[0]?.toUpperCase()}</span>
                      <span className="flex-1 text-sm font-semibold">@{f.username} <span className="text-[10px] text-slate-500">{f.college}</span></span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${on ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-600'}`}>{on ? '✓' : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** One group: messages, and (for the admin) people and the name. */
export function GroupChatSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const me = useAuthStore((s) => s.user);
  const friends = useSocialStore((s) => s.friends);
  const { open, error, busy } = useGroupStore();
  const [text, setText] = useState('');
  const [people, setPeople] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const back = () => { useGroupStore.getState().close(); setModal('inbox'); };

  // The open group is refreshed often; pings from the Worker make it near-instant when you share a room.
  useEffect(() => {
    useGroupStore.setState({ error: null });
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void useGroupStore.getState().refresh(); }, 4000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { if (!people) end.current?.scrollIntoView({ block: 'end' }); }, [open?.messages.length, people]);
  useEffect(() => { if (!open) setModal('inbox'); }, [!open]);

  const admin = !!open && !!me && open.owner === me.id;
  const addable = useMemo(() => friends.filter((f) => !open?.members.some((m) => m.id === f.id)), [friends, open?.members]);
  if (!open || !me) return null;
  const textLink = hasLink(text);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || textLink) return;
    if (await useGroupStore.getState().send(text)) setText('');
  };

  const footer = people ? undefined : (
    <form onSubmit={send} className="space-y-1.5">
      {(error || textLink) && <p className="text-xs font-semibold text-red-400">{textLink ? LINK_NOTE : error}</p>}
      <div className="flex gap-2">
        <input value={text} maxLength={GROUP_CHAT.messageMax} onChange={(e) => setText(e.target.value)} placeholder="Message the group"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
        <button type="submit" aria-label="Send" disabled={!text.trim() || textLink}
          className="flex w-11 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </div>
    </form>
  );

  return (
    <Sheet title={open.name} subtitle={`${open.members.length} people${admin ? ' · you are the admin' : ''}`} icon={<Users className="h-4 w-4" />} accent="#059669" onClose={() => { useGroupStore.getState().close(); setModal(null); }} footer={footer}>
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
        <button type="button" onClick={back} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"><ArrowLeft className="h-3.5 w-3.5" /> Messages</button>
        <span className="flex-1" />
        <button type="button" onClick={() => setPeople((p) => !p)} className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-white hover:bg-slate-700">{people ? 'Back to chat' : 'People'}</button>
      </div>

      {people ? (
        <div className="space-y-4 p-4">
          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
          {admin && (newName === null ? (
            <button type="button" onClick={() => setNewName(open.name)} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><Pencil className="h-3.5 w-3.5" /> Rename group</button>
          ) : (
            <div className="flex gap-2">
              <input value={newName} maxLength={GROUP_CHAT.nameMax} onChange={(e) => setNewName(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
              <button type="button" disabled={busy || !newName.trim() || hasLink(newName)} onClick={async () => { if (await useGroupStore.getState().rename(newName)) setNewName(null); }} className="rounded-xl bg-emerald-600 px-3 text-xs font-bold disabled:opacity-50">Save</button>
            </div>
          ))}
          <ul className="space-y-1.5">
            {open.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl bg-slate-950/70 px-3 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-sm font-bold text-emerald-200">{m.username[0]?.toUpperCase()}</span>
                <span className="flex-1 text-sm font-semibold">@{m.username}{m.id === me.id ? ' (you)' : ''} <span className="text-[10px] text-slate-500">{m.college}</span>{m.id === open.owner && <span className="ml-1 rounded bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">Admin</span>}</span>
                {admin && m.id !== me.id && (
                  <button type="button" disabled={busy} onClick={() => useGroupStore.getState().remove(m.id)} aria-label={`Remove ${m.username}`} className="rounded-lg p-1.5 text-red-300 hover:bg-red-950/60"><UserMinus className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
          {admin && open.members.length < GROUP_CHAT.maxMembers && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-400">Add friends</div>
              {addable.length === 0 ? <p className="text-xs text-slate-500">All your friends are in the group.</p> : (
                <ul className="space-y-1.5">
                  {addable.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-800 px-3 py-2">
                      <span className="flex-1 text-sm">@{f.username} <span className="text-[10px] text-slate-500">{f.college}</span></span>
                      <button type="button" disabled={busy} onClick={() => useGroupStore.getState().add(f.id)} aria-label={`Add ${f.username}`} className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-950/60"><UserPlus className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button type="button" onClick={async () => { if (window.confirm(`Leave ${open.name}?`) && await useGroupStore.getState().leave()) setModal('inbox'); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 py-2.5 text-sm font-bold text-red-300 hover:bg-red-950/50"><LogOut className="h-4 w-4" /> Leave group</button>
        </div>
      ) : (
        <div className="space-y-2 px-3 py-3">
          {open.messages.map((m) => {
            if (m.kind === 'system') return <div key={m.id} className="text-center text-[11px] text-slate-500">{m.body}</div>;
            const mine = m.sender_id === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-slate-800 text-slate-100'}`}>
                  {!mine && <div className="text-[11px] font-bold text-emerald-300">@{m.sender ?? 'someone'}</div>}
                  <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
                  <div className={`mt-0.5 text-right text-[10px] ${mine ? 'text-emerald-100/80' : 'text-slate-400'}`}>{time(m.at)}</div>
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>
      )}
    </Sheet>
  );
}
