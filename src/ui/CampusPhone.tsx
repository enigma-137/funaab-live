import { useLevelStore } from '../stores/levelStore';
import { useSugStore } from '../stores/sugStore';
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useGroupStore } from '../stores/groupStore';
import { useSocialStore } from '../stores/socialStore';
import { useWalletStore } from '../stores/walletStore';
import { formatNaira } from '../config/economy';
import { openHostel } from './HostelLife';
import { AppTile } from './phoneIcons';
import { ModalCloseButton } from './ModalCloseButton';
import { useSoundStore } from '../game/audio/gameAudio';
import { useInputStore } from '../stores/inputStore';
import { startCampusTour } from './campusTour';
import { useDailyPlanStore } from '../stores/dailyPlanStore';

type App = { id: string; label: string; glyph: string; colors: [string, string]; open: () => void; badge?: number };

const lagosTime = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' });

/** The campus phone: a home screen of app tiles, opened from the phone launcher. */
export function CampusPhone({ status, onProfile, onClose, closeRef }: {
  status: string;
  onProfile: () => void;
  onClose: () => void;
  closeRef: React.RefObject<HTMLButtonElement>;
}) {
  const user = useAuthStore((s) => s.user)!;
  const setModal = useGameStore((s) => s.setActiveModal);
  const balance = useWalletStore((s) => s.balance);
  const unread = useSocialStore((s) => s.unreadDmCount) + useGroupStore((s) => s.unread);
  const soundOn = useSoundStore((s) => s.enabled);
  const goalsReady = useDailyPlanStore((s) => s.plan?.goals.filter((g) => !g.claimed && g.progress >= g.target).length ?? 0);
  const [time, setTime] = useState(lagosTime);
  // Refresh Today's Plan so the Goals tile can show what's ready to claim.
  useEffect(() => { void useDailyPlanStore.getState().load(); }, []);
  useEffect(() => {
    const t = window.setInterval(() => setTime(lagosTime()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const openMessages = () => setModal('inbox');

  const replayTour = () => {
    onClose();
    // Let the phone close so the tour can point at the HUD behind it.
    window.setTimeout(() => startCampusTour(user.id, useInputStore.getState().isTouchDevice), 250);
  };

  const apps: App[] = [
    { id: 'profile', label: 'Profile', glyph: 'profile', colors: ['#34d399', '#059669'], open: onProfile },
    { id: 'earn', label: 'Earn', glyph: 'earn', colors: ['#4ade80', '#15803d'], open: () => setModal('earn') },
    { id: 'goals', label: 'Goals', glyph: 'goals', colors: ['#fbbf24', '#d97706'], open: () => { setModal(null); useDailyPlanStore.getState().setOpen(true); }, badge: goalsReady },
    { id: 'hostel', label: 'Hostel', glyph: 'hostel', colors: ['#fb923c', '#c2410c'], open: () => openHostel() },
    { id: 'friends', label: 'Friends', glyph: 'friends', colors: ['#60a5fa', '#2563eb'], open: () => setModal('friends') },
    { id: 'league', label: 'League', glyph: 'league', colors: ['#facc15', '#a16207'], open: () => setModal('league') },
    { id: 'garage', label: 'Garage', glyph: 'hostel', colors: ['#93c5fd', '#1d4ed8'], open: () => setModal('garage') },
    { id: 'estate', label: 'Estate', glyph: 'hostel', colors: ['#c4b5fd', '#6d28d9'], open: () => setModal('estate') },
    { id: 'hustles', label: 'Hustles', glyph: 'hustles', colors: ['#4ade80', '#15803d'], open: () => setModal('hustles') },
    { id: 'jobs', label: 'Jobs', glyph: 'jobs', colors: ['#a78bfa', '#6d28d9'], open: () => setModal('campus_jobs') },
    { id: 'level', label: 'Level', glyph: 'level', colors: ['#fbbf24', '#d97706'], open: () => useLevelStore.getState().open() },
    { id: 'controls', label: 'Controls', glyph: 'controls', colors: ['#34d399', '#047857'], open: () => useGameStore.getState().setActiveModal('controls') },
    { id: 'sug', label: 'SUG Vote', glyph: 'vote', colors: ['#38bdf8', '#0369a1'], open: () => useSugStore.getState().open() },
    { id: 'timetable', label: 'Timetable', glyph: 'timetable', colors: ['#f472b6', '#be185d'], open: () => setModal('timetable') },
    { id: 'inventory', label: 'Bag', glyph: 'inventory', colors: ['#fbbf24', '#b45309'], open: () => setModal('inventory') },
    { id: 'daily', label: 'Allowance', glyph: 'daily', colors: ['#f87171', '#b91c1c'], open: () => setModal('daily_reward') },
    { id: 'feedback', label: 'Feedback', glyph: 'feedback', colors: ['#2dd4bf', '#0f766e'], open: () => setModal('feedback') },
    { id: 'sound', label: soundOn ? 'Sound on' : 'Sound off', glyph: soundOn ? 'soundOn' : 'soundOff', colors: soundOn ? ['#818cf8', '#4338ca'] : ['#94a3b8', '#475569'], open: () => useSoundStore.getState().toggle() },
    { id: 'tour', label: 'Tour', glyph: 'tour', colors: ['#22d3ee', '#0e7490'], open: replayTour },
    { id: 'help', label: 'Help', glyph: 'help', colors: ['#94a3b8', '#475569'], open: () => setModal('help') },
    { id: 'signout', label: 'Sign out', glyph: 'signout', colors: ['#64748b', '#1e293b'], open: () => { if (window.confirm('Leave campus and sign out?')) useAuthStore.getState().logout(); } },
  ];
  const dock: App[] = [
    { id: 'messages', label: 'Messages', glyph: 'messages', colors: ['#4ade80', '#16a34a'], open: openMessages, badge: unread },
    { id: 'wallet', label: 'Wallet', glyph: 'wallet', colors: ['#38bdf8', '#0369a1'], open: () => setModal('bank') },
    { id: 'map', label: 'Map', glyph: 'map', colors: ['#facc15', '#ca8a04'], open: () => setModal('campus_map') },
  ];

  const Tile = ({ app, showLabel = true }: { app: App; showLabel?: boolean }) => (
    <button type="button" className="campus-app" onClick={app.open} aria-label={app.badge ? `${app.label}, ${app.badge} unread` : app.label}>
      <span className="campus-app-wrap">
        <AppTile glyph={app.glyph} colors={app.colors} />
        {!!app.badge && <span className="campus-app-badge">{app.badge > 9 ? '9+' : app.badge}</span>}
      </span>
      {showLabel && <span className="campus-app-label">{app.label}</span>}
    </button>
  );

  return (
    <div className="campus-phone-backdrop student-campus-dialog" onClick={onClose}>
      <div className="campus-phone" role="dialog" aria-modal="true" aria-label="Campus phone" onClick={(e) => e.stopPropagation()}>
        <ModalCloseButton onClose={onClose} label="Close phone" style={{ position: 'absolute', top: -14, right: -14, zIndex: 2, borderRadius: 999, boxShadow: '0 4px 12px #0008' }} />
        <div className="campus-phone-screen">
          <div className="campus-phone-status">
            <span>{time}</span>
            <span className="campus-phone-notch" aria-hidden="true" />
            <span aria-hidden="true" className="campus-phone-signal">
              <svg viewBox="0 0 18 10" width="18" height="10"><rect x="0" y="6" width="3" height="4" rx=".6" fill="currentColor" /><rect x="5" y="4" width="3" height="6" rx=".6" fill="currentColor" /><rect x="10" y="2" width="3" height="8" rx=".6" fill="currentColor" /><rect x="15" y="0" width="3" height="10" rx=".6" fill="currentColor" /></svg>
              <svg viewBox="0 0 24 12" width="22" height="11"><rect x=".5" y=".5" width="20" height="11" rx="3" fill="none" stroke="currentColor" /><rect x="2.5" y="2.5" width="13" height="7" rx="1.5" fill="currentColor" /><rect x="21.5" y="4" width="2" height="4" rx="1" fill="currentColor" /></svg>
            </span>
          </div>

          <div className="campus-phone-widget">
            <div className="campus-phone-hello">Hi @{user.username}</div>
            <div className="campus-phone-where">{status}</div>
            <div className="campus-phone-balance">{formatNaira(balance)}</div>
          </div>

          <div className="campus-phone-grid">
            {apps.map((a) => <Tile key={a.id} app={a} />)}
          </div>

          <div className="campus-phone-dock">
            {dock.map((a) => <Tile key={a.id} app={a} />)}
          </div>

          <button ref={closeRef} type="button" className="campus-phone-home" onClick={onClose} aria-label="Close phone">
            <span />
          </button>
        </div>
      </div>
    </div>
  );
}
