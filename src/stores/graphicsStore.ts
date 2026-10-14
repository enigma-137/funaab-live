import { create } from 'zustand';
import { toast } from './toastStore';
import { PREF_LABELS, lowerTier, resolveTier, startingTier, type QualityPref, type QualityTier } from '../config/quality';

const KEY = 'funaab_graphics';
const readPref = (): QualityPref => {
  try {
    const v = new URLSearchParams(window.location.search).get('q') ?? localStorage.getItem(KEY);
    return v === 'low' || v === 'medium' || v === 'high' ? v : 'auto';
  } catch { return 'auto'; }
};
const detect = (): QualityTier => {
  if (typeof window === 'undefined') return 'high';
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return startingTier({
    touch: (navigator.maxTouchPoints || 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches === true,
    memory: nav.deviceMemory, cores: navigator.hardwareConcurrency, dpr: window.devicePixelRatio, saveData: nav.connection?.saveData,
  });
};

interface GraphicsStore {
  pref: QualityPref;
  /** What Auto currently uses: starts from the device, only ever goes down. */
  auto: QualityTier;
  tier: QualityTier;
  setPref: (p: QualityPref) => void;
  /** Called when the frame rate stays poor. Returns true if it lowered anything. */
  decline: () => boolean;
}

const initialAuto = detect();
export const useGraphicsStore = create<GraphicsStore>((set, get) => ({
  pref: typeof window === 'undefined' ? 'auto' : readPref(),
  auto: initialAuto,
  tier: resolveTier(typeof window === 'undefined' ? 'auto' : readPref(), initialAuto),
  setPref: (pref) => {
    try { localStorage.setItem(KEY, pref); } catch { /* private mode */ }
    set({ pref, tier: resolveTier(pref, get().auto) });
  },
  decline: () => {
    const { pref, auto } = get();
    if (pref !== 'auto' || auto === 'low') return false;
    const next = lowerTier(auto);
    set({ auto: next, tier: next });
    toast({ icon: '🔋', text: `Game was lagging, so graphics are now “${PREF_LABELS[next].title}”. Change it any time in Phone → Controls.`, tone: 'info', ms: 7000 });
    return true;
  },
}));
