import { useAcademicStore } from './academicStore';
import { create } from 'zustand';
import { LectureDefinition, ClassroomState } from '../types/game';
import { useWalletStore } from './walletStore';
import { useAuthStore } from './authStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { useGameStore } from './gameStore';
import { useInputStore } from './inputStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getHallScheduleState, normalizeHallLocationId } from '../config/lectureSchedule';
import { getLectureHall } from '../config/lectureHalls';

// 'scheduled' joins the timetabled class (allowance-eligible); 'practice' replays it off-schedule.
export type AttendanceMode = 'scheduled' | 'practice';

interface LectureStoreState {
  isInClassroom: boolean;
  currentHallId: string | null;
  currentLecture: LectureDefinition | null;
  mySeatNumber: number | null; // null while standing
  attendanceMode: AttendanceMode | null; // null while not attending
  isHandRaised: boolean;
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

    setTimeout(() => {
      set({
        isInClassroom: true,
        currentHallId: hall.id,
        currentLecture: lecture,
        mySeatNumber: null,
        attendanceMode: null,
        isHandRaised: false,
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
    }, 400);
  },

  sitDown: (seatNumber: number) => {
    const { currentLecture, isInClassroom, mySeatNumber } = get();
    if (!isInClassroom || !currentLecture || mySeatNumber === seatNumber) return;
    if (mySeatNumber !== null) get().standUp();
    set({ mySeatNumber: seatNumber, isHandRaised: false });
    // Seated players join the lecture's multiplayer room so classmates see them in their seat.
    networkManager.enterLectureRoom(currentLecture.id, seatNumber);
  },

  standUp: () => {
    const { currentLecture, mySeatNumber } = get();
    if (mySeatNumber === null) return;
    get().endAttendance();
    if (currentLecture) networkManager.leaveLectureRoom(currentLecture.id);
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
    set({ attendanceMode: null, attendanceStartedAt: null, isHandRaised: false });
  },

  leaveLecture: () => {
    const state = get();
    if (!state.currentLecture || state.isTransitioning) return;

    get().standUp();
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
      attendanceStartedAt: null,
      attendanceRewardClaimed: false,
      classroomState: null,
      classroomReturnPosition: null,
      isTransitioning: false,
    });
  },

  toggleRaiseHand: () => {
    const nextState = !get().isHandRaised;
    set({ isHandRaised: nextState });

    const lecture = get().currentLecture;
    if (lecture) {
      networkManager.sendHandRaise(lecture.id, nextState);
    }
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
        // Coursework: a 3-question quiz on what this lecturer just taught.
        void useAcademicStore.getState().offerQuiz(lecture.id);
        return true;
      } catch (e) {
        console.error('Attendance allowance RPC error:', e);
        return false;
      }
    }

    await useWalletStore.getState().grantJobReward(userId, lecture.attendanceAllowance, `${lecture.courseCode} Attendance`);
    set({ attendanceRewardClaimed: true });
    return true;
  },
}));
