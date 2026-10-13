// Today's Plan Worker events: trusted positions only, deduped per day, right goal per action.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { FOOTBALL_PITCH } from '../src/config/football';
import { LOVE_GARDEN, loveGardenBenches } from '../src/config/loveGarden';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldFetch = globalThis.fetch, oldInterval = globalThis.setInterval, oldNow = Date.now;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  // 14:00 Lagos (13:00 UTC) on a fixed day.
  let now = Date.UTC(2026, 9, 14, 13, 0, 0); Date.now = () => now;
  const events: Array<{ user: string; kind: string }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const name = String(url).split('/').at(-1)!, body = JSON.parse(init.body);
    if (name === 'daily_goal_event_trusted') events.push({ user: body.p_user, kind: body.p_kind });
    if (name === 'hostel_can_enter') return new Response('true');
    return new Response(JSON.stringify(1));
  }) as any;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  try {
    const env = { ENABLE_GUEST_MODE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', SUPABASE_URL: 'https://plan.invalid' } as any;
    const w: any = new WorldRoomDO({ storage } as any, env);
    const join = async (id: string, name: string, position: number[], room = 'world:funaab:main', target = w) => {
      const socket = new Socket(); await target.handleSession(socket, null, room);
      await socket.packet({ type: 'join', room, player: { id, username: name, position } });
      const session = target.sessions.get(socket);
      if (session) { session.trustedPosition = position; session.claimedPosition = position; session.movementClock = now; }
      return socket;
    };
    const kinds = (user: string) => events.filter((e) => e.user === user).map((e) => e.kind);
    const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2';

    // Penalties: each accepted shot reports once, up to the goal's target (3).
    const ada = await join(A, 'Ada', [...FOOTBALL_PITCH.shooterSpot]);
    for (let i = 0; i < 5; i++) { now += 3000; await ada.packet({ type: 'football', requestId: `r${i}`, op: 'practice', aim: 0.2, power: 0.5 }); }
    await ada.packet({ type: 'football', requestId: 'bad', op: 'practice', aim: 9, power: 0.5 });
    await flush();
    assert.deepEqual(kinds(A), ['take_penalties', 'take_penalties', 'take_penalties'], 'three reports, rejected shots never count');
    assert(ada.messages.some((m) => m.type === 'daily_plan_refresh'), 'the client is told to refresh its plan');

    // Spoofed position: claiming to be in the garden from across campus doesn't count.
    events.length = 0;
    const [gx, , gz] = LOVE_GARDEN.centre;
    await ada.packet({ type: 'move', position: [gx, 0, gz], rotation: 0, animation: 'idle' });
    await flush();
    assert.deepEqual(kinds(A), [], 'a teleport claim is speed-limited, so it is not in the garden yet');
    // Walk there for real (time passes at legal speed).
    now += 10000;
    await ada.packet({ type: 'move', position: [gx + 3, 0, gz], rotation: 0, animation: 'idle' });
    await ada.packet({ type: 'move', position: [gx + 3, 0, gz + 0.5], rotation: 0, animation: 'idle' });
    await flush();
    assert.deepEqual(kinds(A), ['visit_love_garden'], 'visit counted once, not campus night at 14:00');

    // Sitting alone isn't a hangout; with another seated student it is — for both.
    const seat0 = loveGardenBenches[0].seats[0], seat1 = loveGardenBenches[0].seats[1];
    await ada.packet({ type: 'move', position: seat0, rotation: 0, animation: 'sit' });
    await flush();
    assert(!kinds(A).includes('garden_hangout'));
    const bisi = await join(B, 'Bisi', [seat1[0], 0, seat1[2]]);
    await bisi.packet({ type: 'move', position: seat1, rotation: 0, animation: 'sit' });
    await ada.packet({ type: 'move', position: [seat0[0], 0, seat0[2] + 0.01], rotation: 0.1, animation: 'sit' });
    await flush();
    assert(kinds(B).includes('garden_hangout') && kinds(A).includes('garden_hangout'), 'both students get the hangout');
    assert.equal(kinds(A).filter((k) => k === 'garden_hangout').length, 1, 'deduped');

    // Campus Night: 20:00–21:00 Lagos.
    now = Date.UTC(2026, 9, 14, 19, 30, 0);
    await ada.packet({ type: 'move', position: [seat0[0], 0, seat0[2] + 0.02], rotation: 0.2, animation: 'sit' });
    await flush();
    assert(kinds(A).includes('campus_night'));

    // Visiting a friend's hostel room counts; your own room doesn't.
    events.length = 0;
    const room = new WorldRoomDO({ storage } as any, env) as any;
    await join(A, 'Ada', [0, 0, 2], `world:funaab:hostel-room:${A}`, room);
    await join(B, 'Bisi', [0, 0, 2], `world:funaab:hostel-room:${A}`, room);
    await flush();
    assert.deepEqual(events, [{ user: B, kind: 'visit_friend_room' }]);

    // Without the service key (local dev), nothing is attempted.
    events.length = 0;
    const offline: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true' } as any);
    const solo = await join(A, 'Ada', [...FOOTBALL_PITCH.shooterSpot], 'world:funaab:main', offline);
    now += 3000; await solo.packet({ type: 'football', requestId: 'x', op: 'practice', aim: 0, power: 0.5 });
    await flush();
    assert.equal(events.length, 0);
    console.log('DAILY PLAN WORKER PASSED: penalties capped at target, trusted garden position, hangout needs two, campus night window, friend room visits, offline no-op');
  } finally {
    (globalThis as any).WebSocket = oldWS; globalThis.fetch = oldFetch; globalThis.setInterval = oldInterval; Date.now = oldNow;
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
