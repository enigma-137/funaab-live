import { create } from 'zustand';

// One queue for short-lived notices (job paid, food bought, goal done…). Shown by ToastStack.
export type ToastTone = 'good' | 'bad' | 'info';
export interface Toast { id: number; icon?: string; text: string; amount?: number; tone: ToastTone; until: number }

const MAX_VISIBLE = 3;
let nextId = 1;

interface ToastStore {
  toasts: Toast[];
  push: (t: { icon?: string; text: string; amount?: number; tone?: ToastTone; ms?: number }) => number;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: ({ icon, text, amount, tone = 'info', ms = 3200 }) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, icon, text, amount, tone, until: Date.now() + ms }].slice(-MAX_VISIBLE) }));
    setTimeout(() => useToastStore.getState().dismiss(id), ms);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (t: Parameters<ToastStore['push']>[0]) => useToastStore.getState().push(t);
