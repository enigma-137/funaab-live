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
  unreadDmsByPartner: {},
  activeDmPartner: null,
  unreadDmCount: 0,
  lastIncomingDm: null,
  activeReportUser: null,

  loadSocialData: (userId: string) => {
    const friends = localDB.getFriends(userId);
    const mutes = localDB.getMutes(userId);
    const blocks = localDB.getBlocks(userId);
    set({
      friends: friends || [],
      mutedUserIds: mutes || [],
      blockedUserIds: blocks || [],
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

      return {
        directMessages: {
          ...state.directMessages,
          [key]: updatedList,
        },
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

      return {
        activeDmPartner: partner,
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
