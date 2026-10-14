import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Sheet } from './Sheet';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { BETA_SCHEDULE_CONFIG, getHallScheduleState } from '../config/lectureSchedule';
import { LECTURE_HALLS, lectureHallForCollege, type LectureHallConfig } from '../config/lectureHalls';
import { ECONOMY_CONFIG, formatNaira } from '../config/economy';
import { formatCountdown } from '../utils/lagosTime';

const CYCLE_MS = BETA_SCHEDULE_CONFIG.CYCLE_DURATION_MINUTES * 60000;
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' });
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short' });
const lagosDay = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' });

/** The next few class start times for a hall, skipping nights and weekends. */
function nextStarts(hall: LectureHallConfig, from: number, count: number): number[] {
  const out: number[] = [];
  const first = Math.floor((from - hall.scheduleOffsetMinutes * 60000) / CYCLE_MS) * CYCLE_MS + hall.scheduleOffsetMinutes * 60000;
  for (let n = 1; n < 400 && out.length < count; n++) {
    const t = first + n * CYCLE_MS;
    if (t > from && getHallScheduleState(hall.id, t + 60000).status === 'active') out.push(t);
  }
  return out;
}

/** "My timetable": your college's class in plain words, with a one-tap route to its hall. */
export function MyTimetable() {
  const user = useAuthStore((s) => s.user);
  const setModal = useGameStore((s) => s.setActiveModal);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const hall = (user?.college && lectureHallForCollege(user.college)) || LECTURE_HALLS[0];
  const state = getHallScheduleState(hall.id, now);
  const lecture = state.lecture;
  const minute = Math.floor(now / 60000);
  const upcoming = useMemo(() => nextStarts(hall, minute * 60000, 4), [hall.id, minute]);
  const live = state.status === 'active';
  const closed = state.status === 'weekend' || state.status === 'off_hours';

  const go = (h: LectureHallConfig) => {
    useGameStore.getState().setNavigationDestination({ id: `timetable-${h.id}`, name: h.hallName, shortName: h.collegeCode, position: h.entrance, icon: '🎓' });
    setModal(null);
  };
  const board = (h: LectureHallConfig) => { useGameStore.getState().setSelectedHallLocationId(h.id); setModal('lecture_hall'); };
  const others = LECTURE_HALLS.filter((h) => h.id !== hall.id && getHallScheduleState(h.id, now).status === 'active').slice(0, 3);

  return (
    <Sheet title="My timetable" subtitle={`${user?.college ?? 'Campus'} · ${hall.hallName}`} icon={<CalendarClock className="w-4 h-4" />} accent="#db2777" onClose={() => setModal(null)}>
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div className="academic-card">
          <h3>{lecture.courseCode} <small>{lecture.title}</small></h3>
          <p className="academic-note">Lecturer: {lecture.lecturerName}</p>
          <p style={{ marginTop: 10, fontWeight: 800, fontSize: 15, color: live ? '#34d399' : '#fbbf24' }}>
            {live ? `● Live now · ends in ${formatCountdown(state.timeRemainingSeconds)}`
              : state.status === 'break' ? `Starts in ${formatCountdown(state.timeRemainingSeconds)}`
              : upcoming[0] ? `Closed now · next class ${day(upcoming[0])} ${clock(upcoming[0])}` : 'No class right now'}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="academic-primary" onClick={() => go(hall)}>Take me to my class</button>
            <button className="academic-primary" style={{ background: '#1e293b' }} onClick={() => board(hall)}>Open hall board</button>
          </div>
        </div>

        {upcoming.length > 0 && (
          <div className="academic-card">
            <h3>Coming up</h3>
            <ul style={{ display: 'grid', gap: 6 }}>
              {upcoming.map((t) => (
                <li key={t} className="academic-note" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{lagosDay(t) === lagosDay(now) ? 'Today' : day(t)} · {clock(t)}</span><span>{lecture.courseCode}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {others.length > 0 && !closed && (
          <div className="academic-card">
            <h3>Also live on campus</h3>
            <ul style={{ display: 'grid', gap: 8 }}>
              {others.map((h) => (
                <li key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span className="academic-note">{h.collegeCode} · {getHallScheduleState(h.id, now).lecture.courseCode}</span>
                  <button className="academic-primary" style={{ minHeight: 34, background: '#1e293b' }} onClick={() => go(h)}>Directions</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="academic-how" open>
          <summary>How classes work</summary>
          <p>
            Classes run Monday to Friday, 9 AM to 5 PM (Lagos time). Each lasts {BETA_SCHEDULE_CONFIG.LECTURE_DURATION_MINUTES} minutes with a short break, and the same course repeats through the day.
            Walk to your hall, tap Enter Hall and take a seat. A live class pays {formatNaira(ECONOMY_CONFIG.ATTENDANCE_ALLOWANCE)} and XP, up to {ECONOMY_CONFIG.ATTENDANCE_DAILY_LIMIT} a day. Nights and weekends are closed.
          </p>
        </details>
      </div>
    </Sheet>
  );
}
