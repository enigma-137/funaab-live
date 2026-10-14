// Held items: purchases map to the right prop, the Worker relays a valid item to the room
// (rate-limited) and ignores anything else.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { heldKindFor, HELD_ITEM_MS } from '../src/config/heldItems';
import { ECONOMY_CONFIG } from '../src/config/economy';
import { DINING_SPOTS, diningSpotAt } from '../src/config/campusWorld';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  assert.equal(heldKindFor('fw_jollof_chicken', 'food'), 'pack');
  assert.equal(heldKindFor('shawarma_beef', 'food'), 'wrap');
  assert.equal(heldKindFor('vendor_suya_beef'), 'wrap');
  assert.equal(heldKindFor('vendor_indomie_egg'), 'bowl');
  assert.equal(heldKindFor('fw_water', 'drink'), 'water');
  assert.equal(heldKindFor('malt_drink', 'drink'), 'malt');
  for (const list of Object.values(ECONOMY_CONFIG).filter(Array.isArray) as any[][])
    for (const item of list) if (item?.id && item?.type) assert.ok(heldKindFor(item.id, item.type), item.id);

  const oldWS = globalThis.WebSocket, oldInterval = globalThis.setInterval;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 1;
  try {
    const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true' } as any);
    const join = async (n: number) => {
      const socket = new Socket(); await w.handleSession(socket, null, 'world:funaab:main');
      await socket.packet({ type: 'join', player: { id: `00000000-0000-4000-8000-00000000000${n}`, username: 'S' + n, position: [0, 0, 8] } });
      return socket;
    };
    const a = await join(1), b = await join(2);
    const seen = () => b.messages.filter((m) => m.type === 'held_item');
    await a.packet({ type: 'held_item', kind: 'pack' });
    assert.equal(seen().length, 1, 'relayed to the room');
    assert.deepEqual([seen()[0].kind, seen()[0].ms], ['pack', HELD_ITEM_MS]);
    assert(seen()[0].connectionId, 'carries the holder');
    await a.packet({ type: 'held_item', kind: 'water' });
    assert.equal(seen().length, 1, 'rate limited');
    await a.packet({ type: 'held_item', kind: '<script>' });
    assert.equal(seen().length, 1, 'unknown items ignored');
    const now = Date.now; let t = now();
    Date.now = () => (t += 1100);
    try {
      await a.packet({ type: 'held_item', kind: 'bowl', ms: 10 * 60_000 });
      assert.equal(seen().at(-1).ms, 10 * 60_000, 'served on a table for 10 minutes');
      await a.packet({ type: 'held_item', kind: 'bowl', ms: 99 * 60_000 });
      assert.equal(seen().at(-1).ms, 10 * 60_000, 'capped at 10 minutes');
      await a.packet({ type: 'held_item', kind: 'bowl', ms: 0 });
      assert.equal(seen().at(-1).ms, 0, 'put away on standing up');
    } finally { Date.now = now; }
    assert.deepEqual(diningSpotAt(DINING_SPOTS[0].position), { y: 0.89, z: 0.45 }, 'Floral World table');
    assert.deepEqual(diningSpotAt(DINING_SPOTS[4].position), { y: 0.8, z: 0.85 }, 'Buka picnic table');
    assert.equal(DINING_SPOTS.length, 8);
    assert.equal(diningSpotAt([0, 0, 0]), null, 'no table elsewhere');
    console.log('HELD ITEM PASSED: purchase → prop mapping, room relay, rate limit, invalid items ignored, table serving (10 min cap, put away), 8 restaurant seats.');
  } finally { (globalThis as any).WebSocket = oldWS; (globalThis as any).setInterval = oldInterval; }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
