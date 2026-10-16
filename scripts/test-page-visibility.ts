import assert from 'node:assert/strict';
import { BACKGROUND_GRACE_MS, closedWhileBackgrounded, hiddenDurationMs } from '../src/game/multiplayer/pageVisibility';

const now = 1_000_000;

// Socket drops while the app is in the background.
assert(closedWhileBackgrounded({ hidden: true, lastHiddenAt: now - 30_000, lastVisibleAt: now - 60_000 }, now), 'Close while hidden is a background drop');
assert.equal(hiddenDurationMs({ hidden: true, lastHiddenAt: now - 30_000, lastVisibleAt: now - 60_000 }, now), 30_000);

// iOS reports the close just after the player returns.
const justReturned = { hidden: false, lastHiddenAt: now - 45_000, lastVisibleAt: now - 2_000 };
assert(closedWhileBackgrounded(justReturned, now), 'Close right after returning is a background drop');
assert.equal(hiddenDurationMs(justReturned, now), 43_000);

// Returned long ago: a later drop is a real network problem.
assert(!closedWhileBackgrounded({ hidden: false, lastHiddenAt: now - 120_000, lastVisibleAt: now - BACKGROUND_GRACE_MS - 1 }, now), 'Old background stretch does not explain a new drop');

// Never hidden: always a real drop.
assert(!closedWhileBackgrounded({ hidden: false, lastHiddenAt: null, lastVisibleAt: null }, now), 'Never-hidden page is a real drop');
assert.equal(hiddenDurationMs({ hidden: false, lastHiddenAt: null, lastVisibleAt: null }, now), undefined);

console.log('PAGE VISIBILITY PASSED: hidden closes, closes just after returning, stale background stretches, never-hidden pages.');
