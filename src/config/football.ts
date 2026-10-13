// Sports Centre penalty challenge: shared shot model + 1v1 match state machine.
// Pure and dependency-free so the Worker (authority) and the client (rendering) agree exactly.
// The client only ever sends aim + power; the Worker rolls randomness and decides the outcome.

export type Vec3 = [number, number, number];

// World layout. The pitch is centred on the Sports Centre location (-100, 0, 0); the challenge
// uses the north goal (goal line at z = -16) so the south goal stays free for the cones job.
export const FOOTBALL_PITCH = {
  centre: [-100, 0, 0] as Vec3,
  goalLineZ: -16,
  /** Inner half-width of the goal mouth (posts at x = ±2.4 from the centre line). */
  goalHalfWidth: 2.4,
  crossbarHeight: 2.4,
  penaltySpot: [-100, 0, -10.5] as Vec3,
  /** Where the shooter stands: behind and just left of the ball (so the camera sees it), facing the goal. */
  shooterSpot: [-100.8, 0, -9.0] as Vec3,
  interactionRadius: 3.2,
  /** Server-side proximity allowance (trusted position lags slightly). */
  serverRadius: 7,
};

export const FOOTBALL_RULES = {
  SHOTS_PER_PLAYER: 3,
  TURN_SECONDS: 30,
  PRACTICE_COOLDOWN_MS: 2500,
  /** A finished scoreboard can be cleared by someone else after this long. */
  RESULT_HOLD_MS: 20000,
};

export type ShotOutcome = 'GOAL' | 'SAVED' | 'MISS' | 'POST';
export type KeeperDive = -1 | 0 | 1;

export interface ShotInput {
  /** -1 (far left of the goal, from the shooter's view) .. 1 (far right). */
  aim: number;
  /** 0 (tap) .. 1 (full blast). */
  power: number;
}

export interface ShotResult {
  outcome: ShotOutcome;
  /** Where the ball crosses the goal plane, relative to the goal centre: [x, height]. */
  target: [number, number];
  keeperDive: KeeperDive;
}

const POST_RADIUS = 0.06;
const BALL_RADIUS = 0.11;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function isValidShotInput(input: unknown): input is ShotInput {
  const s = input as ShotInput;
  return (
    !!s &&
    typeof s.aim === 'number' &&
    typeof s.power === 'number' &&
    Number.isFinite(s.aim) &&
    Number.isFinite(s.power) &&
    s.aim >= -1 &&
    s.aim <= 1 &&
    s.power >= 0 &&
    s.power <= 1
  );
}

/**
 * Deterministic for a given rng: four draws, always in the same order (x noise, height noise,
 * keeper dive, save roll), so tests can replay any shot exactly.
 *
 * Feel: aiming near a post is risky (noise can carry it wide), over-hit shots fly high, weak
 * shots are easy saves, and a keeper guessing the right side still needs to win a save roll
 * that gets harder for well-placed, well-struck shots.
 */
export function resolveShot(input: ShotInput, rng: () => number): ShotResult {
  const aim = clamp(input.aim, -1, 1);
  const power = clamp(input.power, 0, 1);
  const overHit = clamp((power - 0.8) / 0.2, 0, 1);
  const spread = 0.32 + overHit * 0.7;
  const x = aim * 2.85 + (rng() * 2 - 1) * spread;
  const y = clamp(0.25 + power * 2.05 + (rng() * 2 - 1) * (0.22 + overHit * 0.3), 0.11, 4);
  const diveRoll = rng();
  const keeperDive: KeeperDive = diveRoll < 0.4 ? -1 : diveRoll < 0.6 ? 0 : 1;
  const saveRoll = rng();
  const target: [number, number] = [Number(x.toFixed(3)), Number(y.toFixed(3))];
  const { goalHalfWidth: half, crossbarHeight: bar } = FOOTBALL_PITCH;
  const edge = POST_RADIUS + BALL_RADIUS;

  // Clips a post or the bar before anything else.
  const nearPost = Math.abs(Math.abs(x) - half) <= edge && y <= bar + edge;
  const nearBar = Math.abs(y - bar) <= edge && Math.abs(x) <= half;
  if (nearPost || nearBar) return { outcome: 'POST', target, keeperDive };
  if (Math.abs(x) > half || y > bar) return { outcome: 'MISS', target, keeperDive };

  const zone: KeeperDive = x < -0.8 ? -1 : x > 0.8 ? 1 : 0;
  const pace = clamp((power - 0.3) / 0.5, 0, 1);
  const corner = clamp((Math.abs(x) - 1.2) / 1.1, 0, 1);
  let saveChance: number;
  if (power < 0.22) saveChance = 0.9; // a roller: the keeper just walks onto it
  else if (keeperDive === zone) saveChance = 0.85 - corner * 0.45 - pace * 0.35;
  else saveChance = Math.abs(x) < 0.6 ? 0.3 : 0; // dived the wrong way: only a central shot hits the legs
  return { outcome: saveRoll < saveChance ? 'SAVED' : 'GOAL', target, keeperDive };
}

// ── 1v1 match state ────────────────────────────────────────────────────────────────────────

export type FootballStatus = 'LOBBY' | 'WAITING' | 'ACTIVE' | 'RESULT';

export interface FootballPlayer {
  userId: string;
  connectionId: string;
  name: string;
}

export interface FootballShot {
  /** Increments for every shot (practice included) so clients animate each one exactly once. */
  seq: number;
  shooterUserId: string;
  shooterConnectionId: string;
  shooterName: string;
  practice: boolean;
  aim: number;
  power: number;
  outcome: ShotOutcome;
  target: [number, number];
  keeperDive: KeeperDive;
  /** 'timeout' when the turn clock ran out; the shot counts as a miss. */
  reason?: 'timeout';
  at: number;
}

export interface FootballMatchState {
  id: string;
  status: FootballStatus;
  player1: FootballPlayer | null;
  player2: FootballPlayer | null;
  turnUserId: string | null;
  turnDeadline: number | null;
  shotsRemaining: Record<string, number>;
  score: Record<string, number>;
  /** Per-player outcomes in order, for the scoreboard dots. */
  history: Record<string, ShotOutcome[]>;
  winnerUserId: string | null;
  endReason: 'complete' | 'forfeit' | null;
  rematchVotes: string[];
  /** Players who left the finished scoreboard; a rematch needs both still here. */
  leftUserIds: string[];
  lastShot: FootballShot | null;
  shotSeq: number;
  updatedAt: number;
  finishedAt: number | null;
}

export type FootballError = { error: string };
const fail = (error: string): FootballError => ({ error });
export const isFootballError = (v: unknown): v is FootballError => !!v && typeof (v as FootballError).error === 'string';

export function createLobby(now: number, shotSeq = 0): FootballMatchState {
  return {
    id: '',
    status: 'LOBBY',
    player1: null,
    player2: null,
    turnUserId: null,
    turnDeadline: null,
    shotsRemaining: {},
    score: {},
    history: {},
    winnerUserId: null,
    endReason: null,
    rematchVotes: [],
    leftUserIds: [],
    lastShot: null,
    shotSeq,
    updatedAt: now,
    finishedAt: null,
  };
}

export const isParticipant = (s: FootballMatchState, userId: string) =>
  s.player1?.userId === userId || s.player2?.userId === userId;

const opponentOf = (s: FootballMatchState, userId: string) =>
  s.player1?.userId === userId ? s.player2 : s.player1;

/** Pitch is "busy" while two players are mid-match; practice waits until it ends. */
export const pitchBusy = (s: FootballMatchState) => s.status === 'ACTIVE';

export function createChallenge(s: FootballMatchState, host: FootballPlayer, id: string, now: number): FootballMatchState | FootballError {
  if (s.status === 'WAITING') return fail(s.player1?.userId === host.userId ? 'Your challenge is already open.' : `@${s.player1?.name} is already waiting for a challenger. Join them!`);
  if (s.status === 'ACTIVE') return fail('A match is being played. Wait for the final whistle.');
  if (s.status === 'RESULT' && !isParticipant(s, host.userId) && now - (s.finishedAt ?? 0) < FOOTBALL_RULES.RESULT_HOLD_MS)
    return fail('The last match just ended. Try again in a few seconds.');
  return { ...createLobby(now, s.shotSeq), id, status: 'WAITING', player1: host, lastShot: s.lastShot };
}

function startMatch(s: FootballMatchState, p1: FootballPlayer, p2: FootballPlayer, now: number, id: string): FootballMatchState {
  const per = FOOTBALL_RULES.SHOTS_PER_PLAYER;
  return {
    ...s,
    id,
    status: 'ACTIVE',
    player1: p1,
    player2: p2,
    turnUserId: p1.userId,
    turnDeadline: now + FOOTBALL_RULES.TURN_SECONDS * 1000,
    shotsRemaining: { [p1.userId]: per, [p2.userId]: per },
    score: { [p1.userId]: 0, [p2.userId]: 0 },
    history: { [p1.userId]: [], [p2.userId]: [] },
    winnerUserId: null,
    endReason: null,
    rematchVotes: [],
    leftUserIds: [],
    updatedAt: now,
    finishedAt: null,
  };
}

export function joinChallenge(s: FootballMatchState, guest: FootballPlayer, matchId: string, now: number): FootballMatchState | FootballError {
  if (s.status !== 'WAITING' || !s.player1 || s.id !== matchId) return fail('That challenge is no longer open.');
  if (s.player1.userId === guest.userId) return fail('You cannot join your own challenge.');
  return startMatch(s, s.player1, guest, now, s.id);
}

export function cancelChallenge(s: FootballMatchState, userId: string, now: number): FootballMatchState | FootballError {
  if (s.status !== 'WAITING' || s.player1?.userId !== userId) return fail('No open challenge to cancel.');
  return { ...createLobby(now, s.shotSeq), lastShot: s.lastShot };
}

function finish(s: FootballMatchState, now: number, endReason: 'complete' | 'forfeit', winnerUserId: string | null): FootballMatchState {
  return { ...s, status: 'RESULT', turnUserId: null, turnDeadline: null, winnerUserId, endReason, rematchVotes: [], finishedAt: now, updatedAt: now };
}

function recordShot(s: FootballMatchState, shooter: FootballPlayer, input: ShotInput, result: ShotResult, now: number, reason?: 'timeout'): FootballMatchState {
  const seq = s.shotSeq + 1;
  const shot: FootballShot = {
    seq,
    shooterUserId: shooter.userId,
    shooterConnectionId: shooter.connectionId,
    shooterName: shooter.name,
    practice: false,
    aim: input.aim,
    power: input.power,
    ...result,
    ...(reason ? { reason } : {}),
    at: now,
  };
  const uid = shooter.userId;
  const score = { ...s.score, [uid]: (s.score[uid] ?? 0) + (result.outcome === 'GOAL' ? 1 : 0) };
  const shotsRemaining = { ...s.shotsRemaining, [uid]: Math.max(0, (s.shotsRemaining[uid] ?? 0) - 1) };
  const history = { ...s.history, [uid]: [...(s.history[uid] ?? []), result.outcome] };
  const next: FootballMatchState = { ...s, score, shotsRemaining, history, lastShot: shot, shotSeq: seq, updatedAt: now };
  const opponent = opponentOf(s, uid)!;
  // Alternate: A, B, A, B, A, B. If the opponent is out of shots the shooter keeps going.
  const nextShooter = (shotsRemaining[opponent.userId] ?? 0) > 0 ? opponent : (shotsRemaining[uid] ?? 0) > 0 ? shooter : null;
  if (!nextShooter) {
    const a = score[s.player1!.userId] ?? 0, b = score[s.player2!.userId] ?? 0;
    return finish(next, now, 'complete', a === b ? null : a > b ? s.player1!.userId : s.player2!.userId);
  }
  return { ...next, turnUserId: nextShooter.userId, turnDeadline: now + FOOTBALL_RULES.TURN_SECONDS * 1000 };
}

export function takeMatchShot(s: FootballMatchState, userId: string, input: ShotInput, rng: () => number, now: number): FootballMatchState | FootballError {
  if (s.status !== 'ACTIVE') return fail('No match in progress.');
  if (!isParticipant(s, userId)) return fail('You are not in this match.');
  if (s.turnUserId !== userId) return fail('Wait for your turn.');
  if (!isValidShotInput(input)) return fail('Invalid shot.');
  const shooter = s.player1!.userId === userId ? s.player1! : s.player2!;
  return recordShot(s, shooter, input, resolveShot(input, rng), now);
}

/** Turn clock ran out: the shot is lost (counted as a miss, nothing is kicked). */
export function expireTurn(s: FootballMatchState, now: number): FootballMatchState | null {
  if (s.status !== 'ACTIVE' || !s.turnDeadline || now < s.turnDeadline || !s.turnUserId) return null;
  const shooter = s.player1!.userId === s.turnUserId ? s.player1! : s.player2!;
  return recordShot(s, shooter, { aim: 0, power: 0 }, { outcome: 'MISS', target: [0, 0.11], keeperDive: 0 }, now, 'timeout');
}

/** Practice shot: anyone, any time the pitch is not mid-match. Never touches the score. */
export function takePracticeShot(s: FootballMatchState, shooter: FootballPlayer, input: ShotInput, rng: () => number, now: number): FootballMatchState | FootballError {
  if (pitchBusy(s)) return fail('A match is being played. Practice after the final whistle.');
  if (!isValidShotInput(input)) return fail('Invalid shot.');
  const seq = s.shotSeq + 1;
  const result = resolveShot(input, rng);
  const shot: FootballShot = {
    seq,
    shooterUserId: shooter.userId,
    shooterConnectionId: shooter.connectionId,
    shooterName: shooter.name,
    practice: true,
    aim: input.aim,
    power: input.power,
    ...result,
    at: now,
  };
  return { ...s, lastShot: shot, shotSeq: seq, updatedAt: now };
}

/** Disconnect / walk-away. Mid-match the opponent wins by forfeit; otherwise the slot is freed. */
export function leaveMatch(s: FootballMatchState, userId: string, now: number): FootballMatchState | null {
  if (!isParticipant(s, userId)) return null;
  if (s.status === 'WAITING') return { ...createLobby(now, s.shotSeq), lastShot: s.lastShot };
  if (s.status === 'ACTIVE') return { ...finish(s, now, 'forfeit', opponentOf(s, userId)!.userId), leftUserIds: [userId] };
  if (s.status === 'RESULT') {
    const stay = opponentOf(s, userId);
    // Once both have left the scoreboard clears.
    if (!stay || s.leftUserIds.includes(stay.userId)) return { ...createLobby(now, s.shotSeq), lastShot: s.lastShot };
    return { ...s, leftUserIds: [...new Set([...s.leftUserIds, userId])], rematchVotes: s.rematchVotes.filter((v) => v !== userId), updatedAt: now };
  }
  return null;
}

/** Both players press Play Again → fresh match, the other player shoots first. */
export function voteRematch(s: FootballMatchState, userId: string, now: number, newId: string): FootballMatchState | FootballError {
  if (s.status !== 'RESULT' || !isParticipant(s, userId)) return fail('No finished match to replay.');
  if (s.leftUserIds.length) return fail('Your opponent has left the pitch.');
  const votes = s.rematchVotes.includes(userId) ? s.rematchVotes : [...s.rematchVotes, userId];
  if (votes.length < 2) return { ...s, rematchVotes: votes, updatedAt: now };
  return startMatch(s, s.player2!, s.player1!, now, newId);
}

/** Pixel-free description of the ball's flight for clients: [start, goal-plane crossing, rest]. */
export function shotFlightPath(shot: Pick<FootballShot, 'outcome' | 'target' | 'aim' | 'reason'>): { cross: Vec3; rest: Vec3 } {
  const { penaltySpot, goalLineZ, centre } = FOOTBALL_PITCH;
  const gx = centre[0] + shot.target[0];
  const cross: Vec3 = [gx, shot.target[1], goalLineZ];
  if (shot.reason === 'timeout') return { cross: penaltySpot, rest: penaltySpot };
  switch (shot.outcome) {
    case 'GOAL':
      return { cross, rest: [gx * 0.85 + centre[0] * 0.15, 0.11, goalLineZ - 0.9] };
    case 'SAVED':
      return { cross: [gx, Math.min(shot.target[1], 1.6), goalLineZ + 0.5], rest: [gx + shot.target[0] * 0.6, 0.11, goalLineZ + 4.5] };
    case 'POST':
      return { cross, rest: [gx - Math.sign(shot.target[0] || 1) * 1.5, 0.11, goalLineZ + 3.2] };
    case 'MISS':
    default:
      // Keep the ball on the turf: it stops just behind the goal line instead of leaving the map.
      return { cross, rest: [centre[0] + clamp(shot.target[0] * 1.3, -11, 11), 0.11, goalLineZ - 1.8] };
  }
}
