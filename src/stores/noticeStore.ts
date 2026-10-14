import { create } from 'zustand';
import { networkManager } from '../game/multiplayer/networkManager';
import { announcementActive, type Announcement } from '../config/broadcast';

// What the owner sent from Telegram (/notification …), plus "a newer version of the game is live".
const SEEN = 'funaab:notice-seen';
const readSeen = () => { try { return localStorage.getItem(SEEN); } catch { return null; } };

interface NoticeStore {
  announcement: Announcement | null;
  dismissedId: string | null;
  /** True when the site has been updated since this tab loaded. */
  updateReady: boolean;
  receive: (a: Announcement | null) => void;
  load: () => Promise<void>;
  dismiss: () => void;
  checkVersion: () => Promise<void>;
}

export const useNoticeStore = create<NoticeStore>((set, get) => ({
  announcement: null,
  dismissedId: readSeen(),
  updateReady: false,
  receive: (a) => set({ announcement: announcementActive(a) ? a : null }),
  load: async () => {
    try { get().receive(await networkManager.announcement()); } catch { /* feed unavailable: keep what we have */ }
  },
  dismiss: () => {
    const id = get().announcement?.id ?? null;
    try { if (id) localStorage.setItem(SEEN, id); } catch { /* private mode */ }
    set({ dismissedId: id });
  },
  checkVersion: async () => {
    if (typeof __BUILD_ID__ === 'undefined' || get().updateReady) return;
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return;
      const { build } = await r.json();
      if (typeof build === 'string' && build !== __BUILD_ID__) set({ updateReady: true });
    } catch { /* offline: try again later */ }
  },
}));
