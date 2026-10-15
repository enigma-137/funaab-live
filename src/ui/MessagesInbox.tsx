import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useSocialStore, listConversations } from '../stores/socialStore';
import { ModalCloseButton } from './ModalCloseButton';
import { useGroupStore } from '../stores/groupStore';

const ago = (t: number, now: number) => {
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
};

/** Phone → Messages: your groups, then everyone who messaged you (or you messaged) in the last day, newest first. */
export function MessagesInbox() {
  const me = useAuthStore((s) => s.user)!;
  const setModal = useGameStore((s) => s.setActiveModal);
  const parts = useSocialStore(useShallow((s) => ({ directMessages: s.directMessages, dmPartners: s.dmPartners, unreadDmsByPartner: s.unreadDmsByPartner })));
  const [now, setNow] = useState(Date.now());
  const chats = useMemo(() => listConversations(parts), [parts.directMessages, parts.dmPartners, parts.unreadDmsByPartner, now]);
  const close = () => setModal(null);
  const groups = useGroupStore((s) => s.groups);
  const openGroup = async (id: string) => { await useGroupStore.getState().openGroup(id); if (useGroupStore.getState().open?.id === id) setModal('group_chat'); };

  useEffect(() => {
    void useGroupStore.getState().loadList();
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => { window.clearInterval(t); window.removeEventListener('keydown', key); };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900 font-['Plus_Jakarta_Sans'] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-3.5">
          <div>
            <h2 id="inbox-title" className="font-['Outfit'] text-base font-bold">Messages</h2>
            <p className="text-[11px] text-slate-400">Groups, and chats from the last 24 hours.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setModal('new_group')} className="whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold hover:bg-emerald-500">+ New group</button>
            <ModalCloseButton onClose={close} />
          </div>
        </div>

        {groups.length > 0 && (
          <ul className="max-h-[40vh] shrink-0 overflow-y-auto border-b border-slate-700/70 py-1.5">
            {groups.map((g) => {
              const last = g.last ? (g.last.kind === 'system' ? g.last.body : `${g.last.sender === me.username ? 'You' : `@${g.last.sender}`}: ${g.last.body}`) : 'No messages yet';
              return (
                <li key={g.id}>
                  <button type="button" onClick={() => openGroup(g.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-800/70 active:bg-slate-800">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600/30 text-lg" aria-hidden="true">👥</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className={`truncate text-sm ${g.unread ? 'font-extrabold' : 'font-bold'}`}>{g.name}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">{g.count} people</span>
                      </span>
                      <span className={`block truncate text-xs ${g.unread ? 'font-semibold text-white' : 'text-slate-400'}`}>{last}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-slate-500">{ago(new Date(g.at).getTime(), now)}</span>
                      {g.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold">{g.unread > 9 ? '9+' : g.unread}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {chats.length === 0 && groups.length > 0 ? null : chats.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="text-3xl" aria-hidden="true">💬</div>
            <div className="mt-2 font-['Outfit'] text-sm font-bold">No messages yet</div>
            <p className="mt-1 text-xs text-slate-400">Tap a student on campus, or a friend, to send a message. Or make a group with your friends.</p>
            <button type="button" onClick={() => setModal('friends')} className="mt-4 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold hover:bg-emerald-500">
              Open Friends
            </button>
          </div>
        ) : (
          <ul className="overflow-y-auto py-1.5">
            {chats.map((c) => {
              const mine = c.last.senderName.toLowerCase() === me.username.toLowerCase();
              const text = c.last.transferData
                ? `${mine ? 'You sent' : 'Sent you'} ₦${c.last.transferData.amount.toLocaleString()}`
                : `${mine ? 'You: ' : ''}${c.last.text}`;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => useSocialStore.getState().openDm(c.partner)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-800/70 active:bg-slate-800"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600/30 font-['Outfit'] text-base font-bold text-emerald-200">
                      {c.partner.username[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className={`truncate text-sm ${c.unread ? 'font-extrabold' : 'font-bold'}`}>@{c.partner.username}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">{c.partner.college}</span>
                      </span>
                      <span className={`block truncate text-xs ${c.unread ? 'font-semibold text-white' : 'text-slate-400'}`}>{text}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-slate-500">{ago(c.last.timestamp, now)}</span>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold">{c.unread > 9 ? '9+' : c.unread}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-slate-700/70 px-4 py-2 text-center text-[10.5px] text-slate-500">
          Private messages stay on this device for a day. Groups keep their last 200 messages. No links in groups.
        </p>
      </div>
    </div>
  );
}
