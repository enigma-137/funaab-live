import { create } from 'zustand';
import { ChatMessage } from '../types/game';
import { supabase, isSupabaseConfigured, localDB } from '../lib/supabase';
import { useGameStore } from './gameStore';
import { useAuthStore } from './authStore';

export interface Friend {
  id: string;
  username: string;
  college: string;
  status: 'accepted' | 'pending';
}

export interface DmPartner {
  id: string;
  username: string;
  college: string;
}

export interface ReportTarget {
  id: string;
  username: string;
  college?: string;
}

interface SocialState {
  friends: Friend[];
  mutedUserIds: string[];
  blockedUserIds: string[];
  messages: ChatMessage[];
  unreadCount: number;

  // Direct Messaging
  directMessages: Record<string, ChatMessage[]>; // Keyed by partner's username (case-insensitive)
  /** Who each chat is with (id, name, college), keyed like directMessages. */
  dmPartners: Record<string, DmPartner>;
  /** Signed-in student whose messages are loaded (storage owner). */
  dmOwnerId: string | null;
  unreadDmsByPartner: Record<string, number>; // Unread count per partner username
  activeDmPartner: DmPartner | null;
  unreadDmCount: number;
  lastIncomingDm: ChatMessage | null;

  // Safety & Reporting
  activeReportUser: ReportTarget | null;

  loadSocialData: (userId: string) => void;
  addMessage: (msg: ChatMessage) => void;
  addDirectMessage: (msg: ChatMessage) => void;
  dismissLastIncomingDm: () => void;

  openDm: (partner: DmPartner) => void;
  closeDm: () => void;

  openReportModal: (target: ReportTarget) => void;
  closeReportModal: () => void;

  addFriend: (userId: string, targetUser: { id: string; username: string; college: string }) => void;
  removeFriend: (userId: string, targetId: string) => void;
  muteUser: (userId: string, targetId: string) => void;
  unmuteUser: (userId: string, targetId: string) => void;
  blockUser: (userId: string, targetId: string) => void;
  unblockUser: (userId: string, targetId: string) => void;
  reportUser: (reporterId: string, reportedId: string, reason: string, details?: string) => void;
  resetUnread: () => void;
}

// Private messages are kept on this device only, for one day, per signed-in student.
export const DM_KEEP_MS = 24 * 60 * 60 * 1000;
const DM_PER_CHAT = 50;
const DM_CHATS = 20;
const dmKey = (userId: string) => `funaab:dms:v1:${userId}`;
type StoredDms = { messages: Record<string, ChatMessage[]>; partners: Record<string, DmPartner> };

/** Drop messages older than a day and keep the most recent chats only. */
function pruneDms(d: StoredDms, now = Date.now()): StoredDms {
  const entries = Object.entries(d.messages)
    .map(([k, list]) => [k, list.filter((m) => now - m.timestamp < DM_KEEP_MS).slice(-DM_PER_CHAT)] as const)
    .filter(([, list]) => list.length > 0)
    .sort((a, b) => b[1][b[1].length - 1].timestamp - a[1][a[1].length - 1].timestamp)
    .slice(0, DM_CHATS);
  const messages = Object.fromEntries(entries);
  const partners = Object.fromEntries(Object.entries(d.partners).filter(([k]) => k in messages));
  return { messages, partners };
}

function loadDms(userId: string): StoredDms {
  try {
    const raw = localStorage.getItem(dmKey(userId));
    if (raw) return pruneDms(JSON.parse(raw));
  } catch { /* storage blocked or corrupt: start empty */ }
  return { messages: {}, partners: {} };
}

function saveDms(userId: string | null, d: StoredDms) {
  if (!userId) return;
  try { localStorage.setItem(dmKey(userId), JSON.stringify(d)); } catch { /* private mode */ }
}

export type Conversation = { key: string; partner: DmPartner; last: ChatMessage; unread: number };

/** Chats newest first, for the Messages inbox. */
export function listConversations(s: Pick<SocialState, 'directMessages' | 'dmPartners' | 'unreadDmsByPartner'>): Conversation[] {
  const now = Date.now();
  return Object.entries(s.directMessages)
    .map(([key, list]) => {
      const recent = list.filter((m) => now - m.timestamp < DM_KEEP_MS);
      const last = recent[recent.length - 1];
      if (!last) return null;
      const incoming = recent.find((m) => m.senderName.toLowerCase() === key);
      const partner = s.dmPartners[key] ?? {
        id: incoming?.senderId ?? key,
        username: incoming?.senderName ?? last.recipientUsername ?? key,
        college: incoming?.college ?? 'STUDENT',
      };
      return { key, partner, last, unread: s.unreadDmsByPartner[key] ?? 0 };
    })
    .filter((c): c is Conversation => !!c)
    .sort((a, b) => b.last.timestamp - a.last.timestamp);
}

export const useSocialStore = create<SocialState>((set, get) => ({
  friends: [],
  mutedUserIds: [],
  blockedUserIds: [],
  messages: [
    {
      id: 'sys-welcome',
      senderId: 'system',
      senderName: 'FUNAAB Portal',
      college: 'CAMPUS',
      text: 'Welcome to FUNAAB Life! Walk around to explore, meet students and take a Keke.',
      timestamp: Date.now(),
      isSystem: true,
    },
  ],
  unreadCount: 0,

  directMessages: {},
  dmPartners: {},
  dmOwnerId: null,
  unreadDmsByPartner: {},
  activeDmPartner: null,
  unreadDmCount: 0,
  lastIncomingDm: null,
  activeReportUser: null,

  loadSocialData: (userId: string) => {
    const friends = localDB.getFriends(userId);
    const mutes = localDB.getMutes(userId);
    const blocks = localDB.getBlocks(userId);
    const dms = get().dmOwnerId === userId ? null : loadDms(userId);
    set({
      friends: friends || [],
      mutedUserIds: mutes || [],
      blockedUserIds: blocks || [],
      ...(dms && { directMessages: dms.messages, dmPartners: dms.partners, dmOwnerId: userId, unreadDmsByPartner: {}, unreadDmCount: 0, activeDmPartner: null }),
    });
  },

  addMessage: (msg: ChatMessage) => {
    const { blockedUserIds, mutedUserIds } = get();
    // Filter out messages from blocked or muted users
    if (blockedUserIds.includes(msg.senderId) || mutedUserIds.includes(msg.senderId)) {
      return;
    }

    set((state) => ({
      messages: [...state.messages.slice(-60), msg], // keep last 60
      unreadCount: state.unreadCount + 1,
    }));
  },

  addDirectMessage: (msg: ChatMessage) => {
    const { blockedUserIds, mutedUserIds, activeDmPartner } = get();
    if (blockedUserIds.includes(msg.senderId) || mutedUserIds.includes(msg.senderId)) {
      return;
    }

    const currentUsername = useAuthStore.getState().user?.username?.toLowerCase();
    const sender = (msg.senderName || '').toLowerCase();
    const recipient = (msg.recipientUsername || '').toLowerCase();

    // The DM conversation key is always the other party's username in lowercase
    let key = sender;
    if (currentUsername && sender === currentUsername && recipient) {
      key = recipient;
    } else if (!sender) {
      key = 'dm';
    }

    set((state) => {
      const existing = state.directMessages[key] || [];
      // Prevent duplicate messages if already present
      if (existing.some((m) => m.id === msg.id)) {
        return state;
      }
      const updatedList = [...existing, msg];
      const isCurrentlyViewing = activeDmPartner && activeDmPartner.username.toLowerCase() === key;
      const isFromSelf = currentUsername && sender === currentUsername;

      const newPartnerUnread = (isCurrentlyViewing || isFromSelf)
        ? 0
        : (state.unreadDmsByPartner[key] || 0) + 1;

      const updatedUnreadByPartner = {
        ...state.unreadDmsByPartner,
        [key]: newPartnerUnread,
      };

      const totalUnread = Object.values(updatedUnreadByPartner).reduce((acc, c) => acc + c, 0);

      const known = state.dmPartners[key];
      const partner: DmPartner = isFromSelf
        ? { id: msg.recipientId || known?.id || key, username: msg.recipientUsername || known?.username || key, college: known?.college || 'STUDENT' }
        : { id: msg.senderId, username: msg.senderName, college: msg.college || known?.college || 'STUDENT' };
      const stored = pruneDms({
        messages: { ...state.directMessages, [key]: updatedList },
        partners: { ...state.dmPartners, [key]: partner },
      });
      saveDms(state.dmOwnerId, stored);

      return {
        directMessages: stored.messages,
        dmPartners: stored.partners,
        unreadDmsByPartner: updatedUnreadByPartner,
        unreadDmCount: totalUnread,
        lastIncomingDm: (!isCurrentlyViewing && !isFromSelf) ? msg : state.lastIncomingDm,
      };
    });
  },

  dismissLastIncomingDm: () => {
    set({ lastIncomingDm: null });
  },

  openDm: (partner: DmPartner) => {
    const partnerKey = partner.username.toLowerCase();
    set((state) => {
      const updatedUnreadByPartner = {
        ...state.unreadDmsByPartner,
        [partnerKey]: 0,
      };
      const totalUnread = Object.values(updatedUnreadByPartner).reduce((acc, c) => acc + c, 0);

      // Remember who this chat is with, so the inbox can show it even before anyone writes.
      const dmPartners = { ...state.dmPartners, [partnerKey]: { ...state.dmPartners[partnerKey], ...partner } };
      return {
        activeDmPartner: partner,
        dmPartners,
        unreadDmsByPartner: updatedUnreadByPartner,
        unreadDmCount: totalUnread,
        lastIncomingDm: state.lastIncomingDm?.senderName.toLowerCase() === partnerKey ? null : state.lastIncomingDm,
      };
    });
    useGameStore.getState().setActiveModal('private_chat');
  },

  closeDm: () => {
    set({ activeDmPartner: null });
    const { activeModal, setActiveModal } = useGameStore.getState();
    if (activeModal === 'private_chat') {
      setActiveModal(null);
    }
  },

  openReportModal: (target: ReportTarget) => {
    set({ activeReportUser: target });
    useGameStore.getState().setActiveModal('report_user');
  },

  closeReportModal: () => {
    set({ activeReportUser: null });
    const { activeModal, setActiveModal } = useGameStore.getState();
    if (activeModal === 'report_user') {
      setActiveModal(null);
    }
  },

  addFriend: (userId: string, targetUser: { id: string; username: string; college: string }) => {
    const current = get().friends;
    if (current.some((f) => f.id === targetUser.id)) return;

    const newFriend: Friend = {
      id: targetUser.id,
      username: targetUser.username,
      college: targetUser.college,
      status: 'accepted',
    };

    const updated = [...current, newFriend];
    set({ friends: updated });
    localDB.saveFriends(userId, updated);

    if (isSupabaseConfigured) {
      supabase.from('friends').insert([
        { user_id: userId, friend_id: targetUser.id, status: 'accepted' },
      ]).then();
    }
  },

  removeFriend: (userId: string, targetId: string) => {
    const updated = get().friends.filter((f) => f.id !== targetId);
    set({ friends: updated });
    localDB.saveFriends(userId, updated);
  },

  muteUser: (userId: string, targetId: string) => {
    const updated = [...new Set([...get().mutedUserIds, targetId])];
    set({ mutedUserIds: updated });
    localDB.saveMutes(userId, updated);
  },

  unmuteUser: (userId: string, targetId: string) => {
    const updated = get().mutedUserIds.filter((id) => id !== targetId);
    set({ mutedUserIds: updated });
    localDB.saveMutes(userId, updated);
  },

  blockUser: (userId: string, targetId: string) => {
    const updated = [...new Set([...get().blockedUserIds, targetId])];
    set({ blockedUserIds: updated });
    localDB.saveBlocks(userId, updated);

    if (isSupabaseConfigured) {
      supabase.from('blocks').insert([{ user_id: userId, blocked_user_id: targetId }]).then();
    }
  },

  unblockUser: (userId: string, targetId: string) => {
    const updated = get().blockedUserIds.filter((id) => id !== targetId);
    set({ blockedUserIds: updated });
    localDB.saveBlocks(userId, updated);
  },

  reportUser: (reporterId: string, reportedId: string, reason: string, details?: string) => {
    const report = {
      reporter_id: reporterId,
      reported_user_id: reportedId,
      reason,
      details: details || '',
      created_at: new Date().toISOString(),
    };
    localDB.saveReport(report);

    if (isSupabaseConfigured) {
      supabase.from('reports').insert([report]).then();
    }
  },

  resetUnread: () => set({ unreadCount: 0, unreadDmCount: 0 }),
}));
