import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { getLagosTime } from '../utils/lagosTime';
import { getActiveLectureForTime } from '../config/lectureSchedule';
import { campusZoneName } from '../config/campusLocations';
import { useDailyPlanStore } from '../stores/dailyPlanStore';
import { useLevelStore, levelLabel } from '../stores/levelStore';
import { useSocialStore } from '../stores/socialStore';
import { useShallow } from 'zustand/react/shallow';
import { mapPeople } from '../config/mapPeople';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function placeName(roomId: string, owner: string | null, x: number, z: number) {
  if (roomId === 'world:funaab:library') return 'Library';
  if (roomId.startsWith('world:funaab:hostel-room:')) return owner ? 'Hostel room' : 'Hostel';
  if (roomId === 'world:funaab:hostel') return 'Hostel';
  return campusZoneName(x, z);
}

/** Who's on campus right now (same count as the campus map), so nobody has to open the map to check. */
function OnlineNow() {
  const user = useAuthStore((s) => s.user);
  const friendList = useSocialStore((s) => s.friends);
  const blocked = useSocialStore((s) => s.blockedUserIds);
  // Counts only, so students walking about don't re-render this.
  const [count, friends] = useGameStore(useShallow((s) => {
    const people = mapPeople(s.players, user, friendList, blocked);
    return [people.length, people.filter((p) => p.friend).length];
  }));
  const label = `${count} on campus${friends ? `, ${friends} ${friends === 1 ? 'friend' : 'friends'}` : ''}. Open the campus map.`;
  return (
    <button type="button" className={`campus-status-online${friends ? ' has-friends' : ''}`} onClick={() => useGameStore.getState().setActiveModal('campus_map')} aria-label={label} title={label}>
      <i aria-hidden className={count ? 'is-on' : ''} />{count} online
    </button>
  );
}

/** Always-visible "where am I in my day" line: Lagos time, place, who's online, next class, wallet change. */
export function StatusStrip() {
  const user = useAuthStore((s) => s.user);
  const activeModal = useGameStore((s) => s.activeModal);
  // Rounded so walking only re-renders when the student moves to a different 4 m cell.
  const cell = useGameStore((s) => `${Math.round(s.myPosition[0] / 4)}:${Math.round(s.myPosition[2] / 4)}`);
  const roomId = useHostelStore((s) => s.roomId);
  const owner = useHostelStore((s) => s.owner);
  const balance = useWalletStore((s) => s.balance);
  const streak = useDailyPlanStore((s) => s.plan?.streak.current ?? 0);
  const level = useLevelStore((s) => s.state);
  useEffect(() => { void useLevelStore.getState().load(); const t = setInterval(() => void useLevelStore.getState().load(), 60000); return () => clearInterval(t); }, []);
  const [now, setNow] = useState(Date.now());
  const [delta, setDelta] = useState<{ id: number; amount: number } | null>(null);
  const prev = useRef<number | null>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const before = prev.current;
    prev.current = balance;
    // Skip the first wallet load after joining; flash only real earn/spend events.
    if (before === null || Date.now() - mountedAt.current < 4000 || before === balance) return;
    const id = Date.now();
    setDelta({ id, amount: balance - before });
    const t = setTimeout(() => setDelta((d) => (d?.id === id ? null : d)), 2800);
    return () => clearTimeout(t);
  }, [balance]);

  // Rooms (hostel, lodge, library) have their own top bar with the way back to campus.
  if (!user || activeModal || roomId !== 'world:funaab:main') return null;
  const t = getLagosTime(now);
  const [x, z] = cell.split(':').map((n) => Number(n) * 4);
  const lecture = getActiveLectureForTime(now);
  const lectureText = lecture.status === 'active' && lecture.activeLecture
    ? `${lecture.activeLecture.courseCode} live`
    : lecture.status === 'upcoming' && lecture.nextLecture
      ? `${lecture.nextLecture.courseCode} ${lecture.nextStartTimeText.toLowerCase()}`
      : 'No classes now';

  return (
    <div className="campus-status" role="status" aria-label="Your day">
      {level && <button type="button" className="campus-status-level" onClick={() => useLevelStore.getState().open()} aria-label={`Level ${level.level}, see how to level up`}>{levelLabel(level)}</button>}
      <span className="campus-status-time">{DAYS[t.dayOfWeek]} {String(t.hour).padStart(2, '0')}:{String(t.minute).padStart(2, '0')}</span>
      <span className="campus-status-dot" aria-hidden>·</span>
      <span className="campus-status-place">{placeName(roomId, owner, x, z)}</span>
      <span className="campus-status-dot" aria-hidden>·</span>
      <OnlineNow />
      <span className="campus-status-dot" aria-hidden>·</span>
      <span className={`campus-status-class${lecture.status === 'active' ? ' is-live' : ''}`}>🎓 {lectureText}</span>
      {streak > 0 && <span className="campus-status-streak" title={`${streak}-day streak`}>🔥{streak}</span>}
      {delta && (
        <span key={delta.id} className={`campus-status-delta ${delta.amount > 0 ? 'is-up' : 'is-down'}`}>
          {delta.amount > 0 ? '+' : '−'}₦{Math.abs(delta.amount).toLocaleString()}
        </span>
      )}
    </div>
  );
}
