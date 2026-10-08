import React, { useState, useRef, useEffect } from 'react';
import { useLectureStore } from '../stores/lectureStore';
import { useSocialStore } from '../stores/socialStore';
import { networkManager } from '../game/multiplayer/networkManager';
import {
  GraduationCap,
  Users,
  Hand,
  LogOut,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export const ClassroomHUD: React.FC = () => {
  const {
    currentLecture,
    mySeatNumber,
    isHandRaised,
    attendanceStartedAt,
    attendanceRewardClaimed,
    classroomState,
    toggleRaiseHand,
    leaveLecture,
  } = useLectureStore();

  const { messages } = useSocialStore();

  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [attendanceDuration, setAttendanceDuration] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Track attendance duration
  useEffect(() => {
    if (!attendanceStartedAt) return;
    const interval = setInterval(() => {
      setAttendanceDuration(Math.floor((Date.now() - attendanceStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [attendanceStartedAt]);

  const activeStudentsCount = Object.keys(classroomState?.activeStudents || {}).length || 1;

  // Filter classroom messages
  const classMessages = messages.filter(
    (m) => m.lectureId === currentLecture?.id || m.senderId === 'classroom'
  );

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [classMessages]);

  const handleSendClassChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentLecture) return;
    networkManager.sendClassroomChat(currentLecture.id, chatInput.trim());
    setChatInput('');
  };

  if (!currentLecture) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-4 sm:p-6 font-['Plus_Jakarta_Sans'] select-none">
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
                  {currentLecture.college}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-2">
                <span>{currentLecture.locationName}</span>
                <span>•</span>
                <span className="font-bold text-amber-400">Seat #{mySeatNumber || 1}</span>
              </div>
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
            {attendanceDuration >= 60 && (
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
                    placeholder="Whisper in class..."
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
          {/* Raise Hand Button */}
          <button
            onClick={toggleRaiseHand}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition transform active:scale-95 shadow-xl ${
              isHandRaised
                ? 'bg-amber-500 text-black border-2 border-amber-300 animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700'
            }`}
          >
            <Hand className="w-4 h-4" />
            <span>{isHandRaised ? 'Hand Raised ✋' : 'Raise Hand'}</span>
          </button>

          {/* Leave Class Button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/40 text-xs font-bold transition shadow-xl"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Class</span>
          </button>
        </div>
      </div>

      {/* ─── 3. LEAVE CLASS CONFIRMATION MODAL ─── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto">
          <div className="relative w-full max-w-sm p-6 rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl text-center space-y-4">
            <div className="text-3xl">🚪</div>
            <div>
              <h3 className="text-lg font-bold text-white font-['Outfit']">
                Leave {currentLecture.courseCode}?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                You will step outside {currentLecture.locationName} back onto the campus grounds.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition"
              >
                Stay in Class
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
