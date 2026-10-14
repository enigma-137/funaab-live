// 2v2 volleyball rally: lobby, serve, touches, scoring, rotation, CPU stand-ins, clock, Worker authority.
import assert from 'node:assert/strict';
import {
  RALLY_RULES, createRally, inRally, isRallyError, joinTeam, leaveRally, rallyAgain, rallyServe, rallyTick, rallyTouch,
  serveSpot, serverOf, slotSpot, teamOf, timingAt, type RallyState,
} from '../src/config/volleyRally';
import { VOLLEYBALL_COURT } from '../src/config/volleyball';
import { classifyTerrain } from '../src/game/rules/lawnSecuritySystem';
import { WorldRoomDO } from '../worker/index';

const ok = (v: RallyState | { error: string } | null): RallyState => { assert(v && !isRallyError(v), isRallyError(v) ? v.error : 'null'); return v as RallyState; };
const always = (n: number) => () => n;
const P = (id: string) => ({ userId: id, connectionId: `c-${id}`, name: id.toUpperCase() });
const [a1, a2, b1, b2, x] = ['a1', 'a2', 'b1', 'b2', 'x'].map(P);
const GOOD_SERVE = { aim: 0, power: 0.55 };
const PERFECT = 1;

// ── Lobby ──
let s = createRally(0);
s = ok(joinTeam(s, a1, 'A', 'm1', 1));
assert.equal(s.status, 'FORMING');
assert(isRallyError(joinTeam(s, a1, 'A', 'm1', 2)), 'already on A');
s = ok(joinTeam(s, a1, 'B', 'm1', 2)); // switch sides
assert.equal(teamOf(s, 'a1'), 'B');
s = ok(joinTeam(s, a1, 'A', 'm1', 3));
s = ok(joinTeam(s, a2, 'A', 'm1', 4));
assert(isRallyError(joinTeam(s, x, 'A', 'm1', 5)), 'team of two is full');
s = ok(joinTeam(s, b1, 'B', 'm1', 5));
assert.equal(s.status, 'FORMING');
assert.equal(ok(leaveRally(s, 'b1', 6)).teams.B.length, 0, 'leaving before kick-off frees the slot');
s = ok(joinTeam(s, b2, 'B', 'm1', 7));
assert.equal(s.status, 'ACTIVE', 'starts the moment it is 2v2');
assert.equal(s.phase, 'SERVE');
assert.equal(s.pending?.userId, 'a1', 'Team A, first player serves first');
assert(isRallyError(joinTeam(s, x, 'B', 'm1', 8)), 'no joining mid-match');

// ── Serve validation & authority ──
assert(isRallyError(rallyServe(s, 'a2', GOOD_SERVE, always(0.5), 10)), 'only the server serves');
assert(isRallyError(rallyServe(s, 'a1', { aim: 2, power: 0.5 }, always(0.5), 10)), 'invalid serve');
assert(isRallyError(rallyTouch(s, 'a1', { action: 'pass', timing: 1 }, always(0.5), 10)), 'cannot touch while serving');

// Netted serve: point B, side-out, B's first player serves next after the pause.
let t = ok(rallyServe(s, 'a1', { aim: 0, power: 0.1 }, always(0.5), 10));
assert.equal(t.phase, 'POINT');
assert.deepEqual(t.score, { A: 0, B: 1 });
assert.equal(t.lastPoint?.reason, 'net');
assert.equal(rallyTick(t, t.wakeAt! - 1, always(0.5)), null, 'pause holds');
t = ok(rallyTick(t, t.wakeAt!, always(0.5)));
assert.equal(t.phase, 'SERVE');
assert.equal(serverOf(t).player.userId, 'b1');

// ── A full rally: serve → bump → set → spike → kill ──
let r = ok(rallyServe(s, 'a1', GOOD_SERVE, always(0.5), 20));
assert.equal(r.phase, 'TOUCH');
assert.equal(r.pending?.team, 'B');
assert.equal(r.pending?.touch, 1);
const receiver = r.pending!.userId;
assert(['b1', 'b2'].includes(receiver));
assert(isRallyError(rallyTouch(r, receiver === 'b1' ? 'b2' : 'b1', { action: 'pass', timing: 1 }, always(0.1), 21)), 'only the player the ball comes to');
assert(isRallyError(rallyTouch(r, receiver, { action: 'dunk', timing: 1 }, always(0.1), 21)), 'invalid action');
r = ok(rallyTouch(r, receiver, { action: 'pass', timing: PERFECT }, always(0.1), 22)); // r1 0.1: success
assert.equal(r.lastEvent?.label, 'BUMP');
assert.equal(r.pending?.touch, 2);
assert.notEqual(r.pending?.userId, receiver, 'the pass goes to the teammate');
r = ok(rallyTouch(r, r.pending!.userId, { action: 'pass', timing: PERFECT }, always(0.5), 23));
assert.equal(r.lastEvent?.label, 'SET');
assert.equal(r.pending?.touch, 3);
assert.equal(r.pending?.userId, receiver, 'set back to the first player');
const setQ = r.pending!.setQuality;
// Third touch is always an attack, even if the client asks to pass.
r = ok(rallyTouch(r, receiver, { action: 'pass', timing: PERFECT }, () => 0.5, 24));
assert.equal(r.lastEvent?.label, 'SPIKE!');
assert.equal(r.pending?.team, 'A');
assert(r.pending!.difficulty > 0.6, `a spike off a good set (${setQ}) is hard to dig`);
// Team A can't dig it (success roll fails) → kill for B.
const spiked = r;
r = ok(rallyTouch(r, r.pending!.userId, { action: 'pass', timing: 0 }, always(0.99), 25));
assert.deepEqual(r.score, { A: 0, B: 1 });
assert.equal(r.lastPoint?.reason, 'kill');
// Too late is refused (the clock then drops it).
assert(isRallyError(rallyTouch(spiked, spiked.pending!.userId, { action: 'pass', timing: 1 }, always(0.1), spiked.wakeAt! + 1)));
const dropped = ok(rallyTick(spiked, spiked.wakeAt!, always(0.5)));
assert.equal(dropped.lastPoint?.team, 'B');
assert.equal(dropped.lastPoint?.reason, 'kill');
// Serve clock: a human who never serves gives the point away.
const idle = ok(rallyTick(s, s.wakeAt!, always(0.5)));
assert.equal(idle.lastPoint?.reason, 'timeout');
assert.equal(idle.lastPoint?.team, 'B');

// ── Scoring: first to 11, win by 2, cap 15; serve rotates on side-out ──
let g = s;
const winPoint = (st: RallyState, team: 'A' | 'B') => {
  // The serving team either aces (server = team) or nets (server = other team).
  if (st.phase === 'POINT') st = ok(rallyTick(st, st.wakeAt!, always(0.5)));
  const srv = serverOf(st);
  if (srv.team === team) {
    st = ok(rallyServe(st, srv.player.userId, { aim: 0.8, power: 0.62 }, always(0.5), st.updatedAt + 1));
    return ok(rallyTick(st, st.wakeAt!, always(0.5))); // receiver never touches → ace
  }
  return ok(rallyServe(st, srv.player.userId, { aim: 0, power: 0.05 }, always(0.5), st.updatedAt + 1));
};
const servers: string[] = [];
for (const team of ['B', 'A', 'B', 'A'] as const) { g = winPoint(g, team); servers.push(g.lastEvent!.byUserId!); }
assert.deepEqual(servers, ['a1', 'b1', 'a2', 'b2'], 'serve rotates through each team on side-out');
for (let i = 0; i < 9; i++) g = winPoint(g, 'A');
assert.deepEqual(g.score, { A: 11, B: 2 });
assert.equal(g.status, 'RESULT');
assert.equal(g.winner, 'A');
let deuce = s;
for (let i = 0; i < 10; i++) { deuce = winPoint(deuce, 'A'); deuce = winPoint(deuce, 'B'); }
deuce = winPoint(deuce, 'A');
assert.equal(deuce.status, 'ACTIVE', '11–10 is not enough');
for (let i = 0; i < 3; i++) { deuce = winPoint(deuce, 'B'); deuce = winPoint(deuce, 'A'); }
assert.deepEqual(deuce.score, { A: 14, B: 13 });
deuce = winPoint(deuce, 'B');
deuce = winPoint(deuce, 'A');
assert.equal(deuce.status, 'RESULT', 'capped at 15');
assert.equal(deuce.winner, 'A');

// ── CPU stand-ins & forfeit ──
let c = ok(leaveRally(s, 'a1', 30));
assert.equal(c.status, 'ACTIVE');
assert(c.teams.A[0].bot, 'a CPU takes the slot');
assert.equal(c.pending?.userId, 'cpu-A0', 'and the serve');
assert(!inRally(c, 'a1'));
c = ok(rallyTick(c, c.wakeAt!, always(0.5))); // CPU serves
assert.equal(c.lastEvent?.kind, 'serve');
const f = ok(leaveRally(c, 'a2', 31));
assert.equal(f.status, 'RESULT');
assert.equal(f.endReason, 'forfeit');
assert.equal(f.winner, 'B');
// Play again: humans keep their teams; the empty slots reopen.
const again = ok(rallyAgain(f, 'b1', 'm2', 40));
assert.equal(again.status, 'FORMING');
assert.deepEqual(again.teams.B.map((p) => p.userId), ['b1', 'b2']);
assert.equal(again.teams.A.length, 0);
// Result clears itself.
assert.equal(ok(rallyTick(f, f.wakeAt!, always(0.5))).status, 'LOBBY');

// CPU rally: four CPUs never get stuck (only reachable via tick); run 400 ticks of CPU vs one human who always times out.
let cpu = ok(leaveRally(ok(leaveRally(s, 'a1', 1)), 'b1', 1));
for (let i = 0; i < 400 && cpu.status === 'ACTIVE'; i++) {
  const p = cpu.pending;
  if (p && !cpu.teams[p.team][p.slot].bot && cpu.phase === 'TOUCH') cpu = ok(rallyTouch(cpu, p.userId, { action: 'pass', timing: 0.7 }, Math.random, cpu.updatedAt + 1));
  else if (p && !cpu.teams[p.team][p.slot].bot && cpu.phase === 'SERVE') cpu = ok(rallyServe(cpu, p.userId, GOOD_SERVE, Math.random, cpu.updatedAt + 1));
  else cpu = ok(rallyTick(cpu, cpu.wakeAt!, Math.random));
}
assert.equal(cpu.status, 'RESULT', 'a match with CPU stand-ins runs to a result');

// ── Timing bar & court ──
assert.equal(timingAt(RALLY_RULES.BAR_SWEET), 1);
assert(timingAt(0) === 0 && timingAt(1) < 0.4);
for (const team of ['A', 'B'] as const) for (const slot of [0, 1]) {
  for (const spot of [slotSpot(team, slot), serveSpot(team, slot)])
    assert.equal(classifyTerrain(spot[0], spot[2]).restricted, false, `${team}${slot} spot is walkable`);
  assert.equal(Math.sign(slotSpot(team, slot)[2] - VOLLEYBALL_COURT.netZ), team === 'A' ? 1 : -1, 'teams on opposite sides');
}

// ── Worker ──
class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(m: string) { this.messages.push(JSON.parse(m)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }
async function worker() {
  const oldWS = globalThis.WebSocket, oldInterval = globalThis.setInterval, oldNow = Date.now, oldRandom = Math.random, oldTimeout = globalThis.setTimeout;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  // Capture the Worker's timers so the rally clock can be driven by hand.
  const timers: Function[] = [];
  (globalThis as any).setTimeout = (fn: Function) => { timers.push(fn); return timers.length; };
  (globalThis as any).clearTimeout = () => {};
  let now = oldNow(); Date.now = () => now;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true' } as any);
    const near = [VOLLEYBALL_COURT.centre[0] + 3, 0, VOLLEYBALL_COURT.centre[2] + 9];
    const join = async (id: string, username: string, position: number[]) => {
      const socket = new Socket(); await w.handleSession(socket, null, 'world:funaab:main');
      await socket.packet({ type: 'join', player: { id, username, position } });
      const session = w.sessions.get(socket);
      session.trustedPosition = position; session.claimedPosition = position; session.movementClock = now;
      return socket;
    };
    const ids = ['a1', 'a2', 'b1', 'b2'].map((k, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);
    const [sa1, sa2, sb1, sb2] = await Promise.all(['Ade', 'Ayo', 'Bisi', 'Bola'].map((n, i) => join(ids[i], n, near)));
    const far = await join('00000000-0000-4000-8000-000000000009', 'Far', [20, 0, 12]);
    assert.equal(sa1.messages.find((m) => m.type === 'snapshot').rally.status, 'LOBBY', 'snapshot carries the rally');
    const call = async (socket: Socket, payload: object, type = 'volleyball_rally') => { now += 50; await socket.packet({ type, requestId: crypto.randomUUID(), ...payload }); return socket.messages.filter((m) => m.type === 'action_result').at(-1); };
    const last = (socket: Socket) => socket.messages.filter((m) => m.type === 'volleyball_rally_state').at(-1)?.rally as RallyState;

    assert.match((await call(far, { op: 'join', team: 'A' })).error, /Walk over/);
    assert.match((await call(sa1, { op: 'join', team: 'C' })).error, /Team A or Team B/);
    await call(sa1, { op: 'join', team: 'A' });
    await call(sa2, { op: 'join', team: 'A' });
    await call(sb1, { op: 'join', team: 'B' });
    assert.equal(last(far).status, 'FORMING', 'everyone sees the lobby');
    const started = await call(sb2, { op: 'join', team: 'B' });
    assert.equal(started.result.status, 'ACTIVE');
    assert.deepEqual(last(sa1), last(sb2));
    // The serve challenge waits while the rally is on.
    const onLine = await join('00000000-0000-4000-8000-000000000008', 'Server', [...VOLLEYBALL_COURT.serveSpot]);
    assert.match((await call(onLine, { op: 'practice', aim: 0, power: 0.5 }, 'volleyball')).error, /2v2 rally is on the court/);
    // Only the server serves; the Worker rolls; forged fields go nowhere.
    assert.match((await call(sb1, { op: 'serve', aim: 0, power: 0.55 })).error, /not your serve/);
    Math.random = () => 0.5;
    const served = await call(sa1, { op: 'serve', aim: 0, power: 0.55, score: { A: 99 }, outcome: 'ACE' });
    assert.equal(served.error, undefined, served.error);
    assert.deepEqual(served.result.score, { A: 0, B: 0 });
    assert.equal(served.result.phase, 'TOUCH');
    const receiverSocket = served.result.pending.userId === ids[2] ? sb1 : sb2;
    // A second tab of the same student can't play for them.
    const tab = new Socket(); await w.handleSession(tab, null, 'world:funaab:main');
    await tab.packet({ type: 'join', player: { id: served.result.pending.userId, username: 'Tab', position: near } });
    assert.match((await call(tab, { op: 'touch', action: 'pass', timing: 1 })).error, /device you joined with/);
    Math.random = () => 0.1;
    const bump = await call(receiverSocket, { op: 'touch', action: 'pass', timing: 1 });
    assert.equal(bump.result.lastEvent.label, 'BUMP');
    // Nobody plays the set → the Worker's clock drops it: point Team A.
    now = bump.result.wakeAt + 1;
    timers.at(-1)!();
    assert.deepEqual(last(far).score, { A: 1, B: 0 });
    assert.equal(last(far).phase, 'POINT');
    // A player walks off → CPU takes the slot; the match goes on.
    sb1.close();
    const after = last(far);
    assert.equal(after.status, 'ACTIVE');
    assert(after.teams.B.some((p) => p.bot), 'CPU stand-in');
    // Their teammate leaves too → Team A wins by forfeit.
    assert.equal((await call(sb2, { op: 'leave' })).result.status, 'RESULT');
    assert.equal(last(sa1).winner, 'A');
    assert.equal(last(sa1).endReason, 'forfeit');
  } finally {
    (globalThis as any).WebSocket = oldWS; globalThis.setInterval = oldInterval; Date.now = oldNow; Math.random = oldRandom; globalThis.setTimeout = oldTimeout;
  }
}
worker().then(() => { console.log('VOLLEY RALLY PASSED: lobby, serve, bump/set/spike, scoring, rotation, deuce + cap, CPU stand-ins, forfeit, clock, Worker authority.'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
