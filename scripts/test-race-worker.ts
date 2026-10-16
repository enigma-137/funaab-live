// Campus Grand Prix on the Worker: it follows a lap on the trusted position and pays only a lap it
// watched (from the grid, after the lights, in the same car, every checkpoint, not faster than the
// car), asking the database for the prize of the place its own clock gives.
// Run: npm run test:race:worker
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { RACE, RACE_LENGTH, RIVAL_FINISH_MS, finishPlace, pointAlong } from '../src/config/carRace';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldFetch = globalThis.fetch, oldInterval = globalThis.setInterval, oldNow = Date.now;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  let now = oldNow(); Date.now = () => now;
  const calls: any[] = [];
  globalThis.fetch = async (url: any, init: any) => {
    const body = JSON.parse(init.body); calls.push({ url: String(url), body });
    if (String(url).endsWith('race_reward_trusted')) return new Response(JSON.stringify({ prize: [3000, 1500, 500][body.p_place - 1], paid_today: 1, balance: 50000 }));
    return new Response('true');
  };
  const storage = { put: async () => {}, delete: async () => {}, setAlarm: async () => {}, list: async () => new Map() };
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', SUPABASE_URL: 'https://race.invalid' } as any);
    const grid = RACE.track[0];
    let n = 0;
    async function driver() {
      const socket = new Socket();
      await w.handleSession(socket, null, 'world:funaab:main');
      await socket.packet({ type: 'join', player: { id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, username: `Racer${n}`, position: [grid[0], 0, grid[2]] } });
      const s = w.sessions.get(socket);
      Object.assign(s, { trustedPosition: [...grid], claimedPosition: [...grid], trustedAt: now, movementClock: now });
      return socket;
    }
    const move = (socket: Socket, x: number, z: number, car: string | null = 'car_picanto') => socket.packet({ type: 'move', position: [x, 0, z], rotation: 0, animation: 'sit', kekeRiding: false, car });
    const tick = (ms: number) => { now += ms; };
    /** Drive the lap at `speed` m/s, one move a tenth of a second; returns the race_result. */
    async function lap(socket: Socket, speed: number, opts: { stopAt?: number } = {}) {
      await move(socket, grid[0], grid[2]);
      await socket.packet({ type: 'race_start' });
      for (let t = 0; t < RACE.countdownMs; t += 100) { tick(100); await move(socket, grid[0], grid[2]); }
      for (let d = 0; d <= RACE_LENGTH + 2; d += speed / 10) {
        tick(100);
        // Drive off across the grass (the trusted position follows at most 35 m/s, so a few moves).
        if (opts.stopAt !== undefined && d >= opts.stopAt) { for (let i = 0; i < 20; i++) { tick(100); await move(socket, grid[0] + 40, grid[2] + 20); } break; }
        const p = pointAlong(RACE.track, Math.min(d, RACE_LENGTH));
        await move(socket, p.x + (d > RACE_LENGTH ? p.dx * (d - RACE_LENGTH) : 0), p.z + (d > RACE_LENGTH ? p.dz * (d - RACE_LENGTH) : 0));
        if (socket.messages.some((m) => m.type === 'race_result')) break;
      }
      for (let i = 0; i < 5 && !socket.messages.some((m) => m.type === 'race_result'); i++) await new Promise((r) => setTimeout(r, 0));
      return socket.messages.find((m) => m.type === 'race_result');
    }

    // A clean lap at 11 m/s in a Picanto (top speed 11.5): watched, placed by the Worker's clock and paid.
    const a = await driver();
    const res = await lap(a, 11);
    assert(res?.ok, `paid: ${JSON.stringify(res)}`);
    const call = calls.find((c) => c.url.endsWith('race_reward_trusted'));
    assert.equal(call.body.p_car, 'car_picanto'); assert.equal(call.body.p_user, '00000000-0000-4000-8000-000000000001');
    assert(Math.abs(call.body.p_ms - RACE_LENGTH / 11 * 1000) < 1500, `lap time ${call.body.p_ms}`);
    assert.equal(call.body.p_place, finishPlace(call.body.p_ms)); assert.equal(res.place, call.body.p_place);
    assert(call.body.p_ms < Math.min(...RIVAL_FINISH_MS) && res.place === 1 && res.prize === 3000, '1st at 11 m/s');
    assert.equal(res.balance, 50000);

    // Slower than both rivals: 3rd.
    calls.length = 0;
    const b = await driver();
    const slow = await lap(b, 9);
    assert(slow?.ok && slow.place === 3 && slow.prize === 500, `3rd: ${JSON.stringify(slow)}`);

    // Faster than the car can go: nothing paid, the database is never asked.
    calls.length = 0;
    const c = await driver();
    const fast = await lap(c, 30);
    assert(fast && !fast.ok && /faster than your car/.test(fast.reason), JSON.stringify(fast));
    assert(!calls.some((x) => x.url.endsWith('race_reward_trusted')));

    // Leaving the route, getting out, jumping the start, starting away from the grid.
    const d = await driver();
    const off = await lap(d, 11, { stopAt: 100 });
    assert(off && !off.ok && /left the race route/.test(off.reason), JSON.stringify(off));
    const e = await driver();
    await move(e, grid[0], grid[2]); await e.packet({ type: 'race_start' }); tick(3200);
    const p = pointAlong(RACE.track, 3); await move(e, p.x, p.z, null);
    assert(/got out/.test(e.messages.find((m) => m.type === 'race_result')?.reason), 'got out');
    const f = await driver();
    await move(f, grid[0], grid[2]); await f.packet({ type: 'race_start' });
    for (let i = 1; i <= 10; i++) { tick(100); const q = pointAlong(RACE.track, i * 1.5); await move(f, q.x, q.z); }
    assert(/jumped the start/.test(f.messages.find((m) => m.type === 'race_result')?.reason), 'jump start');
    const g = await driver();
    Object.assign(w.sessions.get(g), { trustedPosition: [0, 0, 12], claimedPosition: [0, 0, 12] });
    await move(g, 0, 12); await g.packet({ type: 'race_start' });
    assert(/START arch/.test(g.messages.find((m) => m.type === 'race_result')?.reason), 'must start at the grid');
    const h = await driver();
    await move(h, grid[0], grid[2], null); await h.packet({ type: 'race_start' });
    assert(/drive your own car/.test(h.messages.find((m) => m.type === 'race_result')?.reason), 'must be driving');

    console.log('RACE WORKER PASSED: watches the lap on the trusted position, places by its own clock, pays 1st/3rd, refuses too-fast laps, leaving the route, getting out, jump starts, and starting away from the grid or on foot.');
  } finally {
    globalThis.WebSocket = oldWS; globalThis.fetch = oldFetch; globalThis.setInterval = oldInterval; Date.now = oldNow;
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
