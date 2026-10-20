import { useLevelStore } from './levelStore';
import { create } from 'zustand';
import { LectureDefinition, ClassroomState } from '../types/game';
import { useWalletStore } from './walletStore';
import { useAuthStore } from './authStore';
import { useSocialStore } from './socialStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { useGameStore } from './gameStore';
import { useInputStore } from './inputStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logTraceIQ } from '../lib/traceiq';
import { getHallScheduleState, normalizeHallLocationId } from '../config/lectureSchedule';
import { getLectureHall, hallSeatPositions, HALL_DOOR_SPOT, CHAIR_OFFSET_Z } from '../config/lectureHalls';

/** Where you stand inside the hall while not seated (x, z, facing). Updated every frame by the walker, so not reactive. */
export const hallSpot = { x: HALL_DOOR_SPOT[0], z: HALL_DOOR_SPOT[2], ry: Math.PI };

// 'scheduled' joins the timetabled class (allowance-eligible); 'practice' replays it off-schedule.
export type AttendanceMode = 'scheduled' | 'practice';

// Raising your hand: the lecturer calls on you, and the hand comes down once you ask (or after a while).
const HAND_ACK_MS = 1500;
const HAND_AUTO_LOWER_MS = 30_000;
const LECTURER_ASIDE_MS = 12_000;
let handTimers: ReturnType<typeof setTimeout>[] = [];
const clearHandTimers = () => { handTimers.forEach(clearTimeout); handTimers = []; };

interface LectureStoreState {
  isInClassroom: boolean;
  currentHallId: string | null;
  currentLecture: LectureDefinition | null;
  mySeatNumber: number | null; // null while standing
  attendanceMode: AttendanceMode | null; // null while not attending
  isHandRaised: boolean;
  /** A short line from the lecturer (e.g. calling on you) shown over the script until `until`. */
  lecturerAside: { text: string; until: number } | null;
  attendanceStartedAt: number | null;
  attendanceRewardClaimed: boolean;
  classroomState: ClassroomState | null;
  isTransitioning: boolean;
  classroomReturnPosition: [number, number, number] | null;

  enterHall: (hallId: string) => void;
  sitDown: (seatNumber: number) => void;
  standUp: () => void;
  startAttendance: () => void;
  endAttendance: () => void;
  leaveLecture: () => void;
  toggleRaiseHand: () => void;
  lowerHand: () => void;
  syncClassroomState: (state: ClassroomState) => void;
  updateLecturerSpeech: (text: string, boardTopic?: string) => void;
  claimAttendanceAllowance: (userId: string) => Promise<boolean>;
}

export const useLectureStore = create<LectureStoreState>()((set, get) => ({
  isInClassroom: false,
  currentHallId: null,
  currentLecture: null,
  mySeatNumber: null,
  attendanceMode: null,
  isHandRaised: false,
  lecturerAside: null,
  attendanceStartedAt: null,
  attendanceRewardClaimed: false,
  classroomState: null,
  isTransitioning: false,
  classroomReturnPosition: null,

  // Walk into a hall (standing at the back door). Works at any time of day; attendance only
  // counts toward the allowance while the hall's timetabled class is in session.
  enterHall: (hallInput: string) => {
    if (networkManager.room === 'world:funaab:library') {
      window.dispatchEvent(new CustomEvent('library-access-ended', {detail: 'You have returned to campus. Open your timetable to join the lecture.'}));
      return;
    }
    if (get().isInClassroom || get().isTransitioning) return;
    const hall = getLectureHall(normalizeHallLocationId(hallInput));
    const lecture = getHallScheduleState(hall.id).lecture;
    set({ isTransitioning: true });
    useInputStore.getState().clearTargetDestination();
    Object.assign(hallSpot, { x: HALL_DOOR_SPOT[0], z: HALL_DOOR_SPOT[2], ry: Math.PI });

    setTimeout(() => {
      set({
        isInClassroom: true,
        currentHallId: hall.id,
        currentLecture: lecture,
        mySeatNumber: null,
        attendanceMode: null,
        isHandRaised: false,
        lecturerAside: null,
        attendanceStartedAt: null,
        attendanceRewardClaimed: false,
        isTransitioning: false,
        // Always come back out in front of this hall's arch, clear of its pillars.
        classroomReturnPosition: hall.exit,
        classroomState: {
          lectureId: lecture.id,
          definition: lecture,
          startedAt: Date.now(),
          elapsedSeconds: 0,
          status: 'in_progress',
          currentBoardText: lecture.timeline[0]?.boardTopic || `${lecture.courseCode}: ${lecture.title}`,
          currentLecturerSpeech: 'Find a free seat, then join the lecture.',
          activeStudents: {},
        },
      });
      useGameStore.getState().setActiveModal(null);
      // Seat 0 = standing inside. The server hides you from campus and counts you in this class.
      networkManager.enterLectureRoom(lecture.id, 0);
    }, 400);
  },

  sitDown: (seatNumber: number) => {
    const { currentLecture, isInClassroom, mySeatNumber } = get();
    if (!isInClassroom || !currentLecture || mySeatNumber === seatNumber) return;
    // Moving to another seat keeps your attendance running; only standing up ends it.
    clearHandTimers();
    set({ mySeatNumber: seatNumber, isHandRaised: false });
    // Seated players join the lecture's multiplayer room so classmates see them in their seat.
    networkManager.enterLectureRoom(currentLecture.id, seatNumber);
  },

  standUp: () => {
    const { currentLecture, mySeatNumber } = get();
    if (mySeatNumber === null) return;
    get().endAttendance();
    // Step back into the gap behind your chair, facing the board.
    const seat = hallSeatPositions(getLectureHall(get().currentHallId)).find((s) => s.seatNumber === mySeatNumber);
    if (seat) Object.assign(hallSpot, { x: seat.pos[0], z: seat.pos[2] + CHAIR_OFFSET_Z + 0.62, ry: Math.PI });
    // Still inside the hall, just not seated.
    if (currentLecture) networkManager.enterLectureRoom(currentLecture.id, 0);
    clearHandTimers();
    set({ mySeatNumber: null, isHandRaised: false });
  },

  startAttendance: () => {
    const { currentHallId, currentLecture, mySeatNumber, attendanceMode, classroomState } = get();
    if (!currentLecture || mySeatNumber === null || attendanceMode) return;
    const mode: AttendanceMode = getHallScheduleState(currentHallId).status === 'active' ? 'scheduled' : 'practice';
    const now = Date.now();
    set({
      attendanceMode: mode,
      attendanceStartedAt: now,
      attendanceRewardClaimed: false,
      classroomState: classroomState && {
        ...classroomState,
        startedAt: now,
        currentLecturerSpeech: currentLecture.timeline[0]?.text || 'Welcome to class. Please take your seats.',
        currentBoardText: currentLecture.timeline[0]?.boardTopic || classroomState.currentBoardText,
      },
    });
  },

  endAttendance: () => {
    const state = get();
    if (!state.attendanceMode) return;
    // Allowance only for the timetabled class, after at least 30 seconds (server re-checks both).
    if (state.attendanceMode === 'scheduled' && state.attendanceStartedAt && !state.attendanceRewardClaimed) {
      const durationSec = Math.floor((Date.now() - state.attendanceStartedAt) / 1000);
      if (durationSec >= 30) {
        get().claimAttendanceAllowance(useAuthStore.getState().user?.id || 'local');
      }
    }
    // Tell classmates too, not just this screen.
    get().lowerHand();
    set({ attendanceMode: null, attendanceStartedAt: null });
  },

  leaveLecture: () => {
    const state = get();
    if (!state.currentLecture || state.isTransitioning) return;

    get().standUp();
    networkManager.leaveLectureRoom(state.currentLecture.id);
    useGameStore.setState((game) => ({
      myPosition: state.classroomReturnPosition || game.myPosition,
      myAnimation: 'idle',
      activeModal: null,
      nearbyInteractable: null,
      selectedPlayer: null,
      selectedHallLocationId: null,
    }));
    useInputStore.getState().clearTargetDestination();
    useInputStore.getState().setIsDraggingCamera(false);

    set({
      isInClassroom: false,
      currentHallId: null,
      currentLecture: null,
      mySeatNumber: null,
      attendanceMode: null,
      isHandRaised: false,
      lecturerAside: null,
      attendanceStartedAt: null,
      attendanceRewardClaimed: false,
      classroomState: null,
      classroomReturnPosition: null,
      isTransitioning: false,
    });
  },

  toggleRaiseHand: () => {
    const { isHandRaised, currentLecture: lecture, attendanceMode } = get();
    if (isHandRaised) {
      get().lowerHand();
      return;
    }
    if (!lecture || !attendanceMode) return;
    clearHandTimers();
    set({ isHandRaised: true });
    networkManager.sendHandRaise(lecture.id, true);

    // The lecturer notices and calls on you, in the speech bubble and in the class chat.
    handTimers.push(setTimeout(() => {
      if (!get().isHandRaised || get().currentLecture?.id !== lecture.id) return;
      const me = useAuthStore.getState().user?.username;
      const text = `Yes${me ? `, @${me}` : ''}? Go ahead, type your question in the class chat.`;
      set({ lecturerAside: { text, until: Date.now() + LECTURER_ASIDE_MS } });
      useSocialStore.getState().addMessage({
        id: `lecturer-${Date.now()}`,
        senderId: 'classroom',
        senderName: lecture.lecturerName,
        college: lecture.college,
        text: `${lecture.lecturerName}: ${text}`,
        timestamp: Date.now(),
        isSystem: true,
        lectureId: lecture.id,
      });
    }, HAND_ACK_MS));
    handTimers.push(setTimeout(() => get().lowerHand(), HAND_AUTO_LOWER_MS));
  },

  lowerHand: () => {
    clearHandTimers();
    const { isHandRaised, currentLecture } = get();
    if (!isHandRaised) return;
    set({ isHandRaised: false });
    if (currentLecture) networkManager.sendHandRaise(currentLecture.id, false);
  },

  syncClassroomState: (state: ClassroomState) => {
    set({ classroomState: state });
  },

  updateLecturerSpeech: (text: string, boardTopic?: string) => {
    const current = get().classroomState;
    if (!current) return;

    set({
      classroomState: {
        ...current,
        currentLecturerSpeech: text,
        currentBoardText: boardTopic || current.currentBoardText,
      },
    });
  },

  claimAttendanceAllowance: async (userId: string) => {
    const lecture = get().currentLecture;
    const started = get().attendanceStartedAt;
    if (!lecture || get().attendanceRewardClaimed) return false;

    const durationSec = started ? Math.max(30, Math.floor((Date.now() - started) / 1000)) : 30;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('claim_lecture_attendance', {
          p_lecture_id: lecture.id,
          p_duration_seconds: durationSec,
          p_allowance: lecture.attendanceAllowance,
          p_user_id: userId,
        });

        if (error || (data && !data.success)) {
          console.warn('Lecture attendance allowance claim:', error?.message || data?.error);
          logTraceIQ('warn', 'Lecture attendance allowance rejected', {
            service: 'lectures',
            lectureId: lecture.id,
            durationSec,
            reason: error?.message || data?.error,
          });
          return false;
        }

        const newBalance = Number(data.balance);
        useWalletStore.setState((prev) => ({
          balance: newBalance,
          transactions: [
            {
              id: `tx-lecture-${Date.now()}`,
              userId,
              type: 'lecture_attendance',
              amount: lecture.attendanceAllowance,
              balanceAfter: newBalance,
              description: `${lecture.courseCode} Lecture Attendance`,
              createdAt: new Date().toISOString(),
            },
            ...prev.transactions,
          ],
        }));

        set({ attendanceRewardClaimed: true });
        // Attending earns XP (database trigger); refresh the level badge.
        void useLevelStore.getState().load();
        return true;
      } catch (e) {
        console.error('Attendance allowance RPC error:', e);
        logTraceIQ('error', 'Lecture attendance allowance failed', { service: 'lectures', lectureId: lecture.id, error: e });
        return false;
      }
    }

    await useWalletStore.getState().grantJobReward(userId, lecture.attendanceAllowance, `${lecture.courseCode} Attendance`);
    set({ attendanceRewardClaimed: true });
    return true;
  },
}));
