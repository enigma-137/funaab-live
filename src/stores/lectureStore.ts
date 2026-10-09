import { create } from 'zustand';
import { LectureDefinition, ClassroomState } from '../types/game';
import { useWalletStore } from './walletStore';
import { useAuthStore } from './authStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { useGameStore } from './gameStore';
import { useInputStore } from './inputStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface LectureStoreState {
  isInClassroom: boolean;
  currentLecture: LectureDefinition | null;
  mySeatNumber: number | null;
  isHandRaised: boolean;
  attendanceStartedAt: number | null;
  attendanceRewardClaimed: boolean;
  classroomState: ClassroomState | null;
  isTransitioning: boolean;
  classroomReturnPosition: [number, number, number] | null;

  enterLecture: (lecture: LectureDefinition, seatNumber?: number) => void;
  leaveLecture: () => void;
  toggleRaiseHand: () => void;
  syncClassroomState: (state: ClassroomState) => void;
  updateLecturerSpeech: (text: string, boardTopic?: string) => void;
  claimAttendanceAllowance: (userId: string) => Promise<boolean>;
}

export const useLectureStore = create<LectureStoreState>()((set, get) => ({
  isInClassroom: false,
  currentLecture: null,
  mySeatNumber: null,
  isHandRaised: false,
  attendanceStartedAt: null,
  attendanceRewardClaimed: false,
  classroomState: null,
  isTransitioning: false,
  classroomReturnPosition: null,

  enterLecture: (lecture: LectureDefinition, seatNumber = 1) => {
    set({ isTransitioning: true });
    const returnPosition = [...useGameStore.getState().myPosition] as [number, number, number];
    useInputStore.getState().clearTargetDestination();

    // Transition into classroom instance
    setTimeout(() => {
      const now = Date.now();
      const initialSpeech = lecture.timeline[0]?.text || 'Welcome to class. Please take your seats.';
      const initialBoard = lecture.timeline[0]?.boardTopic || `${lecture.courseCode}: ${lecture.title}`;

      set({
        isInClassroom: true,
        currentLecture: lecture,
        mySeatNumber: seatNumber,
        isHandRaised: false,
        attendanceStartedAt: now,
        attendanceRewardClaimed: false,
        isTransitioning: false,
        classroomReturnPosition: returnPosition,
        classroomState: {
          lectureId: lecture.id,
          definition: lecture,
          startedAt: now,
          elapsedSeconds: 0,
          status: 'in_progress',
          currentBoardText: initialBoard,
          currentLecturerSpeech: initialSpeech,
          activeStudents: {},
        },
      });

      // Notify multiplayer server to enter lecture sub-room
      networkManager.enterLectureRoom(lecture.id, seatNumber);
      useGameStore.getState().setActiveModal(null);
    }, 400);
  },

  leaveLecture: () => {
    const state = get();
    if (!state.currentLecture || state.isTransitioning) return;

    const current = state.currentLecture;
    const started = state.attendanceStartedAt;

    // Check attendance duration
    if (started && !state.attendanceRewardClaimed) {
      const durationSec = Math.floor((Date.now() - started) / 1000);
      // If attended for at least 30 seconds in game simulation, grant attendance allowance
      if (durationSec >= 30) {
        get().claimAttendanceAllowance(useAuthStore.getState().user?.id || 'local');
      }
    }

    networkManager.leaveLectureRoom(current.id);
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
      currentLecture: null,
      mySeatNumber: null,
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
