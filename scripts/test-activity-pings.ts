// Activity pings tell TraceIQ a player is really playing (the WebSocket is invisible
// to it), without making an idle open tab look active. Run: npx tsx scripts/test-activity-pings.ts
import assert from 'node:assert/strict';
import {
  ACTIVITY_PING_INTERVAL_MS,
  ACTIVITY_RECENT_INPUT_MS,
  shouldSendActivityPing,
  startTraceIQActivityPings,
} from '../src/lib/traceiq';

const now = 1_000_000_000;
const ping = (over: Partial<Parameters<typeof shouldSendActivityPing>[0]>) =>
  shouldSendActivityPing({ now, lastInputAt: now - 1000, lastPingAt: null, visible: true, ...over });

assert.equal(ping({}), true, 'recent input, visible, never pinged: ping');
assert.equal(ping({ lastInputAt: null }), false, 'no input yet (tab just open): no ping');
assert.equal(ping({ visible: false }), false, 'hidden tab: no ping');
assert.equal(ping({ lastInputAt: now - ACTIVITY_RECENT_INPUT_MS - 1 }), false, 'idle for over 2 minutes: no ping');
assert.equal(ping({ lastPingAt: now - 60_000 }), false, 'pinged a minute ago: wait');
assert.equal(ping({ lastPingAt: now - ACTIVITY_PING_INTERVAL_MS }), true, 'pinged 5 minutes ago and still playing: ping');

// Listener wiring: listeners added on start and removed on stop, timer cleared.
const added: string[] = [];
const removed: string[] = [];
let cleared = false;
(globalThis as any).document = { visibilityState: 'visible' };
(globalThis as any).window = {
  addEventListener: (type: string) => added.push(type),
  removeEventListener: (type: string) => removed.push(type),
  setInterval: () => 42,
  clearInterval: (id: number) => { cleared = id === 42; },
};
const stop = startTraceIQActivityPings();
assert.deepEqual(added.sort(), ['keydown', 'pointerdown', 'touchstart', 'wheel']);
stop();
assert.deepEqual(removed.sort(), added);
assert.equal(cleared, true);

console.log('activity pings: all checks passed');
