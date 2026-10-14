// Graphics quality tiers. "Auto" picks a starting tier from the device and drops a tier if the
// frame rate stays poor; players can also pin a tier in Controls. Pure data + decisions here so
// scripts/test-quality.ts can check them.

export type QualityTier = 'low' | 'medium' | 'high';
export type QualityPref = 'auto' | QualityTier;

export interface QualitySettings {
  /** Highest pixel ratio the canvas may use (the cap that matters most on phones). */
  maxDpr: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Only read at start-up: changing antialiasing needs a fresh canvas. */
  antialias: boolean;
  /** Real point lights that follow the student at night (each costs on every surface). */
  nightLights: number;
  stars: number;
  /** The physically-based sky shader runs on every pixel; lower tiers use a plain sky colour instead. */
  sky: boolean;
  /** Students farther than this are drawn as a simple figure (about a quarter of the draws). */
  avatarNear: number;
  /** Name tags are only drawn for students closer than this (each is a page element moved every frame). */
  nameTagNear: number;
  /** Students cast shadows (doubles their draws). */
  avatarShadows: boolean;
  /** Beyond this the world is fully fogged anyway, so it is not drawn. */
  far: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { maxDpr: 1, shadows: false, shadowMapSize: 512, antialias: false, nightLights: 1, stars: 400, sky: false, avatarNear: 12, nameTagNear: 14, avatarShadows: false, far: 120 },
  medium: { maxDpr: 1.25, shadows: true, shadowMapSize: 512, antialias: false, nightLights: 2, stars: 900, sky: false, avatarNear: 18, nameTagNear: 20, avatarShadows: false, far: 135 },
  high: { maxDpr: 1.75, shadows: true, shadowMapSize: 1024, antialias: true, nightLights: 4, stars: 1400, sky: true, avatarNear: 24, nameTagNear: 30, avatarShadows: true, far: 140 },
};
export const TIERS: QualityTier[] = ['low', 'medium', 'high'];

export const PREF_LABELS: Record<QualityPref, { title: string; text: string }> = {
  auto: { title: 'Auto', text: 'Picks the best for your phone and lowers itself if the game starts to lag.' },
  low: { title: 'Battery saver', text: 'Smoothest on slower phones: no shadows, sharper-but-smaller picture, fewer lights.' },
  medium: { title: 'Balanced', text: 'Shadows on, lighter lighting and picture size.' },
  high: { title: 'Best looking', text: 'Full shadows, lights and sharpness. Needs a recent phone or a computer.' },
};

export interface DeviceHints {
  touch: boolean;
  /** navigator.deviceMemory in GB (Chrome/Android only). */
  memory?: number;
  cores?: number;
  /** window.devicePixelRatio */
  dpr?: number;
  /** Set by Save-Data / reduced-motion style preferences. */
  saveData?: boolean;
}

/** Where Auto starts. Err towards smooth: a slow phone that's too pretty is a bad first minute. */
export function startingTier(d: DeviceHints): QualityTier {
  if (d.saveData) return 'low';
  if (!d.touch) return 'high';
  const weak = (d.memory !== undefined && d.memory <= 4) || (d.cores !== undefined && d.cores <= 4);
  const strong = (d.memory === undefined || d.memory >= 8) && (d.cores === undefined || d.cores >= 8);
  return weak ? 'low' : strong ? 'high' : 'medium';
}

export const lowerTier = (t: QualityTier): QualityTier => TIERS[Math.max(0, TIERS.indexOf(t) - 1)];
export const resolveTier = (pref: QualityPref, auto: QualityTier): QualityTier => (pref === 'auto' ? auto : pref);

/** The pixel ratio to render at: the device's own, capped by the tier. */
export const effectiveDpr = (tier: QualityTier, deviceDpr: number) => Math.max(1, Math.min(deviceDpr || 1, QUALITY[tier].maxDpr));
