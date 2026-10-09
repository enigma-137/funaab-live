import React, { useEffect, useState } from 'react';
import { useLectureStore } from '../stores/lectureStore';
import {
  getHallScheduleState,
  normalizeHallLocationId,
  checkForceLectureParam,
} from '../config/lectureSchedule';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { formatCountdown } from '../utils/lagosTime';

interface LectureHallModalProps {
  isOpen: boolean;
  onClose: () => void;
  hallLocationId?: string;
}

export const LectureHallModal: React.FC<LectureHallModalProps> = ({
  isOpen,
  onClose,
  hallLocationId: propHallId,
}) => {
  const [nowMs, setNowMs] = useState(Date.now());
  const { enterLecture } = useLectureStore();
  const { user } = useAuthStore();
  const selectedHallLocationId = useGameStore((s) => s.selectedHallLocationId);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  // Resolve target hall ID from prop or gameStore
  const rawHallId = propHallId || selectedHallLocationId || 'colfhec-lecture-hall';
  const canonicalHallId = normalizeHallLocationId(rawHallId);
  const hallSchedule = getHallScheduleState(canonicalHallId, nowMs);

  const activeLecture = hallSchedule.lecture;
  const isForceActive = hallSchedule.isForced;
  const isClassActive = hallSchedule.status === 'active';
  const isBreakActive = hallSchedule.status === 'break';
  const isOffHours = hallSchedule.status === 'off_hours' || hallSchedule.status === 'weekend';

  // Hall display names
  const hallNames: Record<string, string> = {
    'colfhec-lecture-hall': 'COLFHEC Lecture Hall 1',
    'central-lecture-hall': 'Central Lecture Theatre (CLT)',
    'colbios-lecture-hall': 'COLBIOS Lecture Hall A',
  };
  const hallTitle = hallNames[canonicalHallId] || 'Campus Lecture Hall';

  const handleEnter = () => {
    if (!activeLecture || !user) return;
    enterLecture(activeLecture, 1);
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header Board style */}
        <div style={boardHeaderStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '2px', color: '#68d391', textTransform: 'uppercase' }}>
              FUNAAB Academic Timetable Board
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>
              🕒 {hallSchedule.lagosTimeString}
            </div>
          </div>
          <h2 style={{ margin: '6px 0 0 0', fontSize: '21px', fontWeight: 900, color: '#ffffff' }}>
            {hallTitle}
          </h2>
        </div>

        <div style={{ padding: '20px' }}>
          {isClassActive ? (
            /* 1. LECTURE IN PROGRESS */
            <div style={activeLectureCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={badgeActiveStyle}>
                  {isForceActive ? '⚡ DEV FORCE LECTURE ACTIVE' : '● LECTURE IN SESSION'}
                </span>
                <span style={countdownChipStyle}>
                  Ends in: {formatCountdown(hallSchedule.timeRemainingSeconds)}
                </span>
              </div>

              <h3 style={{ margin: '12px 0 3px 0', fontSize: '21px', fontWeight: 800, color: '#f8fafc' }}>
                {activeLecture.courseCode} — {activeLecture.title}
              </h3>
              <div style={{ fontSize: '13.5px', color: '#cbd5e1', marginTop: '3px' }}>
                Lecturer: <strong style={{ color: '#ffffff' }}>{activeLecture.lecturerName}</strong> ({activeLecture.college})
              </div>

              <div style={infoGridStyle}>
                <div style={infoItemStyle}>
                  <div style={infoLabelStyle}>Duration</div>
                  <div style={infoValStyle}>{activeLecture.durationMinutes} minutes</div>
                </div>
                <div style={infoItemStyle}>
                  <div style={infoLabelStyle}>Capacity</div>
                  <div style={infoValStyle}>30 Students Max</div>
                </div>
                <div style={infoItemStyle}>
                  <div style={infoLabelStyle}>Attendance Bonus</div>
                  <div style={{ ...infoValStyle, color: '#48bb78' }}>+₦100 Allowance</div>
                </div>
              </div>

              <div style={{ marginTop: '18px', display: 'flex', gap: '10px' }}>
                <button
                  id="btn-enter-lecture"
                  onClick={handleEnter}
                  style={btnEnterStyle}
                >
                  🎓 [ Enter Class ]
                </button>
                <button
                  onClick={onClose}
                  style={btnCancelStyle}
                >
                  Close
                </button>
              </div>
            </div>
          ) : isBreakActive ? (
            /* 2. BETWEEN LECTURES / BREAK (COUNTDOWN TO NEXT) */
            <div style={breakCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={badgeBreakStyle}>⏱️ NEXT LECTURE STARTING SOON</span>
                <span style={countdownBreakChipStyle}>
                  Starts in {formatCountdown(hallSchedule.timeRemainingSeconds)}
                </span>
              </div>

              <h3 style={{ margin: '12px 0 3px 0', fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                {activeLecture.courseCode} — {activeLecture.title}
              </h3>
              <div style={{ fontSize: '13.5px', color: '#cbd5e1', marginTop: '3px' }}>
                Lecturer: <strong style={{ color: '#f1f5f9' }}>{activeLecture.lecturerName}</strong> ({activeLecture.college})
              </div>

              <div style={{ marginTop: '14px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '13px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏳</span>
                  <span>Doors unlock automatically when class commences. Students are gathering outside.</span>
                </div>
              </div>

              <div style={{ marginTop: '18px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setNowMs(Date.now())}
                  style={btnWaitStyle}
                >
                  ⏳ [ Waiting Outside • Starts in {formatCountdown(hallSchedule.timeRemainingSeconds)} ]
                </button>
                <button
                  onClick={onClose}
                  style={btnCancelStyle}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* 3. OFF-HOURS / WEEKEND */
            <div style={noLectureCardStyle}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>
                {hallSchedule.status === 'weekend' ? '🌴' : '🌙'}
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>
                {hallSchedule.status === 'weekend'
                  ? 'Weekend — No Scheduled Lectures'
                  : 'Campus Academic Day Ended (Closed 5:00 PM – 9:00 AM WAT)'}
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>
                Regular classes run Monday through Friday from <strong>9:00 AM to 5:00 PM WAT</strong>.
              </p>

              {/* Next scheduled lecture preview */}
              <div style={nextLecturePreviewStyle}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#ecc94b', textTransform: 'uppercase' }}>
                  NEXT SCHEDULED CLASS
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                  {activeLecture.courseCode} — {activeLecture.title}
                </div>
                <div style={{ fontSize: '13px', color: '#a0aec0', marginTop: '2px' }}>
                  Lecturer: {activeLecture.lecturerName} ({activeLecture.college})
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button
                  onClick={onClose}
                  style={btnCancelStyle}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Dev override info footer */}
          {!checkForceLectureParam() && (
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
              💡 Developer Override: Add <code style={{ color: '#38bdf8' }}>?forceLecture=true</code> to URL to force active class anytime.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.78)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  backdropFilter: 'blur(6px)',
  animation: 'fadeIn 0.2s ease-out',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#1a202c',
  border: '2px solid #334155',
  borderRadius: '16px',
  width: '90%',
  maxWidth: '540px',
  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
  overflow: 'hidden',
  color: '#e2e8f0',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const boardHeaderStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  padding: '16px 20px',
  borderBottom: '1px solid #334155',
};

const activeLectureCardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1.5px solid #10b981',
  borderRadius: '12px',
  padding: '16px',
};

const breakCardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1.5px solid #f59e0b',
  borderRadius: '12px',
  padding: '16px',
};

const badgeActiveStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 800,
  backgroundColor: '#065f46',
  color: '#6ee7b7',
  padding: '3px 10px',
  borderRadius: '6px',
  letterSpacing: '0.5px',
};

const badgeBreakStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 800,
  backgroundColor: '#78350f',
  color: '#fde68a',
  padding: '3px 10px',
  borderRadius: '6px',
  letterSpacing: '0.5px',
};

const countdownChipStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#34d399',
  fontFamily: 'monospace',
  backgroundColor: '#064e3b',
  padding: '3px 8px',
  borderRadius: '6px',
};

const countdownBreakChipStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#fbbf24',
  fontFamily: 'monospace',
  backgroundColor: '#451a03',
  padding: '3px 8px',
  borderRadius: '6px',
};

const infoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '8px',
  marginTop: '14px',
  backgroundColor: '#0f172a',
  padding: '10px',
  borderRadius: '8px',
};

const infoItemStyle: React.CSSProperties = {
  textAlign: 'center',
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: '10.5px',
  color: '#64748b',
  textTransform: 'uppercase',
  fontWeight: 700,
};

const infoValStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#f1f5f9',
  fontWeight: 700,
  marginTop: '2px',
};

const noLectureCardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px dashed #475569',
  borderRadius: '12px',
  padding: '20px',
  textAlign: 'center',
};

const nextLecturePreviewStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '12px',
  textAlign: 'left',
};

const btnEnterStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#10b981',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '15px',
  padding: '12px 20px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'transform 0.1s, background-color 0.2s',
  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
};

const btnWaitStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#d97706',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '13.5px',
  padding: '12px 16px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)',
};

const btnCancelStyle: React.CSSProperties = {
  padding: '12px 20px',
  backgroundColor: '#334155',
  color: '#cbd5e1',
  fontWeight: 700,
  fontSize: '14px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};
