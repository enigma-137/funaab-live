import React, { useState, useRef, useEffect } from 'react';
import { useLectureStore, hallSpot } from '../stores/lectureStore';
import { useSocialStore } from '../stores/socialStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { useGameStore } from '../stores/gameStore';
import { freeHallSeats, getLectureHall } from '../config/lectureHalls';
import {
  GraduationCap,
  Users,
  Hand,
  LogOut,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  X,
  Armchair,
  PlayCircle,
  StopCircle,
  ArrowUpFromLine,
} from 'lucide-react';

export const ClassroomHUD: React.FC = () => {
  const {
    currentLecture,
    mySeatNumber,
    isHandRaised,
    lecturerAside,
    attendanceStartedAt,
    attendanceRewardClaimed,
    classroomState,
    toggleRaiseHand,
    lowerHand,
    leaveLecture,
    currentHallId,
    attendanceMode,
    sitDown,
    standUp,
    startAttendance,
    endAttendance,
  } = useLectureStore();
  const players = useGameStore((s) => s.players);
  const hall = getLectureHall(currentHallId);
  const isSeated = mySeatNumber !== null;
  const isAttending = attendanceMode !== null;

  const { messages } = useSocialStore();

  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia('(max-width: 639px)').matches
  );
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [attendanceDuration, setAttendanceDuration] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Track attendance duration
  useEffect(() => {
    if (!attendanceStartedAt) {
      setAttendanceDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setAttendanceDuration(Math.floor((Date.now() - attendanceStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [attendanceStartedAt]);

  // Real classmates (from the server) plus you.
  const activeStudentsCount = Object.keys(classroomState?.activeStudents || {}).length + 1;

  // Filter classroom messages
  const classMessages = messages.filter(
    (m) => m.lectureId === currentLecture?.id || m.senderId === 'classroom'
  );

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [classMessages]);

  useEffect(() => {
    if (!currentLecture) return;

    const requestLeaveConfirmation = () => {
      setShowLeaveConfirm(true);
      window.history.pushState({ classroomHUD: true }, '', window.location.href);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowLeaveConfirm(true);
    };

    window.history.pushState({ classroomHUD: true }, '', window.location.href);
    window.addEventListener('popstate', requestLeaveConfirmation);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', requestLeaveConfirmation);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentLecture]);

  const handleSendClassChat = (e: React.FormEvent) => {
    e.preventDefault();
    // Only seated students are in the class's chat room on the server.
    if (!chatInput.trim() || !currentLecture || !isSeated) return;
    networkManager.sendClassroomChat(currentLecture.id, chatInput.trim());
    setChatInput('');
    // You've asked your question: the hand comes down.
    lowerHand();
  };

  if (!currentLecture) return null;

  const takeSeat = () => {
    const taken = [
      ...Object.values(classroomState?.activeStudents || {}).map((s) => s.seatNumber),
      ...Object.values(players).filter((p) => p.currentLectureId === currentLecture.id && p.seatNumber).map((p) => p.seatNumber!),
    ];
    // The free chair nearest where you are standing (walk to the front first for a front seat).
    const seat = freeHallSeats(hall, taken).sort(
      (a, b) => Math.hypot(a.pos[0] - hallSpot.x, a.pos[2] + 0.55 - hallSpot.z) - Math.hypot(b.pos[0] - hallSpot.x, b.pos[2] + 0.55 - hallSpot.z)
    )[0];
    if (seat) sitDown(seat.seatNumber);
  };
  // One primary action that walks the player through the attendance flow, plus a secondary
  // action (stand up while seated, raise hand while attending).
  const primary = !isSeated
    ? { label: 'Take a Seat', short: 'Sit', icon: Armchair, onClick: takeSeat, tone: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400' }
    : !isAttending
      ? { label: 'Join Lecture', short: 'Join', icon: PlayCircle, onClick: startAttendance, tone: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400' }
      : { label: 'End Attendance', short: 'End', icon: StopCircle, onClick: endAttendance, tone: 'bg-slate-900/90 hover:bg-slate-800 text-white border-slate-600' };
  const PrimaryIcon = primary.icon;
  const statusText = !isSeated
    ? 'Standing — walk around, drag to look 360°, then Sit at the nearest chair or tap a glowing one'
    : !isAttending
      ? `Seat #${mySeatNumber} — Join the lecture to start attendance`
      : attendanceMode === 'scheduled'
        ? 'Attending timetabled class'
        : 'Practice session (outside class time, no allowance)';

  return (
    <div className={`classroom-hud${isSeated ? ' is-seated' : ''} fixed inset-0 pointer-events-none z-40 font-['Plus_Jakarta_Sans'] select-none`}>
      <div className="hidden sm:flex absolute inset-0 flex-col justify-between p-4 sm:p-6">
      {/* ─── 1. TOP BAR: LECTURE DETAILS & ATTENDANCE ─── */}
      <div className="flex items-start justify-between w-full">
        {/* Course Info Card */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-emerald-500/40 shadow-2xl">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-base shadow-lg shadow-emerald-600/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-white font-['Outfit']">
                  {currentLecture.courseCode} — {currentLecture.title}
                </h1>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  {hall.collegeCode}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-2">
                <span>{hall.hallName}</span>
                <span>•</span>
                <span className="font-bold text-amber-400">{isSeated ? `Seat #${mySeatNumber}` : 'Standing'}</span>
              </div>
              <div className="text-[10px] text-emerald-300/90 mt-0.5">{statusText}</div>
            </div>
          </div>
        </div>

        {/* Top Right: Live Attendance Counter & Student Count */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Active Attendance Badge */}
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 shadow-xl text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Attended:</span>
            <span className="font-mono font-bold text-white">
              {Math.floor(attendanceDuration / 60)}m {attendanceDuration % 60}s
            </span>
            {attendanceMode === 'scheduled' && attendanceDuration >= 30 && (
              <span className="ml-1 text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> +₦{currentLecture.attendanceAllowance}
              </span>
            )}
          </div>

          {/* Student Attendees Pill */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 shadow-xl text-xs text-slate-200">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-white">{activeStudentsCount}</span>
            <span className="text-slate-400 text-[11px]">in class</span>
          </div>
        </div>
      </div>

      {/* ─── 2. BOTTOM BAR: CHAT & CLASS ACTIONS ─── */}
      <div className="flex items-end justify-between w-full gap-4">
        {/* Classroom Proximity Chat Window */}
        <div className="w-full max-w-sm pointer-events-auto">
          <div className="rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-2xl overflow-hidden">
            <div
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center justify-between px-4 py-2 bg-slate-950/80 cursor-pointer border-b border-slate-800"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 font-['Outfit']">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Classroom Whisper Chat</span>
              </div>
              <span className="text-[10px] text-slate-500">{isChatOpen ? '▾ Hide' : '▴ Show'}</span>
            </div>

            {isChatOpen && (
              <>
                <div className="p-3 space-y-2 max-h-36 overflow-y-auto text-xs">
                  {classMessages.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic text-center py-2">
                      Whisper to classmates in this lecture...
                    </div>
                  ) : (
                    classMessages.map((msg) => (
                      <div key={msg.id} className="leading-snug break-words">
                        {msg.isSystem ? (
                          <div className="text-[10px] text-amber-300/90 italic bg-amber-950/30 p-1 rounded border border-amber-500/20">
                            {msg.text}
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5">
                            <span className="font-bold text-emerald-300 shrink-0">
                              @{msg.senderName}:
                            </span>
                            <span className="text-slate-200">{msg.text}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <form onSubmit={handleSendClassChat} className="flex border-t border-slate-800 p-2 gap-2 bg-slate-950/90">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={isSeated ? "Whisper in class..." : "Take a seat to chat with your class"}
                    disabled={!isSeated}
                    maxLength={150}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Classroom Controls Pill */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={primary.onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition transform active:scale-95 shadow-xl border ${primary.tone}`}
          >
            <PrimaryIcon className="w-4 h-4" />
            <span>{primary.label}</span>
          </button>
          {isSeated && !isAttending && (
            <button
              onClick={standUp}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 font-bold text-xs shadow-xl"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>Stand Up</span>
            </button>
          )}
          {/* Raise Hand Button */}
          {isAttending && <button
            onClick={toggleRaiseHand}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition transform active:scale-95 shadow-xl ${
              isHandRaised
                ? 'bg-amber-500 text-black border-2 border-amber-300 animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700'
            }`}
          >
            <Hand className="w-4 h-4" />
            <span>{isHandRaised ? 'Hand Raised ✋' : 'Raise Hand'}</span>
          </button>}

          {/* Leave Class Button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/40 text-xs font-bold transition shadow-xl"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Hall</span>
          </button>
        </div>
      </div>
      </div>

      <div
        className="fixed left-3 right-3 z-40 flex items-center justify-between gap-2 sm:hidden pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      >
        <div className="min-w-0 max-w-[72%] rounded-lg border border-white/15 bg-slate-950/85 px-3 py-2 text-white shadow-lg backdrop-blur-md">
          <div className="truncate text-xs font-bold">{currentLecture.courseCode} · {currentLecture.title}</div>
          <div className="text-[11px] text-slate-300">{activeStudentsCount} {activeStudentsCount === 1 ? "student" : "students"}</div>
        </div>
        <div className="shrink-0 rounded-lg border border-white/15 bg-slate-950/85 px-3 py-2 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur-md">
          {Math.max(0, currentLecture.durationMinutes - Math.floor(attendanceDuration / 60))}m left
        </div>
      </div>

      {!isChatOpen && (
        <div
          className="fixed left-4 right-4 z-40 mx-auto max-w-[calc(100vw-32px)] rounded-xl border border-emerald-300/35 bg-slate-950/90 px-3 py-2 text-white shadow-xl backdrop-blur-md sm:hidden pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', maxHeight: 120 }}
        >
          <div className="mb-0.5 text-xs font-bold text-emerald-300">{currentLecture.lecturerName}</div>
          <div className="line-clamp-4 overflow-hidden text-sm leading-[1.4] text-slate-100">
            {(lecturerAside && lecturerAside.until > Date.now() ? lecturerAside.text : classroomState?.currentLecturerSpeech) || currentLecture.timeline[0]?.text || 'Welcome to class.'}
          </div>
        </div>
      )}

      {isChatOpen && (
        <div
          className="fixed left-3 right-3 z-[55] overflow-hidden rounded-xl border border-slate-600 bg-slate-950/95 shadow-2xl backdrop-blur-md sm:hidden pointer-events-auto"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', maxHeight: '45dvh' }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <MessageSquare className="h-4 w-4" /> Class chat
            </span>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              aria-label="Close class chat"
              className="rounded p-1 text-slate-300 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[26dvh] space-y-2 overflow-y-auto p-3 text-xs">
            {classMessages.length === 0 ? (
              <div className="py-2 text-center text-slate-400">No messages yet</div>
            ) : classMessages.map((msg) => (
              <div key={msg.id} className="break-words leading-snug">
                <span className="font-bold text-emerald-300">{msg.isSystem ? 'Class' : `@${msg.senderName}`} </span>
                <span className="text-slate-100">{msg.text}</span>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          <form onSubmit={handleSendClassChat} className="flex gap-2 border-t border-slate-800 p-2">
            <input
              type="text"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder={isSeated ? "Message classmates" : "Take a seat to chat with your class"}
              disabled={!isSeated}
              maxLength={150}
              enterKeyHint="send"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none select-text"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              aria-label="Send class message"
              className="flex w-10 items-center justify-center rounded-lg bg-emerald-600 text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <div
        className="fixed left-3 right-3 z-[60] flex items-center gap-2 sm:hidden pointer-events-auto"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <button
          type="button"
          onClick={primary.onClick}
          aria-label={primary.label}
          className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold shadow-lg ${primary.tone}`}
        >
          <PrimaryIcon className="h-4 w-4 shrink-0" />
          <span>{primary.short}</span>
        </button>
        {isSeated && (isAttending ? (
          <button
            type="button"
            onClick={toggleRaiseHand}
            aria-label={isHandRaised ? 'Hand raised' : 'Raise hand'}
            className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold shadow-lg ${isHandRaised ? 'border-amber-300 bg-amber-500 text-slate-950' : 'border-slate-600 bg-slate-900/95 text-white'}`}
          >
            <Hand className="h-4 w-4 shrink-0" />
            <span>{isHandRaised ? 'Raised' : 'Raise'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={standUp}
            aria-label="Stand up"
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/95 px-2 text-xs font-bold text-white shadow-lg"
          >
            <ArrowUpFromLine className="h-4 w-4 shrink-0" />
            <span>Stand</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsChatOpen((open) => !open)}
          aria-label={isChatOpen ? 'Close class chat' : 'Open class chat'}
          className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold shadow-lg ${isChatOpen ? 'border-emerald-400 bg-emerald-800 text-white' : 'border-slate-600 bg-slate-900/95 text-white'}`}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>Chat</span>
        </button>
        <button
          type="button"
          onClick={() => setShowLeaveConfirm(true)}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-400/70 bg-red-900 text-xs font-bold text-white shadow-lg"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Leave</span>
        </button>
      </div>

      {/* ─── 3. LEAVE CLASS CONFIRMATION MODAL ─── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto">
          <div className="relative w-full max-w-sm p-6 rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl text-center space-y-4">
            <div className="text-3xl">🚪</div>
            <div>
              <h3 className="text-lg font-bold text-white font-['Outfit']">
                Leave {hall.hallName}?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                You will step back outside onto the {hall.collegeCode === 'CLT' ? 'campus' : hall.collegeCode} forecourt.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
                  leaveLecture();
                }}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-lg transition"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
