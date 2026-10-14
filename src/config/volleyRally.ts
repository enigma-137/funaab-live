// 2v2 team volleyball on the Sports Centre court. Pure and dependency-free: the Worker owns the
// state and the clock; clients send only a serve (aim + power) or a touch (action + timing).
//
// A rally is a sequence of events. Each event says where the ball flies and who must touch it
// next. Clients animate the flight, then the player it comes to gets a short timing bar. The
// Worker rolls every outcome, so a forged client can only claim better timing, never a point.
import { VOLLEYBALL_COURT } from './volleyball';

export type Vec3 = [number, number, number];
export type Team = 'A' | 'B';
export const TEAMS: Team[] = ['A', 'B'];
export const other = (t: Team): Team => (t === 'A' ? 'B' : 'A');

export const RALLY_RULES = {
  TEAM_SIZE: 2,
  POINTS_TO_WIN: 11,
  WIN_BY: 2,
  POINT_CAP: 15,
  /** Time to serve before it counts as a fault. */
  SERVE_MS: 15000,
  /** After the ball arrives, how long the server waits for the touch (covers the client's timing bar + latency). */
  TOUCH_WINDOW_MS: 3500,
  /** Pause after a point before the next serve. */
  POINT_PAUSE_MS: 2200,
  /** CPU stand-ins act this long after the ball arrives. */
  BOT_DELAY_MS: 900,
  BOT_SERVE_MS: 1500,
  /** Finished scoreboard clears after this long. */
  RESULT_HOLD_MS: 20000,
  /** How close to the court you must be to join a team. */
  JOIN_RADIUS: 16,
  /** Client timing bar: length, and the moment the ball arrives (best timing). */
  BAR_MS: 1500,
  BAR_SWEET: 0.72,
};

// ── Court geometry ──────────────────────────────────────────────────────────────────────────
// Team A plays the south half (+Z) facing north; Team B the north half facing south.
const { centre, netZ, length } = VOLLEYBALL_COURT;
const sideSign = (t: Team) => (t === 'A' ? 1 : -1);
/** World X of a slot: slot 0 is on the team's left, slot 1 on its right. */
const slotX = (t: Team, slot: number) => centre[0] + (slot === 0 ? -2 : 2) * (t === 'A' ? 1 : -1);
export const slotSpot = (t: Team, slot: number): Vec3 => [slotX(t, slot), 0, netZ + sideSign(t) * 4.2];
export const serveSpot = (t: Team, slot: number): Vec3 => [slotX(t, slot), 0, netZ + sideSign(t) * (length / 2 + 0.8)];
/** Avatar facing toward the net, and an orbit camera yaw behind them. */
export const teamFacing = (t: Team) => (t === 'A' ? Math.PI : 0);
export const teamCameraYaw = (t: Team) => (t === 'A' ? 0 : Math.PI);

// ── State ───────────────────────────────────────────────────────────────────────────────────
export interface RallyPlayer { userId: string; connectionId: string; name: string; bot?: boolean }
export type RallyAction = 'pass' | 'attack';
export type PointReason = 'ace' | 'kill' | 'net' | 'out' | 'drop' | 'timeout' | 'error';

export interface RallyEvent {
  seq: number;
  kind: 'serve' | 'pass' | 'attack' | 'drop';
  team: Team;
  byUserId: string | null;
  byName: string;
  label: string;
  from: Vec3;
  to: Vec3;
  apex: number;
  /** Flight time; the next touch opens when it lands. */
  flightMs: number;
  at: number;
}

export interface RallyPending {
  userId: string;
  team: Team;
  slot: number;
  /** 0 = serving, 1..3 = touch number on this side. */
  touch: number;
  /** 0 (easy) .. 1 (rocket) — how hard the incoming ball is to handle. */
  difficulty: number;
  /** Quality of the set this player received (feeds a spike). */
  setQuality: number;
}

export interface RallyState {
  id: string;
  status: 'LOBBY' | 'FORMING' | 'ACTIVE' | 'RESULT';
  teams: Record<Team, RallyPlayer[]>;
  score: Record<Team, number>;
  servingTeam: Team;
  /** Times each team has won the serve; the server rotates with it. */
  serveTurns: Record<Team, number>;
  phase: 'SERVE' | 'TOUCH' | 'POINT' | null;
  pending: RallyPending | null;
  /** When the Worker next acts on its own (point pause over, CPU move, or a human's time running out). */
  wakeAt: number | null;
  lastEvent: RallyEvent | null;
  lastPoint: { seq: number; team: Team; reason: PointReason } | null;
  seq: number;
  winner: Team | null;
  endReason: 'complete' | 'forfeit' | null;
  updatedAt: number;
  finishedAt: number | null;
}

export type RallyError = { error: string };
const fail = (error: string): RallyError => ({ error });
export const isRallyError = (v: unknown): v is RallyError => !!v && typeof (v as RallyError).error === 'string';
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function createRally(now: number, seq = 0): RallyState {
  return {
    id: '', status: 'LOBBY', teams: { A: [], B: [] }, score: { A: 0, B: 0 }, servingTeam: 'A', serveTurns: { A: 1, B: 0 },
    phase: null, pending: null, wakeAt: null, lastEvent: null, lastPoint: null, seq, winner: null, endReason: null,
    updatedAt: now, finishedAt: null,
  };
}

export const teamOf = (s: RallyState, userId: string): Team | null =>
  TEAMS.find((t) => s.teams[t].some((p) => p.userId === userId && !p.bot)) ?? null;
export const inRally = (s: RallyState, userId: string) => teamOf(s, userId) !== null;
const humans = (s: RallyState, t: Team) => s.teams[t].filter((p) => !p.bot);
/** Court is in use by the rally (blocks the serve challenge). */
export const rallyBusy = (s: RallyState) => s.status === 'ACTIVE';
export const serverOf = (s: RallyState) => {
  const slot = (s.serveTurns[s.servingTeam] - 1) % RALLY_RULES.TEAM_SIZE;
  return { team: s.servingTeam, slot, player: s.teams[s.servingTeam][slot] };
};

// ── Lobby ───────────────────────────────────────────────────────────────────────────────────
export function joinTeam(s: RallyState, player: RallyPlayer, team: Team, id: string, now: number): RallyState | RallyError {
  if (team !== 'A' && team !== 'B') return fail('Pick Team A or Team B.');
  if (s.status === 'ACTIVE') return fail('A rally match is being played. Join the next one.');
  let base = s;
  if (s.status === 'RESULT') base = createRally(now, s.seq);
  const current = teamOf(base, player.userId);
  if (current === team) return fail(`You are already on Team ${team}.`);
  if (base.teams[team].length >= RALLY_RULES.TEAM_SIZE) return fail(`Team ${team} is full.`);
  const teams = { A: base.teams.A.filter((p) => p.userId !== player.userId), B: base.teams.B.filter((p) => p.userId !== player.userId) };
  teams[team] = [...teams[team], { userId: player.userId, connectionId: player.connectionId, name: player.name }];
  const next: RallyState = { ...base, id: base.id || id, status: 'FORMING', teams, updatedAt: now };
  return teams.A.length === RALLY_RULES.TEAM_SIZE && teams.B.length === RALLY_RULES.TEAM_SIZE ? startRally(next, now) : next;
}

function startRally(s: RallyState, now: number): RallyState {
  return beginServe({ ...s, status: 'ACTIVE', score: { A: 0, B: 0 }, servingTeam: 'A', serveTurns: { A: 1, B: 0 }, winner: null, endReason: null, finishedAt: null, lastPoint: null }, now);
}

function beginServe(s: RallyState, now: number): RallyState {
  const { team, slot, player } = serverOf(s);
  return {
    ...s, phase: 'SERVE', pending: { userId: player.userId, team, slot, touch: 0, difficulty: 0, setQuality: 0 },
    wakeAt: now + (player.bot ? RALLY_RULES.BOT_SERVE_MS : RALLY_RULES.SERVE_MS), updatedAt: now,
  };
}

/** Walk away / disconnect. Before kick-off the slot frees; mid-match a CPU takes over; a team with no humans forfeits. */
export function leaveRally(s: RallyState, userId: string, now: number): RallyState | null {
  const team = teamOf(s, userId);
  if (!team) return null;
  if (s.status === 'FORMING' || s.status === 'RESULT') {
    const teams = { A: s.teams.A.filter((p) => p.userId !== userId), B: s.teams.B.filter((p) => p.userId !== userId) };
    const left = { ...s, teams, updatedAt: now };
    return humans(left, 'A').length + humans(left, 'B').length ? left : createRally(now, s.seq);
  }
  if (s.status !== 'ACTIVE') return null;
  const slot = s.teams[team].findIndex((p) => p.userId === userId);
  const teams = { ...s.teams, [team]: s.teams[team].map((p, i) => (i === slot ? { userId: `cpu-${team}${slot}`, connectionId: '', name: 'CPU', bot: true } : p)) };
  let next: RallyState = { ...s, teams, updatedAt: now };
  if (!humans(next, team).length) {
    if (!humans(next, other(team)).length) return createRally(now, s.seq);
    return finish(next, other(team), 'forfeit', now);
  }
  // The leaver owed the next move: the CPU makes it shortly.
  if (s.pending?.userId === userId) {
    const bot = teams[team][slot];
    next = { ...next, pending: { ...s.pending, userId: bot.userId }, wakeAt: s.phase === 'POINT' ? s.wakeAt : now + RALLY_RULES.BOT_DELAY_MS };
  }
  return next;
}

/** Play again with the same teams (CPU stand-ins drop out; humans stay). */
export function rallyAgain(s: RallyState, userId: string, id: string, now: number): RallyState | RallyError {
  if (s.status !== 'RESULT' || !inRally(s, userId)) return fail('No finished match to replay.');
  const teams = { A: humans(s, 'A'), B: humans(s, 'B') };
  const next: RallyState = { ...createRally(now, s.seq), id, status: 'FORMING', teams };
  return teams.A.length === RALLY_RULES.TEAM_SIZE && teams.B.length === RALLY_RULES.TEAM_SIZE ? startRally(next, now) : next;
}

function finish(s: RallyState, winner: Team, endReason: 'complete' | 'forfeit', now: number): RallyState {
  return { ...s, status: 'RESULT', phase: null, pending: null, wakeAt: now + RALLY_RULES.RESULT_HOLD_MS, winner, endReason, finishedAt: now, updatedAt: now };
}

// ── Rally ───────────────────────────────────────────────────────────────────────────────────
const event = (s: RallyState, e: Omit<RallyEvent, 'seq'>): RallyEvent => ({ ...e, seq: s.seq + 1 });
const touchHeight = (touch: number, action: RallyAction) => (action === 'attack' && touch === 3 ? 2.9 : touch === 1 ? 0.9 : 2.3);

function point(s: RallyState, team: Team, reason: PointReason, ev: RallyEvent, now: number): RallyState {
  const score = { ...s.score, [team]: s.score[team] + 1 };
  const sideOut = team !== s.servingTeam;
  const next: RallyState = {
    ...s, score, servingTeam: team, serveTurns: sideOut ? { ...s.serveTurns, [team]: s.serveTurns[team] + 1 } : s.serveTurns,
    lastEvent: ev, seq: ev.seq, lastPoint: { seq: ev.seq, team, reason }, updatedAt: now,
  };
  const a = score[team], b = score[other(team)];
  if ((a >= RALLY_RULES.POINTS_TO_WIN && a - b >= RALLY_RULES.WIN_BY) || a >= RALLY_RULES.POINT_CAP) return finish(next, team, 'complete', now);
  return { ...next, phase: 'POINT', pending: null, wakeAt: now + ev.flightMs + RALLY_RULES.POINT_PAUSE_MS };
}

/** Who gets the point credited, and why, when `team` fails to play the ball that just arrived. */
const missReason = (s: RallyState): PointReason =>
  s.lastEvent?.kind === 'serve' ? 'ace' : s.lastEvent?.label === 'SPIKE!' ? 'kill' : 'error';

/** Ball is now on `team`'s side for touch `touch`, coming to `slot`. */
function awaitTouch(s: RallyState, ev: RallyEvent, team: Team, slot: number, touch: number, difficulty: number, setQuality: number, now: number): RallyState {
  const player = s.teams[team][slot];
  return {
    ...s, phase: 'TOUCH', lastEvent: ev, seq: ev.seq, updatedAt: now,
    pending: { userId: player.userId, team, slot, touch, difficulty: Number(difficulty.toFixed(3)), setQuality: Number(setQuality.toFixed(3)) },
    wakeAt: now + ev.flightMs + (player.bot ? RALLY_RULES.BOT_DELAY_MS : RALLY_RULES.TOUCH_WINDOW_MS),
  };
}

const validServe = (i: any) => !!i && Number.isFinite(i.aim) && Number.isFinite(i.power) && i.aim >= -1 && i.aim <= 1 && i.power >= 0 && i.power <= 1;
const validTouch = (i: any) => !!i && (i.action === 'pass' || i.action === 'attack') && Number.isFinite(i.timing) && i.timing >= 0 && i.timing <= 1;

/** Three rng draws in order: side noise, depth noise, difficulty jitter (the receiver is whoever is nearest the landing). */
function doServe(s: RallyState, input: { aim: number; power: number }, rng: () => number, now: number): RallyState {
  const { team, slot, player } = serverOf(s);
  const aim = clamp(input.aim, -1, 1), power = clamp(input.power, 0, 1);
  // Same feel as the serve challenge: the meter band is the same.
  const side = aim * 4.4 + (rng() * 2 - 1) * 0.45;
  const depth = (power - 0.22) * 13 + (rng() * 2 - 1) * 0.7;
  const jitter = rng();
  const dir = team === 'A' ? 1 : -1; // server's right in world X
  const from: Vec3 = [serveSpot(team, slot)[0], 2.7, serveSpot(team, slot)[2]];
  const base = { team, byUserId: player.userId, byName: player.name, from, at: now };
  if (depth < 0.3) {
    const ev = event(s, { ...base, kind: 'serve', label: 'NET', to: [centre[0] + side * dir * 0.6, 0.11, netZ + sideSign(team) * 0.9], apex: 3.1, flightMs: 1100 });
    return point(s, other(team), 'net', ev, now);
  }
  const land: Vec3 = [centre[0] + side * dir, 0.11, netZ - sideSign(team) * depth];
  if (depth > length / 2 || Math.abs(side) > VOLLEYBALL_COURT.width / 2) {
    return point(s, other(team), 'out', event(s, { ...base, kind: 'serve', label: 'OUT', to: land, apex: 4.2, flightMs: 1100 }), now);
  }
  const recv = other(team);
  const rslot = Math.abs(land[0] - slotX(recv, 0)) <= Math.abs(land[0] - slotX(recv, 1)) ? 0 : 1;
  const difficulty = clamp(0.2 + (Math.abs(side) / 4) * 0.35 + (depth > 6 ? 0.2 : 0) + (power > 0.68 ? 0.1 : 0) + (jitter - 0.5) * 0.1, 0, 0.9);
  const to: Vec3 = [slotSpot(recv, rslot)[0], 0.9, slotSpot(recv, rslot)[2]];
  return awaitTouch(s, event(s, { ...base, kind: 'serve', label: 'SERVE', to, apex: 4.2, flightMs: 1100 }), recv, rslot, 1, difficulty, 0, now);
}

/** Draws in order: success roll, quality / error roll, direction roll, difficulty jitter. */
function doTouch(s: RallyState, input: { action: RallyAction; timing: number }, rng: () => number, now: number): RallyState {
  const p = s.pending!;
  const player = s.teams[p.team][p.slot];
  const at = slotSpot(p.team, p.slot);
  const action: RallyAction = p.touch >= 3 ? 'attack' : input.action;
  const timing = clamp(input.timing, 0, 1);
  const from: Vec3 = [at[0], touchHeight(p.touch, action), at[2]];
  const base = { team: p.team, byUserId: player.userId, byName: player.name, from, at: now };
  const success = clamp(0.3 + timing * 0.75 - p.difficulty * 0.4, 0.05, 0.97);
  const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();
  if (r1 >= success) {
    const ev = event(s, { ...base, kind: 'drop', label: p.touch === 1 ? 'SHANKED' : 'DROPPED', to: [at[0] + (r3 - 0.5) * 3, 0.11, at[2] + sideSign(p.team) * 1.8], apex: 1.6, flightMs: 600 });
    return point(s, other(p.team), missReason(s), ev, now);
  }
  if (action === 'pass') {
    const quality = clamp(timing - p.difficulty * 0.3 + (r2 - 0.5) * 0.2, 0, 1);
    const mate = 1 - p.slot;
    const to: Vec3 = [slotSpot(p.team, mate)[0], 2.3, slotSpot(p.team, mate)[2] - sideSign(p.team) * 1.5];
    const ev = event(s, { ...base, kind: 'pass', label: p.touch === 1 ? 'BUMP' : 'SET', to, apex: 4.6, flightMs: 900 });
    return awaitTouch(s, ev, p.team, mate, p.touch + 1, (1 - quality) * 0.6, quality, now);
  }
  // Attack: a spike after a good set is strong; an early "send over" is a free ball.
  const spike = p.touch === 3;
  const strength = (spike ? 0.55 + p.setQuality * 0.35 : p.touch === 2 ? 0.4 : 0.25) * (0.6 + timing * 0.4);
  const errorChance = spike ? 0.1 + (timing < 0.4 ? 0.2 : 0) : 0.03;
  const recv = other(p.team);
  if (r2 < errorChance) {
    const net = r3 < 0.5;
    const to: Vec3 = net ? [from[0], 0.11, netZ + sideSign(p.team) * 0.8] : [from[0] + (r4 - 0.5) * 6, 0.11, netZ - sideSign(p.team) * (length / 2 + 2.5)];
    const ev = event(s, { ...base, kind: 'attack', label: net ? 'INTO THE NET' : 'LONG!', to, apex: net ? 3 : 4, flightMs: 800 });
    return point(s, recv, net ? 'net' : 'out', ev, now);
  }
  const rslot = r3 < 0.5 ? 0 : 1;
  const to: Vec3 = [slotSpot(recv, rslot)[0], 0.9, slotSpot(recv, rslot)[2]];
  const ev = event(s, { ...base, kind: 'attack', label: spike ? 'SPIKE!' : 'OVER', to, apex: spike ? 3.2 : 4.6, flightMs: spike ? 700 : 1000 });
  return awaitTouch(s, ev, recv, rslot, 1, clamp(strength + (r4 - 0.5) * 0.1, 0, 0.95), 0, now);
}

export function rallyServe(s: RallyState, userId: string, input: unknown, rng: () => number, now: number): RallyState | RallyError {
  if (s.status !== 'ACTIVE' || s.phase !== 'SERVE') return fail('Not time to serve.');
  if (s.pending?.userId !== userId) return fail('It is not your serve.');
  if (!validServe(input)) return fail('Invalid serve.');
  return doServe(s, input as { aim: number; power: number }, rng, now);
}

export function rallyTouch(s: RallyState, userId: string, input: unknown, rng: () => number, now: number): RallyState | RallyError {
  if (s.status !== 'ACTIVE' || s.phase !== 'TOUCH') return fail('The ball is not coming to you.');
  if (s.pending?.userId !== userId) return fail('The ball is not coming to you.');
  if (!validTouch(input)) return fail('Invalid touch.');
  if (s.wakeAt !== null && now > s.wakeAt) return fail('Too late — the ball dropped.');
  return doTouch(s, input as { action: RallyAction; timing: number }, rng, now);
}

/** The Worker's clock: point pause over, CPU moves, a human out of time, a result clearing. */
export function rallyTick(s: RallyState, now: number, rng: () => number): RallyState | null {
  if (s.wakeAt === null || now < s.wakeAt) return null;
  if (s.status === 'RESULT') return createRally(now, s.seq);
  if (s.status !== 'ACTIVE' || (!s.pending && s.phase !== 'POINT')) return null;
  if (s.phase === 'POINT') return beginServe(s, now);
  const p = s.pending!;
  const player = s.teams[p.team][p.slot];
  if (s.phase === 'SERVE') {
    if (player.bot) return doServe(s, { aim: (rng() * 2 - 1) * 0.4, power: 0.5 + rng() * 0.12 }, rng, now);
    const at = serveSpot(p.team, p.slot);
    const ev = event(s, { kind: 'drop', team: p.team, byUserId: player.userId, byName: player.name, label: 'SERVE CLOCK', from: [at[0], 1, at[2]], to: [at[0], 0.11, at[2]], apex: 1.2, flightMs: 400, at: now });
    return point(s, other(p.team), 'timeout', ev, now);
  }
  if (player.bot) return doTouch(s, { action: p.touch >= 3 ? 'attack' : 'pass', timing: 0.65 }, rng, now);
  const at = slotSpot(p.team, p.slot);
  const ev = event(s, { kind: 'drop', team: p.team, byUserId: player.userId, byName: player.name, label: 'TOO SLOW', from: s.lastEvent?.to ?? [at[0], 1, at[2]], to: [at[0], 0.11, at[2]], apex: 1, flightMs: 400, at: now });
  return point(s, other(p.team), missReason(s) === 'error' ? 'drop' : missReason(s), ev, now);
}

/** Client timing from the bar: 1 when tapped as the ball arrives, falling off either side. */
export const timingAt = (u: number) => Number(clamp(1 - Math.abs(u - RALLY_RULES.BAR_SWEET) * 2.4, 0, 1).toFixed(3));
