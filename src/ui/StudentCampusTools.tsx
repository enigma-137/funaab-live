import { FeedbackLauncher } from './FeedbackPanel';
import { SoundToggle } from './SoundToggle';
import { openHostel } from './HostelLife';
import { useHostelStore } from '../stores/hostelStore';
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import { CampusPhone } from './CampusPhone';
import { PhoneLauncherArt } from './phoneIcons';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useSocialStore } from '../stores/socialStore';
import { useStudentStore } from '../stores/studentStore';
import { useInputStore } from '../stores/inputStore';
import { useWalletStore } from '../stores/walletStore';
import { useLectureStore } from '../stores/lectureStore';
import { courseById, courses, colleges } from '../config/academics';
import { networkManager } from '../game/multiplayer/networkManager';
import { orientationTasks } from '../config/studentJourney';
import { normalizeAvatar } from '../config/avatar';
import world from '../config/campusWorld';
import './student.css';

const AvatarEditor = lazy(() => import('./AvatarEditor'));
const AvatarPreview = lazy(() =>
  import('./AvatarEditor').then((m) => ({ default: m.AvatarPreview })),
);
const collegePoint = (college: string) => world.locations.find(l=>l.id===college.toLowerCase()) || world.locations.find(l=>l.id==='central-lecture-hall')!;
const near = (p: number[], target: number[], distance: number) =>
  Math.hypot(p[0] - target[0], p[2] - target[2]) < distance;

export function StudentCampusTools() {
  const user = useAuthStore((s) => s.user)!;
  const riding=useGameStore(s=>s.isRidingKeke);
  const offCampus=useHostelStore(s=>s.roomId!=='world:funaab:main');
  const modal = useGameStore((s) => s.activeModal);
  const setModal = useGameStore((s) => s.setActiveModal);
  const { journey, saving, error } = useStudentStore();
  const friends = useSocialStore((s) => s.friends);
  const unreadDms = useSocialStore((s) => s.unreadDmCount);
  const [editing, setEditing] = useState(false);
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
      if (useHostelStore.getState().roomId !== 'world:funaab:main') {
        setStatus(useHostelStore.getState().roomId === 'world:funaab:library' ? 'In the library' : useHostelStore.getState().owner ? 'In a student room' : 'At the hostel courtyard');
        return;
      }
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
      <div className="campus-launchers">
      {!modal && (
        <button
          className="student-phone-button"
          aria-label={unreadDms ? `Open campus phone, ${unreadDms} unread messages` : 'Open campus phone'}
          title="Phone"
          onClick={() => setModal('student_phone')}
        >
          <PhoneLauncherArt size={30} />
          {unreadDms > 0 && <span className="student-phone-badge">{unreadDms > 9 ? '9+' : unreadDms}</span>}
        </button>
      )}
      <FeedbackLauncher />
      <SoundToggle />
      </div>
      {!riding && !offCampus && !modal && journey && !journey.orientation_completed && (
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
      {modal === 'student_phone' && (
        <CampusPhone
          status={status}
          closeRef={closeRef}
          onClose={() => setModal(null)}
          onProfile={() => {
            setAvatar(normalizeAvatar(user.avatarConfig));
            setModal('student_profile');
          }}
        />
      )}
      {modal === 'student_profile' && (
        <div
          className="student-entry student-campus-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Student profile"
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
              <>
                  <h1>{editing ? 'Make it your look.' : `@${user.username}`}</h1>
                  <Suspense fallback={<p>Opening your student…</p>}>
                    {editing ? (
                      <AvatarEditor
                        value={avatar}
                        onChange={(a) => setAvatar(normalizeAvatar(a))}
                      />
                    ) : (
                      <>
                      <div className="student-avatar-layout">
                        <AvatarPreview config={user.avatarConfig} />
                        <div className="student-id">
                          <UsernameChanger />
                          <strong>{user.college}</strong>
                          <span>{courseById(user.courseId)?.name}</span>
                          <DepartmentChanger />
                          <span>Game matric: {user.gameMatricNumber}</span>
                          <span>{status}</span>
                          <span>
                            {friends.filter((f) => f.status === 'accepted').length} friends
                          </span>
                          {journey?.orientation_completed && <span>Campus Explorer</span>}
                        </div>
                      </div>
                      </>
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
            </section>
          </div>
        </div>
      )}
    </>
  );
}

/** Rejoin the room so other players see the new name / college on your name tag. */
function rejoinAfterProfileChange() {
  const room = useHostelStore.getState().roomId;
  const updated = useAuthStore.getState().user;
  // Campus only (as before): elsewhere the new tag shows the next time you enter a room.
  if (updated && room === 'world:funaab:main') void networkManager.switchRoom(room, updated);
}

/** Change username from the profile. The database checks the rules and allows one change a week. */
function UsernameChanger() {
  const user = useAuthStore((s) => s.user)!;
  const saving = useStudentStore((s) => s.saving);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.username);
  const [done, setDone] = useState('');
  const clean = name.trim();
  const valid = /^[A-Za-z0-9_]{3,20}$/.test(clean);
  if (!open)
    return (
      <span>
        <button className="student-link" onClick={() => { setName(user.username); setDone(''); setOpen(true); }}>
          Change username
        </button>
        {done && <em> · {done}</em>}
      </span>
    );
  const save = async () => {
    if (clean === user.username) return setOpen(false);
    if (await useStudentStore.getState().changeUsername(clean)) {
      setOpen(false);
      setDone(`You are now @${useAuthStore.getState().user?.username}`);
      rejoinAfterProfileChange();
    }
  };
  return (
    <span className="student-dept-change">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && valid) void save(); }}
        aria-label="New username"
        maxLength={20}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onFocus={() => useInputStore.getState().setIsInputFocused(true)}
        onBlur={() => useInputStore.getState().setIsInputFocused(false)}
      />
      <button className="student-primary" disabled={saving || !valid || clean === user.username} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      <button className="student-link" onClick={() => setOpen(false)}>Cancel</button>
      <small>{valid || !clean ? '3–20 letters, numbers or underscores. You can change it once a week.' : 'Use 3–20 letters, numbers or underscores only.'}</small>
    </span>
  );
}

/** Change department from the profile. The database allows one change a day; the college follows. */
function DepartmentChanger() {
  const user = useAuthStore((s) => s.user)!;
  const saving = useStudentStore((s) => s.saving);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(user.courseId || '');
  const [done, setDone] = useState('');
  if (!open)
    return (
      <span>
        <button className="student-link" onClick={() => { setChoice(user.courseId || ''); setDone(''); setOpen(true); }}>
          Change department
        </button>
        {done && <em> · {done}</em>}
      </span>
    );
  const save = async () => {
    if (!choice || choice === user.courseId) return setOpen(false);
    if (await useStudentStore.getState().changeDepartment(choice)) {
      setOpen(false);
      setDone(`Now in ${courseById(choice)?.name}`);
      rejoinAfterProfileChange();
    }
  };
  return (
    <span className="student-dept-change">
      <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Department">
        {colleges.map((c) => (
          <optgroup key={c.code} label={c.code}>
            {courses.filter((d) => d.college === c.code).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </optgroup>
        ))}
      </select>
      <button className="student-primary" disabled={saving || choice === user.courseId} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      <button className="student-link" onClick={() => setOpen(false)}>Cancel</button>
      <small>You can change department once a day.</small>
    </span>
  );
}
