import { create } from 'zustand';
import { ChatMessage } from '../types/game';
import { supabase, isSupabaseConfigured, localDB } from '../lib/supabase';

interface Friend {
  id: string;
  username: string;
  college: string;
  status: 'accepted' | 'pending';
}

interface SocialState {
  friends: Friend[];
  mutedUserIds: string[];
  blockedUserIds: string[];
  messages: ChatMessage[];
  unreadCount: number;
  loadSocialData: (userId: string) => void;
  addMessage: (msg: ChatMessage) => void;
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

  resetUnread: () => set({ unreadCount: 0 }),
}));
