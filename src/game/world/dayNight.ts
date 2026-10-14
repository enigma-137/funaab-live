import { create } from 'zustand';

// Campus day/night follows the real clock in Lagos (UTC+1, no daylight saving): dusk falls from
// 18:15 to 19:15 and dawn breaks from 05:45 to 06:45. `?time=night`, `?time=dusk` or `?time=day`
// in the address forces a look (for testing and screenshots).

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DUSK = [18 * 60 + 15, 19 * 60 + 15] as const;
const DAWN = [5 * 60 + 45, 6 * 60 + 45] as const;

export const lagosMinutes = (ms: number) => {
  const d = new Date(ms + LAGOS_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
};

const smooth = (t: number) => t * t * (3 - 2 * t);

/** 0 = full day, 1 = full night, smooth in between. */
export function nightAmount(ms: number): number {
  const m = lagosMinutes(ms);
  if (m >= DUSK[1] || m < DAWN[0]) return 1;
  if (m >= DUSK[0]) return smooth((m - DUSK[0]) / (DUSK[1] - DUSK[0]));
  if (m < DAWN[1]) return 1 - smooth((m - DAWN[0]) / (DAWN[1] - DAWN[0]));
  return 0;
}

function forced(): number | null {
  try {
    const t = new URLSearchParams(window.location.search).get('time');
    return t === 'night' ? 1 : t === 'dusk' ? 0.55 : t === 'day' ? 0 : null;
  } catch {
    return null;
  }
}

const current = () => forced() ?? nightAmount(Date.now());

/** Night level, refreshed every 30 seconds. Rounded so the scene only re-renders on real change. */
export const useDayNight = create<{ night: number }>(() => ({ night: typeof window === 'undefined' ? 0 : current() }));

if (typeof window !== 'undefined') {
  window.setInterval(() => {
    const night = Math.round(current() * 50) / 50;
    if (night !== useDayNight.getState().night) useDayNight.setState({ night });
  }, 30_000);
}

/** Lights at night start to matter from here; below it the scene is plain daylight. */
export const NIGHT_LIGHTS_FROM = 0.25;
