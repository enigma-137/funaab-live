import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Smartphone, X, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useSocialStore } from '../stores/socialStore';
import { useStudentStore } from '../stores/studentStore';
import { useWalletStore } from '../stores/walletStore';
import { useLectureStore } from '../stores/lectureStore';
import { courseById } from '../config/academics';
import { orientationTasks } from '../config/studentJourney';
import { normalizeAvatar } from '../config/avatar';
import world from '../worlds/funaab/world.json';
import './student.css';

const AvatarEditor = lazy(() => import('./AvatarEditor'));
const AvatarPreview = lazy(() =>
  import('./AvatarEditor').then((m) => ({ default: m.AvatarPreview })),
);
const collegePoint = (college: string) =>
  world.locations.find(
    (l) =>
      l.id ===
      (
        {
          COLENG: 'coleng',
          COLFHEC: 'colfhec',
          COLPLANT: 'colerm-colplant',
          COLBIOS: 'colbios-lecture-hall',
        } as Record<string, string>
      )[college],
  ) || world.locations.find((l) => l.id === 'central-lecture-hall')!;
const near = (p: number[], target: number[], distance: number) =>
  Math.hypot(p[0] - target[0], p[2] - target[2]) < distance;

export function StudentCampusTools() {
  const user = useAuthStore((s) => s.user)!;
  const modal = useGameStore((s) => s.activeModal);
  const setModal = useGameStore((s) => s.setActiveModal);
  const { journey, saving, error } = useStudentStore();
  const friends = useSocialStore((s) => s.friends);
  const [editing, setEditing] = useState(false);
  const [map, setMap] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [avatar, setAvatar] = useState(() => normalizeAvatar(user.avatarConfig));
  const busy = useRef(false);
  const [status, setStatus] = useState('On campus');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!journey) useStudentStore.getState().load(user.id);
    const interval = window.setInterval(async () => {
      const game = useGameStore.getState(),
        student = useStudentStore.getState();
      const nearest = world.locations.find((l) => near(game.myPosition, l.position, 12));
      setStatus(
        useLectureStore.getState().isInClassroom
          ? 'In class'
          : game.isRidingKeke
            ? 'In a Keke'
            : nearest
              ? `At ${nearest.name}`
              : 'On campus',
      );
      if (busy.current || !student.journey || student.journey.orientation_completed) return;
      const steps: string[] = [];
      if (near(game.myPosition, [-30, 0, 26], 13)) steps.push('car-park');
      if (game.isRidingKeke) steps.push('keke');
      if (near(game.myPosition, collegePoint(user.college).position, 15)) steps.push('college');
      if (useWalletStore.getState().transactions.some((t) => t.type === 'food_purchase'))
        steps.push('food');
      if (game.selectedPlayer && near(game.myPosition, game.selectedPlayer.position, 12))
        steps.push('student');
      busy.current = true;
      try {
        await student.markSteps(steps);
      } finally {
        busy.current = false;
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [user.id, user.college]);
  const showing = modal === 'student_phone' || modal === 'student_profile';
  useEffect(() => {
    if (!showing) return;
    const previous = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const nodes = [
          ...document.querySelectorAll<HTMLElement>(
            '.student-campus-dialog button:not(:disabled), .student-campus-dialog select, .student-campus-dialog input',
          ),
        ];
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [showing, setModal]);
  return (
    <>
      {!modal && (
        <button
          className="student-phone-button"
          aria-label="Open campus phone"
          onClick={() => {
            setMap(false);
            setModal('student_phone');
          }}
        >
          <Smartphone size={20} />
          <span>Phone</span>
        </button>
      )}
      {!modal && journey && !journey.orientation_completed && (
        <aside className="student-orientation">
          <button onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
            Welcome to campus · {journey.orientation_steps.length}/5 {collapsed ? '+' : '−'}
          </button>
          {!collapsed && (
            <>
              <p>Explore at your pace. Earn your Campus Explorer badge.</p>
              <ol>
                {orientationTasks.map(([key, label]) => (
                  <li key={key}>
                    {journey.orientation_steps.includes(key) ? (
                      <Check size={14} />
                    ) : (
                      <span className="orientation-dot" />
                    )}
                    {label}
                  </li>
                ))}
              </ol>
              <p className="text-xs">
                College welcome point: {collegePoint(user.college).name}. Tap a nearby student to
                meet them.
              </p>
              {journey.orientation_steps.length === 5 && (
                <button disabled={saving} onClick={() => useStudentStore.getState().claimBadge()}>
                  Claim Campus Explorer badge
                </button>
              )}
              {error && <p role="alert">{error}</p>}
            </>
          )}
        </aside>
      )}
      {showing && (
        <div
          className="student-entry student-campus-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={modal === 'student_phone' ? 'Campus phone' : 'Student profile'}
        >
          <div className="student-shell">
            <section className="student-card">
              <button
                ref={closeRef}
                className="student-close"
                aria-label="Close"
                onClick={() => {
                  setModal(null);
                  setEditing(false);
                }}
              >
                <X size={20} />
              </button>
              {modal === 'student_phone' ? (
                <>
                  <h1>Campus phone.</h1>
                  <p>{status}</p>
                  <nav className="student-phone-grid">
                    <button
                      onClick={() => {
                        setAvatar(normalizeAvatar(user.avatarConfig));
                        setModal('student_profile');
                      }}
                    >
                      Profile & Avatar
                    </button>
                    <button onClick={() => setModal('friends')}>Friends</button>
                    <button
                      onClick={() => {
                        const s = useSocialStore.getState();
                        if (s.activeDmPartner) setModal('private_chat');
                        else {
                          const last = Object.values(s.directMessages)
                            .flat()
                            .filter((m) => m.senderId !== user.id)
                            .sort((a, b) => b.timestamp - a.timestamp)[0];
                          if (last)
                            s.openDm({
                              id: last.senderId,
                              username: last.senderName,
                              college: last.college,
                            });
                          else setModal('friends');
                        }
                      }}
                    >
                      Messages
                    </button>
                    <button onClick={() => setModal('bank')}>Wallet</button>
                    <button onClick={() => setModal('campus_jobs')}>Jobs</button>
                    <button onClick={() => setMap(!map)}>Campus guide</button>
                    <button onClick={() => setModal('inventory')}>Inventory</button>
                    <button onClick={() => setModal('lecture_hall')}>Timetable</button>
                    <button onClick={() => setModal('daily_reward')}>Daily allowance</button>
                    <button onClick={() => setModal('help')}>Controls & Help</button>
                    <button onClick={() => useAuthStore.getState().logout()}>Sign out</button>
                  </nav>
                  {map && (
                    <>
                      <h2>Find your next stop</h2>
                      <p>Walk using the paths or choose a destination at a Keke stop.</p>
                      <ul className="student-friends">
                        {world.locations
                          .filter((l) =>
                            ['college', 'food', 'transport', 'restaurant', 'gaming'].includes(
                              l.type,
                            ),
                          )
                          .map((l) => (
                            <li key={l.id}>
                              <strong>{l.name}</strong>
                              <span>
                                {l.position[0] < 0
                                  ? 'West'
                                  : l.position[0] > 0
                                    ? 'East'
                                    : 'Central'}{' '}
                                campus · {l.position[2] < 0 ? 'north' : 'south'}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <>
                  <h1>{editing ? 'Make it your look.' : `@${user.username}`}</h1>
                  <Suspense fallback={<p>Opening your student…</p>}>
                    {editing ? (
                      <AvatarEditor
                        value={avatar}
                        onChange={(a) => setAvatar(normalizeAvatar(a))}
                      />
                    ) : (
                      <div className="student-avatar-layout">
                        <AvatarPreview config={user.avatarConfig} />
                        <div className="student-id">
                          <strong>{user.college}</strong>
                          <span>{courseById(user.courseId)?.name}</span>
                          <span>Game matric: {user.gameMatricNumber}</span>
                          <span>{status}</span>
                          <span>
                            {friends.filter((f) => f.status === 'accepted').length} friends
                          </span>
                          {journey?.orientation_completed && <span>Campus Explorer</span>}
                        </div>
                      </div>
                    )}
                  </Suspense>
                  <button
                    disabled={saving}
                    className="student-primary"
                    onClick={async () => {
                      if (!editing) {
                        setAvatar(normalizeAvatar(user.avatarConfig));
                        setEditing(true);
                      } else if (
                        await useStudentStore.getState().complete(user.courseId!, avatar, false)
                      )
                        setEditing(false);
                    }}
                  >
                    {editing ? (saving ? 'Saving…' : 'Save Avatar') : 'Edit Avatar'}
                  </button>
                  {error && (
                    <p className="student-error" role="alert">
                      {error}
                    </p>
                  )}
                  <p className="student-disclaimer">
                    Game identity only. Not an official university student card.
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
