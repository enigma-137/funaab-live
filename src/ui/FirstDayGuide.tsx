import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useLectureStore } from '../stores/lectureStore';
import { useStudentStore } from '../stores/studentStore';
import { toast } from '../stores/toastStore';
import { lectureHallForCollege, LECTURE_HALLS } from '../config/lectureHalls';

/**
 * First-day checklist for new students: get to a class, join it, see your room, find ways to earn.
 * Each step has a Go button and ticks itself when you actually do it. Progress stays on the device;
 * the card hides for good once everything is done or the student skips it.
 */
export const FIRST_DAY_STEPS = [
  { id: 'hall', icon: '🎓', title: 'Walk into a lecture hall' },
  { id: 'join', icon: '🪑', title: 'Sit down and tap Join Lecture' },
  { id: 'room', icon: '🏠', title: 'Visit your hostel room' },
  { id: 'earn', icon: '💰', title: 'See how to earn money' },
] as const;
type StepId = (typeof FIRST_DAY_STEPS)[number]['id'];

const key = (uid: string) => `funaab:firstday:v1:${uid}`;
const read = (uid: string): { done: StepId[]; skipped?: boolean } => {
  try { return JSON.parse(localStorage.getItem(key(uid)) || '') || { done: [] }; } catch { return { done: [] }; }
};
const write = (uid: string, v: { done: StepId[]; skipped?: boolean }) => { try { localStorage.setItem(key(uid), JSON.stringify(v)); } catch { /* private mode: keep in memory */ } };

// Whether the guide card is unfolded right now (Today's Plan steps aside while it is).
let unfolded = false;
const setUnfolded = (v: boolean) => { if (unfolded !== v) { unfolded = v; window.dispatchEvent(new Event('firstday-change')); } };

/** 'open' while the guide is unfolded, 'folded' while it shows as one line, null once it's done or hidden. */
export const useFirstDayActive = (): 'open' | 'folded' | null => {
  const uid = useAuthStore((s) => s.user?.id);
  const [, tick] = useState(0);
  useEffect(() => { const h = () => tick((n) => n + 1); window.addEventListener('firstday-change', h); return () => window.removeEventListener('firstday-change', h); }, []);
  if (!uid) return null;
  const s = read(uid);
  if (s.skipped || s.done.length >= FIRST_DAY_STEPS.length) return null;
  return unfolded ? 'open' : 'folded';
};

export function FirstDayGuide() {
  const user = useAuthStore((s) => s.user);
  const uid = user?.id;
  const [state, setState] = useState(() => (uid ? read(uid) : { done: [] as StepId[] }));
  const [open, setOpen] = useState(true);
  const orientationDone = useStudentStore((s) => !!s.journey?.orientation_completed);
  const modal = useGameStore((s) => s.activeModal);
  const riding = useGameStore((s) => s.isRidingKeke);
  const onCampus = useHostelStore((s) => s.roomId === 'world:funaab:main');

  useEffect(() => { if (uid) setState(read(uid)); }, [uid]);

  // Tick steps off as they happen, even while the card is hidden (in class, in the room, sheets open).
  useEffect(() => {
    if (!uid) return;
    const mark = (id: StepId) => {
      const cur = read(uid);
      if (cur.done.includes(id)) return;
      const next = { ...cur, done: [...cur.done, id] };
      write(uid, next);
      setState(next);
      window.dispatchEvent(new Event('firstday-change'));
      if (!cur.skipped) {
        toast(next.done.length === FIRST_DAY_STEPS.length
          ? { icon: '🎉', text: "First day done! Today's Plan now has daily goals that pay.", tone: 'good', ms: 6000 }
          : { icon: '✅', text: `${FIRST_DAY_STEPS.find((s) => s.id === id)!.title}: done (${next.done.length}/${FIRST_DAY_STEPS.length})`, tone: 'good', ms: 3500 });
      }
    };
    const check = () => {
      const l = useLectureStore.getState();
      if (l.isInClassroom) mark('hall');
      if (l.attendanceMode) mark('join');
      if (useHostelStore.getState().roomId === `world:funaab:hostel-room:${uid}`) mark('room');
      if (useGameStore.getState().activeModal === 'earn') mark('earn');
    };
    check();
    const subs = [useLectureStore.subscribe(check), useHostelStore.subscribe(check), useGameStore.subscribe(check)];
    return () => subs.forEach((u) => u());
  }, [uid]);

  const showing = !!uid && !state.skipped && state.done.length < FIRST_DAY_STEPS.length && orientationDone && !modal && !riding && onCampus;
  useEffect(() => { setUnfolded(showing && open); return () => setUnfolded(false); }, [showing, open]);
  if (!uid || state.skipped || state.done.length >= FIRST_DAY_STEPS.length) return null;
  if (!orientationDone || modal || riding || !onCampus || useLectureStore.getState().isInClassroom) return null;

  const go = (id: StepId) => {
    const g = useGameStore.getState();
    if (id === 'hall' || id === 'join') {
      const hall = (user?.college && lectureHallForCollege(user.college)) || LECTURE_HALLS[0];
      g.setNavigationDestination({ id: `firstday-${hall.id}`, name: hall.hallName, shortName: hall.collegeCode, position: hall.entrance, icon: '🎓' });
      toast({ icon: '🎓', text: id === 'hall'
        ? `Follow the arrow to ${hall.hallName}, then tap Enter at the door. Any hall works; your Timetable (phone) lists today's classes.`
        : 'Inside the hall, tap Sit (or a glowing chair), then Join Lecture. Timetabled classes pay ₦1,000.', tone: 'info', ms: 7000 });
      setOpen(false);
      return;
    }
    if (id === 'room') { setOpen(false); void useHostelStore.getState().travel('room'); return; }
    g.setActiveModal('earn');
  };
  const skip = () => { const next = { ...state, skipped: true }; write(uid, next); setState(next); window.dispatchEvent(new Event('firstday-change')); };
  const done = state.done.length;
  const nextStep = FIRST_DAY_STEPS.find((s) => !state.done.includes(s.id));

  return (
    <aside className="campus-plan first-day" aria-label="First day guide">
      <button className="campus-plan-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span aria-hidden>🎒</span>
        <b>Your first day</b>
        <span className="campus-plan-count">{done}/{FIRST_DAY_STEPS.length}</span>
        {!open && nextStep && <span className="campus-plan-ready" aria-hidden />}
        <span className="campus-plan-chevron" aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="campus-plan-body">
          <ul>
            {FIRST_DAY_STEPS.map((s) => {
              const ok = state.done.includes(s.id);
              return (
                <li key={s.id} className={ok ? 'is-claimed' : s.id === nextStep?.id ? 'is-ready' : ''}>
                  <span className="campus-plan-icon" aria-hidden>{s.icon}</span>
                  <span className="campus-plan-title">{s.title}</span>
                  {ok ? <span className="campus-plan-done" aria-label="Done">✓</span>
                    : <button className="campus-plan-go" onClick={() => go(s.id)} aria-label={`Go: ${s.title}`}>Go</button>}
                </li>
              );
            })}
          </ul>
          <p className="campus-plan-note">Tap Go and follow the arrow. Each step ticks itself when you do it.</p>
          <button className="first-day-skip" onClick={skip}>I know my way, hide this</button>
        </div>
      )}
    </aside>
  );
}
