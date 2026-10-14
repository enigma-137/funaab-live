// Sports Centre basketball court: free-throw shootout. Same shape as the penalty challenge
// (src/config/football.ts): pure and dependency-free so the Worker (authority) and the client
// (rendering) agree exactly. The client only sends aim + power; the Worker rolls randomness.

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

/** Volleyball court beside the basketball court (visual only for now). Long axis along Z. */
export const VOLLEYBALL_COURT = { centre: [-87.5, 0, 31] as Vec3, length: 16, width: 8 };

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

export interface HoopShotInput {
  /** -1 (left of the rim, from the shooter's view) .. 1 (right). */
  aim: number;
  /** 0 .. 1; too little falls short, too much clangs off the back. */
  power: number;
}

export interface HoopShotResult {
  outcome: HoopOutcome;
  /** Where the ball comes down relative to the rim centre, metres: [right of rim, past the rim]. */
  landing: [number, number];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function isValidHoopShot(input: unknown): input is HoopShotInput {
  const s = input as HoopShotInput;
  return !!s && typeof s.aim === 'number' && typeof s.power === 'number'
    && Number.isFinite(s.aim) && Number.isFinite(s.power)
    && s.aim >= -1 && s.aim <= 1 && s.power >= 0 && s.power <= 1;
}

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

// ── 1v1 match state ────────────────────────────────────────────────────────────────────────

export type BasketballStatus = 'LOBBY' | 'WAITING' | 'ACTIVE' | 'RESULT';

export interface BasketballPlayer { userId: string; connectionId: string; name: string }

export interface BasketballShot extends HoopShotResult {
  /** Increments for every shot (practice included) so clients animate each one exactly once. */
  seq: number;
  shooterUserId: string;
  shooterConnectionId: string;
  shooterName: string;
  practice: boolean;
  aim: number;
  power: number;
  /** 'timeout' when the turn clock ran out; the shot counts as a miss. */
  reason?: 'timeout';
  at: number;
}

export interface BasketballMatchState {
  id: string;
  status: BasketballStatus;
  player1: BasketballPlayer | null;
  player2: BasketballPlayer | null;
  turnUserId: string | null;
  turnDeadline: number | null;
  shotsRemaining: Record<string, number>;
  score: Record<string, number>;
  history: Record<string, HoopOutcome[]>;
  winnerUserId: string | null;
  endReason: 'complete' | 'forfeit' | null;
  rematchVotes: string[];
  leftUserIds: string[];
  lastShot: BasketballShot | null;
  shotSeq: number;
  updatedAt: number;
  finishedAt: number | null;
}

export type BasketballError = { error: string };
const fail = (error: string): BasketballError => ({ error });
export const isBasketballError = (v: unknown): v is BasketballError => !!v && typeof (v as BasketballError).error === 'string';

export function createCourt(now: number, shotSeq = 0): BasketballMatchState {
  return {
    id: '', status: 'LOBBY', player1: null, player2: null, turnUserId: null, turnDeadline: null,
    shotsRemaining: {}, score: {}, history: {}, winnerUserId: null, endReason: null, rematchVotes: [],
    leftUserIds: [], lastShot: null, shotSeq, updatedAt: now, finishedAt: null,
  };
}

export const isCourtPlayer = (s: BasketballMatchState, userId: string) =>
  s.player1?.userId === userId || s.player2?.userId === userId;
const opponentOf = (s: BasketballMatchState, userId: string) => (s.player1?.userId === userId ? s.player2 : s.player1);
export const courtBusy = (s: BasketballMatchState) => s.status === 'ACTIVE';
const reset = (s: BasketballMatchState, now: number) => ({ ...createCourt(now, s.shotSeq), lastShot: s.lastShot });

export function createHoopChallenge(s: BasketballMatchState, host: BasketballPlayer, id: string, now: number): BasketballMatchState | BasketballError {
  if (s.status === 'WAITING') return fail(s.player1?.userId === host.userId ? 'Your challenge is already open.' : `@${s.player1?.name} is already waiting for a challenger. Join them!`);
  if (s.status === 'ACTIVE') return fail('A shootout is on. Wait for the final buzzer.');
  if (s.status === 'RESULT' && !isCourtPlayer(s, host.userId) && now - (s.finishedAt ?? 0) < BASKETBALL_RULES.RESULT_HOLD_MS)
    return fail('The last shootout just ended. Try again in a few seconds.');
  return { ...reset(s, now), id, status: 'WAITING', player1: host };
}

function start(s: BasketballMatchState, p1: BasketballPlayer, p2: BasketballPlayer, now: number, id: string): BasketballMatchState {
  const per = BASKETBALL_RULES.SHOTS_PER_PLAYER;
  return {
    ...s, id, status: 'ACTIVE', player1: p1, player2: p2, turnUserId: p1.userId,
    turnDeadline: now + BASKETBALL_RULES.TURN_SECONDS * 1000,
    shotsRemaining: { [p1.userId]: per, [p2.userId]: per },
    score: { [p1.userId]: 0, [p2.userId]: 0 },
    history: { [p1.userId]: [], [p2.userId]: [] },
    winnerUserId: null, endReason: null, rematchVotes: [], leftUserIds: [], updatedAt: now, finishedAt: null,
  };
}

export function joinHoopChallenge(s: BasketballMatchState, guest: BasketballPlayer, matchId: string, now: number): BasketballMatchState | BasketballError {
  if (s.status !== 'WAITING' || !s.player1 || s.id !== matchId) return fail('That challenge is no longer open.');
  if (s.player1.userId === guest.userId) return fail('You cannot join your own challenge.');
  return start(s, s.player1, guest, now, s.id);
}

export function cancelHoopChallenge(s: BasketballMatchState, userId: string, now: number): BasketballMatchState | BasketballError {
  if (s.status !== 'WAITING' || s.player1?.userId !== userId) return fail('No open challenge to cancel.');
  return reset(s, now);
}

function finish(s: BasketballMatchState, now: number, endReason: 'complete' | 'forfeit', winnerUserId: string | null): BasketballMatchState {
  return { ...s, status: 'RESULT', turnUserId: null, turnDeadline: null, winnerUserId, endReason, rematchVotes: [], finishedAt: now, updatedAt: now };
}

function record(s: BasketballMatchState, shooter: BasketballPlayer, input: HoopShotInput, result: HoopShotResult, now: number, reason?: 'timeout'): BasketballMatchState {
  const seq = s.shotSeq + 1;
  const shot: BasketballShot = {
    seq, shooterUserId: shooter.userId, shooterConnectionId: shooter.connectionId, shooterName: shooter.name,
    practice: false, aim: input.aim, power: input.power, ...result, ...(reason ? { reason } : {}), at: now,
  };
  const uid = shooter.userId;
  const score = { ...s.score, [uid]: (s.score[uid] ?? 0) + (isBasket(result.outcome) ? 1 : 0) };
  const shotsRemaining = { ...s.shotsRemaining, [uid]: Math.max(0, (s.shotsRemaining[uid] ?? 0) - 1) };
  const history = { ...s.history, [uid]: [...(s.history[uid] ?? []), result.outcome] };
  const next: BasketballMatchState = { ...s, score, shotsRemaining, history, lastShot: shot, shotSeq: seq, updatedAt: now };
  const opponent = opponentOf(s, uid)!;
  const nextShooter = (shotsRemaining[opponent.userId] ?? 0) > 0 ? opponent : (shotsRemaining[uid] ?? 0) > 0 ? shooter : null;
  if (!nextShooter) {
    const a = score[s.player1!.userId] ?? 0, b = score[s.player2!.userId] ?? 0;
    return finish(next, now, 'complete', a === b ? null : a > b ? s.player1!.userId : s.player2!.userId);
  }
  return { ...next, turnUserId: nextShooter.userId, turnDeadline: now + BASKETBALL_RULES.TURN_SECONDS * 1000 };
}

export function takeHoopShot(s: BasketballMatchState, userId: string, input: HoopShotInput, rng: () => number, now: number): BasketballMatchState | BasketballError {
  if (s.status !== 'ACTIVE') return fail('No shootout in progress.');
  if (!isCourtPlayer(s, userId)) return fail('You are not in this shootout.');
  if (s.turnUserId !== userId) return fail('Wait for your turn.');
  if (!isValidHoopShot(input)) return fail('Invalid shot.');
  const shooter = s.player1!.userId === userId ? s.player1! : s.player2!;
  return record(s, shooter, input, resolveHoopShot(input, rng), now);
}

/** Turn clock ran out: the shot is lost (counted as a miss, nothing is thrown). */
export function expireHoopTurn(s: BasketballMatchState, now: number): BasketballMatchState | null {
  if (s.status !== 'ACTIVE' || !s.turnDeadline || now < s.turnDeadline || !s.turnUserId) return null;
  const shooter = s.player1!.userId === s.turnUserId ? s.player1! : s.player2!;
  return record(s, shooter, { aim: 0, power: 0 }, { outcome: 'MISS', landing: [0, -3] }, now, 'timeout');
}

/** Practice throw: anyone, any time the court is not mid-shootout. Never touches the score. */
export function takeHoopPractice(s: BasketballMatchState, shooter: BasketballPlayer, input: HoopShotInput, rng: () => number, now: number): BasketballMatchState | BasketballError {
  if (courtBusy(s)) return fail('A shootout is on. Practise after the final buzzer.');
  if (!isValidHoopShot(input)) return fail('Invalid shot.');
  const seq = s.shotSeq + 1;
  const shot: BasketballShot = {
    seq, shooterUserId: shooter.userId, shooterConnectionId: shooter.connectionId, shooterName: shooter.name,
    practice: true, aim: input.aim, power: input.power, ...resolveHoopShot(input, rng), at: now,
  };
  return { ...s, lastShot: shot, shotSeq: seq, updatedAt: now };
}

/** Disconnect / walk-away. Mid-shootout the opponent wins by forfeit; otherwise the slot is freed. */
export function leaveCourt(s: BasketballMatchState, userId: string, now: number): BasketballMatchState | null {
  if (!isCourtPlayer(s, userId)) return null;
  if (s.status === 'WAITING') return reset(s, now);
  if (s.status === 'ACTIVE') return { ...finish(s, now, 'forfeit', opponentOf(s, userId)!.userId), leftUserIds: [userId] };
  if (s.status === 'RESULT') {
    const stay = opponentOf(s, userId);
    if (!stay || s.leftUserIds.includes(stay.userId)) return reset(s, now);
    return { ...s, leftUserIds: [...new Set([...s.leftUserIds, userId])], rematchVotes: s.rematchVotes.filter((v) => v !== userId), updatedAt: now };
  }
  return null;
}

/** Both players press Play Again → fresh shootout, the other player shoots first. */
export function voteHoopRematch(s: BasketballMatchState, userId: string, now: number, newId: string): BasketballMatchState | BasketballError {
  if (s.status !== 'RESULT' || !isCourtPlayer(s, userId)) return fail('No finished shootout to replay.');
  if (s.leftUserIds.length) return fail('Your opponent has left the court.');
  const votes = s.rematchVotes.includes(userId) ? s.rematchVotes : [...s.rematchVotes, userId];
  if (votes.length < 2) return { ...s, rematchVotes: votes, updatedAt: now };
  return start(s, s.player2!, s.player1!, now, newId);
}
