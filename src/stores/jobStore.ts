import { create } from 'zustand';
import { CampusJob } from '../types/game';
import { ECONOMY_CONFIG } from '../config/economy';
import { useWalletStore } from './walletStore';
import { networkManager } from '../game/multiplayer/networkManager';

interface JobState {
  activeJob: CampusJob | null;
  availableJobs: CampusJob[];
  lastCompletedJobAt: number | null;

  acceptJob: (jobId: string) => boolean;
  cancelJob: () => void;
  pickupDeliveryPackage: () => void;
  completeActiveJob: (userId: string) => Promise<{ success: boolean; reward: number }>;
  checkJobProximity: (playerPos: [number, number, number]) => {
    canPickup: boolean;
    canDeliver: boolean;
    targetName: string;
    distance: number;
  };
}

const initialJobs: CampusJob[] = [
  { ...ECONOMY_CONFIG.JOBS.FOOD_DELIVERY, status: 'available' },
  { ...ECONOMY_CONFIG.JOBS.CAMPUS_ERRAND, status: 'available' },
  { ...ECONOMY_CONFIG.JOBS.SPORTS_ASSISTANT, status: 'available' },
  { ...ECONOMY_CONFIG.JOBS.GROUNDS_CLEANUP, status: 'available' },
];

export const useJobStore = create<JobState>((set, get) => ({
  activeJob: null,
  availableJobs: initialJobs,
  lastCompletedJobAt: null,

  acceptJob: (jobId: string) => {
    const job = get().availableJobs.find((j) => j.id === jobId);
    if (!job) return false;

    // For food delivery & errand, starts at 'accepted' (needs pickup)
    // For sports & grounds, source is start location, so status is 'picked_up' directly
    const initialStatus = (job.type === 'delivery' || job.type === 'errand') ? 'accepted' : 'picked_up';

    set({
      activeJob: {
        ...job,
        status: initialStatus,
        progress: 0,
      },
    });

    return true;
  },

  cancelJob: () => {
    set({ activeJob: null });
  },

  pickupDeliveryPackage: () => {
    const current = get().activeJob;
    if (!current) return;
    set({
      activeJob: {
        ...current,
        status: 'picked_up',
      },
    });
  },

  completeActiveJob: async (userId: string) => {
    const current = get().activeJob;
    if (!current || current.status !== 'picked_up') {
      return { success: false, reward: 0 };
    }

    const reward = current.reward;

    // Grant reward in wallet store
    await useWalletStore.getState().grantJobReward(userId, reward, current.title);

    // Send network job event to broadcast activity
    networkManager.sendJobCompleted(current.title, reward);

    set({
      activeJob: null,
      lastCompletedJobAt: Date.now(),
    });

    return { success: true, reward };
  },

  checkJobProximity: (playerPos: [number, number, number]) => {
    const job = get().activeJob;
    if (!job) return { canPickup: false, canDeliver: false, targetName: '', distance: 999 };

    const [px, , pz] = playerPos;

    if (job.status === 'accepted') {
      const [sx, , sz] = job.sourcePos;
      const dist = Math.hypot(px - sx, pz - sz);
      return {
        canPickup: dist <= 4.5,
        canDeliver: false,
        targetName: job.source,
        distance: Math.round(dist),
      };
    }

    if (job.status === 'picked_up') {
      const [dx, , dz] = job.destinationPos;
      const dist = Math.hypot(px - dx, pz - dz);
      return {
        canPickup: false,
        canDeliver: dist <= 4.5,
        targetName: job.destination,
        distance: Math.round(dist),
      };
    }

    return { canPickup: false, canDeliver: false, targetName: '', distance: 999 };
  },
}));
