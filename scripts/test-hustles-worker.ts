// Hustle Worker rules: POS shifts are timed and need presence, photo pay counts real clients,
// tutoring only in the Library, errand handover needs both students face to face.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { POS_KIOSK, PHOTO_SPOTS } from '../src/config/hustles';
import { FARM_SHIFT, FARM_STEPS, FPY_FARM } from '../src/config/fpyFarm';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldFetch = globalThis.fetch, oldInterval = globalThis.setInterval, oldNow = Date.now;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  let now = Date.UTC(2026, 9, 14, 10, 0, 0); Date.now = () => now; // 11:00 Lagos, a Wednesday (Library open)
  const calls: Array<{ name: string; body: any }> = [];
  let errand: any = null;
  globalThis.fetch = (async (url: any, init: any) => {
    const name = String(url).split('/').at(-1)!, body = JSON.parse(init.body);
    calls.push({ name, body });
    if (name === 'hustle_pay_trusted') return new Response(JSON.stringify(body.p_amount));
    if (name === 'tutoring_start_trusted') return new Response(JSON.stringify({ session: '11111111-1111-4111-8111-111111111111', questions: [] }));
    if (name === 'tutoring_submit_trusted') return new Response(JSON.stringify({ score: 1, paid: 80 }));
    if (name === 'errand_for_trusted') return new Response(JSON.stringify(errand));
    if (name === 'errand_complete_trusted') return new Response(JSON.stringify({ paid: 3000 }));
    return new Response('true');
  }) as any;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  try {
    const env = { ENABLE_GUEST_MODE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', SUPABASE_URL: 'https://hustle.invalid' } as any;
    const w: any = new WorldRoomDO({ storage } as any, env);
    const join = async (id: string, name: string, position: number[], room = 'world:funaab:main', target = w) => {
      const socket = new Socket(); await target.handleSession(socket, null, room);
      await socket.packet({ type: 'join', room, player: { id, username: name, position } });
      const session = target.sessions.get(socket);
      session.trustedPosition = position; session.claimedPosition = position; session.movementClock = now;
      return { socket, session };
    };
    const hustle = async (s: Socket, payload: object) => { await s.packet({ type: 'hustle', requestId: crypto.randomUUID(), ...payload }); return s.messages.filter((m) => m.type === 'action_result').at(-1); };
    const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2', C = '00000000-0000-4000-8000-0000000000c3';
    const paid = (hustle: string) => calls.filter((c) => c.name === 'hustle_pay_trusted' && c.body.p_hustle === hustle);

    // ---- POS ----
    const ada = await join(A, 'Ada', [0, 0, 0]);
    assert.match((await hustle(ada.socket, { op: 'pos_start' })).error, /POS kiosk/);
    ada.session.trustedPosition = [...POS_KIOSK.serviceSpot]; ada.session.claimedPosition = [...POS_KIOSK.serviceSpot];
    const started = await hustle(ada.socket, { op: 'pos_start' });
    assert.equal(started.result.endsAt, now + 60000);
    now += 30000;
    assert.match((await hustle(ada.socket, { op: 'pos_finish' })).error, /Finish serving/);
    // Walking away cancels the shift.
    now += 5000;
    await ada.socket.packet({ type: 'move', position: [POS_KIOSK.serviceSpot[0] + 8, 0, POS_KIOSK.serviceSpot[2]], rotation: 0, animation: 'walk' });
    assert(ada.socket.messages.some((m) => m.type === 'hustle_notice' && /left the POS kiosk/.test(m.text)));
    now += 60000;
    await ada.socket.packet({ type: 'move', position: [...POS_KIOSK.serviceSpot], rotation: 0, animation: 'idle' });
    assert.match((await hustle(ada.socket, { op: 'pos_finish' })).error, /Start a shift/);
    assert.equal(paid('pos').length, 0, 'abandoned shift never paid');
    // A full shift pays exactly ₦2,500, once.
    await hustle(ada.socket, { op: 'pos_start' });
    now += 61000;
    const fin = await hustle(ada.socket, { op: 'pos_finish', amount: 99999 });
    assert.equal(fin.result.paid, 2500);
    assert.equal(paid('pos').length, 1); assert.equal(paid('pos')[0].body.p_amount, 2500);
    assert.match((await hustle(ada.socket, { op: 'pos_finish' })).error, /Start a shift/);

    // ---- FPY farm: three jobs, each at its plot, in order, at a real pace ----
    const at = (p: readonly number[]) => { ada.session.trustedPosition = [...p]; ada.session.claimedPosition = [...p]; };
    at(POS_KIOSK.serviceSpot);
    assert.match((await hustle(ada.socket, { op: 'farm_start' })).error, /FPY farm/);
    assert.match((await hustle(ada.socket, { op: 'farm_step' })).error, /Start a farm shift/);
    at(FPY_FARM.gate);
    assert.equal((await hustle(ada.socket, { op: 'farm_start' })).result.step, 0);
    now += FARM_SHIFT.minStepSeconds * 1000;
    assert.match((await hustle(ada.socket, { op: 'farm_step' })).error, /plot/, 'must stand at the plant plot');
    at(FARM_STEPS[1].spot);
    assert.match((await hustle(ada.socket, { op: 'farm_step' })).error, /plot/, 'out of order');
    at(FARM_STEPS[0].spot);
    assert.equal((await hustle(ada.socket, { op: 'farm_step' })).result.step, 1);
    at(FARM_STEPS[1].spot);
    assert.match((await hustle(ada.socket, { op: 'farm_step' })).error, /Take your time/, 'too fast');
    now += FARM_SHIFT.minStepSeconds * 1000;
    assert.equal((await hustle(ada.socket, { op: 'farm_step' })).result.step, 2);
    assert.equal(paid('farm').length, 0, 'not paid before the harvest');
    at(FARM_STEPS[2].spot);
    now += FARM_SHIFT.minStepSeconds * 1000;
    const harvest = await hustle(ada.socket, { op: 'farm_step', amount: 99999 });
    assert.equal(harvest.result.paid, FARM_SHIFT.pay);
    assert.equal(paid('farm').length, 1); assert.equal(paid('farm')[0].body.p_amount, FARM_SHIFT.pay);
    assert.match((await hustle(ada.socket, { op: 'farm_step' })).error, /Start a farm shift/, 'paid once');
    // A half-done shift expires.
    at(FPY_FARM.gate); await hustle(ada.socket, { op: 'farm_start' });
    now += FARM_SHIFT.expireMinutes * 60000 + 1000; at(FARM_STEPS[0].spot);
    assert.match((await hustle(ada.socket, { op: 'farm_step' })).error, /Start a farm shift/);

    // ---- Photos: pay grows with real students nearby (capped at 3) ----
    const spot = PHOTO_SPOTS[0];
    assert.match((await hustle(ada.socket, { op: 'photo', spot: spot.id })).error, /photo spot/);
    ada.session.trustedPosition = [...spot.position]; ada.session.claimedPosition = [...spot.position];
    assert.equal((await hustle(ada.socket, { op: 'photo', spot: spot.id, clients: 50 })).result.paid, 1000, 'alone: base pay, client count is not taken from the phone');
    const bisi = await join(B, 'Bisi', [spot.position[0] + 3, 0, spot.position[2]]);
    const far = await join(C, 'Far', [spot.position[0] + 40, 0, spot.position[2]]);
    assert.equal((await hustle(ada.socket, { op: 'photo', spot: spot.id })).result.paid, 2000, 'one real client nearby');
    void far;

    // ---- Tutoring: Library only ----
    assert.match((await hustle(ada.socket, { op: 'tutor_start' })).error, /Library/);
    const lib: any = new WorldRoomDO({ storage } as any, env);
    const reader = await join(A, 'Ada', [0, 0, 2], 'world:funaab:library', lib);
    assert.equal((await hustle(reader.socket, { op: 'tutor_start' })).error, undefined);
    await hustle(reader.socket, { op: 'tutor_submit', session: '11111111-1111-4111-8111-111111111111', answers: { 'phy201-1': 1, 'bad key!': 2, 'phy201-2': 'x' } });
    assert.deepEqual(calls.filter((c) => c.name === 'tutoring_submit_trusted')[0].body.p_answers, { 'phy201-1': 1 }, 'answers sanitised');

    // ---- Errand handover: runner and poster face to face ----
    const id = '22222222-2222-4222-8222-222222222222';
    errand = { poster: A, runner: B, status: 'accepted' };
    bisi.session.trustedPosition = [spot.position[0] + 30, 0, spot.position[2]]; bisi.session.claimedPosition = bisi.session.trustedPosition;
    assert.match((await hustle(bisi.socket, { op: 'errand_handover', errand: id })).error, /Walk up to them/);
    bisi.session.trustedPosition = [spot.position[0] + 2, 0, spot.position[2]]; bisi.session.claimedPosition = bisi.session.trustedPosition;
    const handed = await hustle(bisi.socket, { op: 'errand_handover', errand: id });
    assert.equal(handed.result.paid, 3000);
    assert(ada.socket.messages.some((m) => m.type === 'hustle_notice' && /Bisi finished your errand/.test(m.text)), 'poster is told');
    assert.match((await hustle(ada.socket, { op: 'errand_handover', errand: id })).error, /not yours/, 'the poster cannot pay themselves');
    errand = { poster: '00000000-0000-4000-8000-0000000000ff', runner: B, status: 'accepted' };
    assert.match((await hustle(bisi.socket, { op: 'errand_handover', errand: id })).error, /not on campus/);
    console.log('HUSTLES WORKER PASSED: POS timed + presence + walk-away cancel + once, FPY farm steps in order at their plots at a real pace and paid once, photo pay from real nearby students, tutoring Library-only with sanitised answers, errand handover needs both face to face');
  } finally {
    (globalThis as any).WebSocket = oldWS; globalThis.fetch = oldFetch; globalThis.setInterval = oldInterval; Date.now = oldNow;
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
