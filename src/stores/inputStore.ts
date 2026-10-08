import { create } from 'zustand';

export interface TapRipple {
  id: number;
  position: [number, number, number];
}

export interface TargetInteraction {
  type: string;
  id?: string;
  targetId?: string;
  label?: string;
  position: [number, number, number];
  radius: number;
}

interface InputState {
  // Device & Mode Detection
  isTouchDevice: boolean;
  isCoarsePointer: boolean;
  
  // Mobile Tap-To-Move Navigation
  targetDestination: [number, number, number] | null;
  targetInteraction: TargetInteraction | null;
  tapRipple: TapRipple | null;

  // Touch / Drag Camera Orbit
  cameraYaw: number;
  cameraPitch: number;
  isDraggingCamera: boolean;

  // UI state for touch isolation
  isInputFocused: boolean;
  mobileTutorialDismissed: boolean;

  // Actions
  setIsTouchDevice: (val: boolean) => void;
  setTargetDestination: (
    dest: [number, number, number] | null,
    interaction?: TargetInteraction | null
  ) => void;
  clearTargetDestination: () => void;
  setTapRipple: (pos: [number, number, number]) => void;
  clearTapRipple: () => void;
  rotateCamera: (deltaYaw: number, deltaPitch: number) => void;
  setCameraYaw: (yaw: number) => void;
  setCameraPitch: (pitch: number) => void;
  setIsDraggingCamera: (dragging: boolean) => void;
  setIsInputFocused: (focused: boolean) => void;
  setMobileTutorialDismissed: (dismissed: boolean) => void;
  triggerHaptic: (pattern?: number | number[]) => void;
}

// Initial detection
const detectTouchCapability = (): boolean => {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touchPoints = (navigator.maxTouchPoints || 0) > 0;
  const touchEvents = 'ontouchstart' in window;
  return coarse || touchPoints || touchEvents;
};

const getInitialTutorialState = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem('funaab_mobile_tutorial_seen') === 'true';
  } catch {
    return false;
  }
};

export const useInputStore = create<InputState>((set) => ({
  isTouchDevice: typeof window !== 'undefined' ? detectTouchCapability() : false,
  isCoarsePointer: typeof window !== 'undefined' ? (window.matchMedia?.('(pointer: coarse)').matches ?? false) : false,
  
  targetDestination: null,
  targetInteraction: null,
  tapRipple: null,

  cameraYaw: 0,
  cameraPitch: 0.15, // subtle natural downward angle
  isDraggingCamera: false,

  isInputFocused: false,
  mobileTutorialDismissed: getInitialTutorialState(),

  setIsTouchDevice: (isTouchDevice) => set({ isTouchDevice }),

  setTargetDestination: (targetDestination, targetInteraction = null) =>
    set({ targetDestination, targetInteraction }),

  clearTargetDestination: () =>
    set({ targetDestination: null, targetInteraction: null }),

  setTapRipple: (position) =>
    set({ tapRipple: { id: Date.now(), position } }),

  clearTapRipple: () => set({ tapRipple: null }),

  rotateCamera: (deltaYaw, deltaPitch) =>
    set((state) => {
      const newYaw = state.cameraYaw + deltaYaw;
      // Clamp pitch between -0.2 (looking slightly upward) and 0.65 (top-down tilt)
      const newPitch = Math.max(-0.2, Math.min(0.65, state.cameraPitch + deltaPitch));
      return { cameraYaw: newYaw, cameraPitch: newPitch };
    }),

  setCameraYaw: (cameraYaw) => set({ cameraYaw }),
  setCameraPitch: (cameraPitch) => set({ cameraPitch }),
  setIsDraggingCamera: (isDraggingCamera) => set({ isDraggingCamera }),
  setIsInputFocused: (isInputFocused) => set({ isInputFocused }),

  setMobileTutorialDismissed: (dismissed) => {
    try {
      localStorage.setItem('funaab_mobile_tutorial_seen', String(dismissed));
    } catch {}
    set({ mobileTutorialDismissed: dismissed });
  },

  triggerHaptic: (pattern = 20) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {}
  },
}));
