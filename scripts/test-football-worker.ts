// Football Worker tests: server-owned turns/results, proximity, validation, shared broadcast, forfeit.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { FOOTBALL_PITCH } from '../src/config/football';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldInterval = globalThis.setInterval, oldNow = Date.now, oldRandom = Math.random;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  let now = oldNow(); Date.now = () => now;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true' } as any);
    const join = async (id: string, username: string, position: number[]) => {
      const socket = new Socket(); await w.handleSession(socket, null, 'world:funaab:main');
      await socket.packet({ type: 'join', player: { id, username, position } });
      const session = w.sessions.get(socket);
      // Pretend they walked here legally.
      session.trustedPosition = position; session.claimedPosition = position; session.movementClock = now;
      return socket;
    };
    const spot = [...FOOTBALL_PITCH.shooterSpot];
    const james = await join('00000000-0000-4000-8000-0000000000a1', 'James', spot);
    const sarah = await join('00000000-0000-4000-8000-0000000000b2', 'Sarah', [spot[0] + 1.9, 0, spot[2] + 0.7]);
    const far = await join('00000000-0000-4000-8000-0000000000c3', 'Far', [20, 0, 12]);
    const tobi = await join('00000000-0000-4000-8000-0000000000e5', 'Tobi', [spot[0] - 1.5, 0, spot[2] + 1]);
    assert.equal(james.messages.find((m) => m.type === 'snapshot').football.status, 'LOBBY', 'snapshot carries the pitch');

    const call = async (socket: Socket, payload: object) => { now += 100; await socket.packet({ type: 'football', requestId: crypto.randomUUID(), ...payload }); return socket.messages.filter((m) => m.type === 'action_result').at(-1); };
    const lastState = (socket: Socket) => socket.messages.filter((m) => m.type === 'football_state').at(-1)?.football;

    // Proximity: the button only works at the penalty spot.
    assert.match((await call(far, { op: 'practice', aim: 0, power: 0.5 })).error, /penalty spot/);
    assert.match((await call(far, { op: 'create' })).error, /penalty spot/);

    // Practice: shared with everyone in the campus room (spectators see the ball), never scored.
    Math.random = () => 0.5;
    const practice = await call(james, { op: 'practice', aim: 0.2, power: 0.5 });
    assert.equal(practice.error, undefined);
    assert.equal(practice.result.lastShot.practice, true);
    assert.equal(lastState(far).lastShot.seq, practice.result.lastShot.seq, 'far-away students still see the shot');
    assert.match((await call(james, { op: 'practice', aim: 0.2, power: 0.5 })).error, /ball to come back/, 'practice cooldown');
    for (const bad of [{ aim: 2, power: 0.5 }, { aim: 0, power: 'max' }, { aim: 0 }, {}]) {
      now += 3000;
      assert.match((await call(james, { op: 'practice', ...bad })).error, /Invalid shot/, `rejects ${JSON.stringify(bad)}`);
    }

    // Create + join.
    const created = await call(james, { op: 'create' });
    assert.equal(created.result.status, 'WAITING');
    assert.equal(lastState(sarah).player1.name, 'James', 'open challenge is visible to others');
    const joined = await call(sarah, { op: 'join', matchId: created.result.id });
    assert.equal(joined.result.status, 'ACTIVE');
    const shared = lastState(james);
    assert.deepEqual(shared, lastState(sarah), 'both players hold the same match state');
    assert.deepEqual(shared, lastState(far), 'spectators get the score too');
    assert.equal(shared.turnUserId, '00000000-0000-4000-8000-0000000000a1', 'James shoots first');

    // Turn + payload authority.
    assert.match((await call(sarah, { op: 'shoot', aim: 0, power: 0.5 })).error, /turn/);
    assert.match((await call(tobi, { op: 'shoot', aim: 0, power: 0.5 })).error, /not in this match/);
    assert.match((await call(tobi, { op: 'practice', aim: 0, power: 0.5 })).error, /match is being played/);
    assert.match((await call(tobi, { op: 'create' })).error, /match is being played/);
    const forged = await call(james, { op: 'shoot', aim: 0.6, power: 0.6, outcome: 'GOAL', goal: true, score: { x: 9 } });
    // The Worker rolled: with Math.random = 0.5 the keeper stays central and a 0.6/0.6 shot beats him.
    assert.equal(forged.result.lastShot.outcome, 'GOAL');
    assert(!('goal' in forged.result.lastShot) && !('x' in forged.result.score), 'client fields never reach the state');
    Math.random = () => 0.99; // keeper dives right; save roll fails
    // Alternate to the end: Sarah, James, Sarah, James, Sarah.
    const shooters = [sarah, james, sarah, james, sarah];
    const aims = [-1, 0.6, -1, -1, 0.6]; // aim -1 clips the post: Sarah scores once, James twice in total
    for (let i = 0; i < shooters.length; i++) {
      const res = await call(shooters[i], { op: 'shoot', aim: aims[i], power: 0.6 });
      assert.equal(res.error, undefined, res.error);
    }
    const final = lastState(far);
    assert.equal(final.status, 'RESULT');
    assert.equal(final.score['00000000-0000-4000-8000-0000000000a1'], 2);
    assert.equal(final.score['00000000-0000-4000-8000-0000000000b2'], 1);
    assert.equal(final.winnerUserId, '00000000-0000-4000-8000-0000000000a1');
    assert.deepEqual(lastState(james), lastState(sarah), 'both see the final whistle');

    // Rematch: both vote → new match, Sarah first.
    await call(james, { op: 'rematch' });
    const again = await call(sarah, { op: 'rematch' });
    assert.equal(again.result.status, 'ACTIVE');
    assert.notEqual(again.result.id, final.id);
    assert.equal(again.result.turnUserId, '00000000-0000-4000-8000-0000000000b2');

    // Disconnect mid-match: opponent wins by forfeit, everyone is told.
    sarah.close();
    const forfeit = lastState(far);
    assert.equal(forfeit.status, 'RESULT');
    assert.equal(forfeit.endReason, 'forfeit');
    assert.equal(forfeit.winnerUserId, '00000000-0000-4000-8000-0000000000a1');
    const left = await call(james, { op: 'leave' });
    assert.equal(left.result.status, 'LOBBY', 'the pitch frees up once the remaining player leaves');

    // A non-campus room never reaches the pitch.
    const lib = new Socket(); await w.handleSession(lib, null, 'world:funaab:library');
    await lib.packet({ type: 'join', room: 'world:funaab:library', player: { id: '00000000-0000-4000-8000-0000000000d4', username: 'Reader', position: [0, 0, 0] } });
    if (lib.readyState === 1) {
      await lib.packet({ type: 'football', requestId: 'r', op: 'state' });
      assert.match(lib.messages.at(-1).error, /Sports Centre/);
    }
    console.log('football worker: all checks passed');
  } finally {
    (globalThis as any).WebSocket = oldWS; globalThis.setInterval = oldInterval; Date.now = oldNow; Math.random = oldRandom;
  }
}
// exit explicitly: the DO's pending turn-clock timer would otherwise keep node alive.
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
