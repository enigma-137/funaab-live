// Sports Centre basketball court: free-throw shootout. Same shape as the penalty challenge
// (src/config/football.ts): pure and dependency-free so the Worker (authority) and the client
// (rendering) agree exactly. The client only sends aim + power; the Worker rolls randomness.

import {
  defineShootout, isShootoutError, isValidShotInput, type ShootoutError, type ShootoutPlayer, type ShootoutState, type ShootoutStatus, type Shot, type ShotInput,
} from './shootout';

export type Vec3 = [number, number, number];

// World layout: a full court south of the football pitch, long axis along X. The challenge
// uses the west hoop; the shooter stands on the free-throw line facing west (-X).
const COURT_CENTRE: Vec3 = [-107, 0, 30];
const COURT_LENGTH = 24;
const COURT_WIDTH = 13;
const BASELINE_X = COURT_CENTRE[0] - COURT_LENGTH / 2; // -119
const BACKBOARD_X = BASELINE_X + 1.2;
const RIM_X = BACKBOARD_X + 0.38;

export const BASKETBALL_COURT = {
  centre: COURT_CENTRE,
  length: COURT_LENGTH,
  width: COURT_WIDTH,
  baselineX: BASELINE_X,
  backboardX: BACKBOARD_X,
  /** Centre of the challenge rim (regulation 3.05 m). */
  rim: [RIM_X, 3.05, COURT_CENTRE[2]] as Vec3,
  rimRadius: 0.23,
  /** Free-throw line, 4.6 m in front of the backboard. */
  freeThrowX: BACKBOARD_X + 4.6,
  /** Where the shooter stands: just behind the line and slightly right so the camera sees the hoop. */
  shooterSpot: [BACKBOARD_X + 5.0, 0, COURT_CENTRE[2] + 0.45] as Vec3,
  /** Shooter faces the hoop (due -X). */
  facing: -Math.PI / 2,
  /** Orbit camera yaw that sits behind the shooter looking at the hoop. */
  cameraYaw: Math.PI / 2,
  interactionRadius: 3.2,
  /** Server-side proximity allowance (trusted position lags slightly). */
  serverRadius: 7,
};


export const BASKETBALL_RULES = {
  SHOTS_PER_PLAYER: 5,
  TURN_SECONDS: 30,
  PRACTICE_COOLDOWN_MS: 2200,
  /** A finished scoreboard can be cleared by someone else after this long. */
  RESULT_HOLD_MS: 20000,
  /** Power that drops the ball exactly on the rim. */
  SWEET_POWER: 0.62,
};

export type HoopOutcome = 'SWISH' | 'SCORE' | 'RIM' | 'MISS';
export const isBasket = (o: HoopOutcome) => o === 'SWISH' || o === 'SCORE';

export type HoopShotInput = ShotInput;

export interface HoopShotResult {
  outcome: HoopOutcome;
  /** Where the ball comes down relative to the rim centre, metres: [right of rim, past the rim]. */
  landing: [number, number];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const isValidHoopShot = isValidShotInput;

/**
 * Deterministic for a given rng: three draws, always in the same order (side noise, depth noise,
 * roll), so tests can replay any shot exactly.
 *
 * Feel: aim at the middle and time the meter near the sweet spot. A clean drop is a swish; a
 * ball that catches the rim may roll in or out; anything wider is a miss (short, long or wide).
 */
export function resolveHoopShot(input: HoopShotInput, rng: () => number): HoopShotResult {
  const aim = clamp(input.aim, -1, 1);
  const power = clamp(input.power, 0, 1);
  const side = aim * 0.9 + (rng() * 2 - 1) * 0.1;
  const depth = (power - BASKETBALL_RULES.SWEET_POWER) * 2.4 + (rng() * 2 - 1) * 0.1;
  const roll = rng();
  const landing: [number, number] = [Number(side.toFixed(3)), Number(depth.toFixed(3))];
  const off = Math.hypot(side, depth);
  let outcome: HoopOutcome;
  if (off <= 0.09) outcome = 'SWISH';
  else if (off <= 0.17) outcome = 'SCORE';
  // On the rim: the closer to the middle, the likelier it rolls in.
  else if (off <= 0.36) outcome = roll < 0.75 - (off - 0.17) * 3.5 ? 'SCORE' : 'RIM';
  else outcome = 'MISS';
  return { outcome, landing };
}

/** Client flight path: [release, apex, rim crossing, rest]. Pixel-free so tests can check it. */
export function hoopFlightPath(shot: Pick<HoopShotResult, 'outcome' | 'landing'> & { reason?: 'timeout' }) {
  const { rim, shooterSpot, baselineX } = BASKETBALL_COURT;
  const release: Vec3 = [shooterSpot[0] - 0.3, 2.1, shooterSpot[2] - 0.25];
  if (shot.reason === 'timeout') return { release, apex: release, cross: release, rest: [release[0], 0.12, release[2]] as Vec3 };
  // Shooter faces -X: "right" is -Z, "past the rim" is -X.
  const cross: Vec3 = [rim[0] - shot.landing[1], rim[1] + 0.05, rim[2] - shot.landing[0]];
  const apex: Vec3 = [(release[0] + cross[0]) / 2, 4.6, (release[2] + cross[2]) / 2];
  let rest: Vec3;
  switch (shot.outcome) {
    case 'SWISH':
    case 'SCORE':
      rest = [rim[0] + 0.9, 0.12, rim[2] - shot.landing[0] * 0.5];
      break;
    case 'RIM':
      rest = [rim[0] + 2.2, 0.12, rim[2] - Math.sign(shot.landing[0] || 1) * 1.6];
      break;
    case 'MISS':
    default:
      // Long shots bounce off the backboard into the key; short / wide ones drop by the baseline.
      rest = shot.landing[1] > 0
        ? [rim[0] + 2.6, 0.12, rim[2] - shot.landing[0]]
        : [Math.max(baselineX + 0.4, cross[0] + 0.4), 0.12, rim[2] - shot.landing[0] * 1.4];
  }
  return { release, apex, cross, rest };
}

// ── 1v1 match state (shared shootout machine) ──────────────────────────────────────────

export const BASKETBALL = defineShootout<HoopOutcome, HoopShotResult>({
  rules: BASKETBALL_RULES,
  resolve: resolveHoopShot,
  points: (o) => (isBasket(o) ? 1 : 0),
  timeoutResult: { outcome: 'MISS', landing: [0, -3] },
  match: 'shootout',
  place: 'court',
  practise: 'Practise',
});

export type BasketballStatus = ShootoutStatus;
export type BasketballPlayer = ShootoutPlayer;
export type BasketballShot = Shot<HoopShotResult>;
export type BasketballMatchState = ShootoutState<HoopOutcome, HoopShotResult>;
export type BasketballError = ShootoutError;
export const isBasketballError = isShootoutError;
export const createCourt = BASKETBALL.create;
export const isCourtPlayer = BASKETBALL.isPlayer;
export const courtBusy = BASKETBALL.busy;
export const createHoopChallenge = BASKETBALL.createChallenge;
export const joinHoopChallenge = BASKETBALL.join;
export const cancelHoopChallenge = BASKETBALL.cancel;
export const takeHoopShot = BASKETBALL.take;
export const expireHoopTurn = BASKETBALL.expire;
export const takeHoopPractice = BASKETBALL.practice;
export const leaveCourt = BASKETBALL.leave;
export const voteHoopRematch = BASKETBALL.rematch;
