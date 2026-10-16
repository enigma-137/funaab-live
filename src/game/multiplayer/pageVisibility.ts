// Tracks when the page was last hidden/shown so a dropped socket can be told
// apart from a real network problem. Mobile browsers (iOS Safari especially)
// suspend sockets while the app is in the background, and often only report the
// close a moment after the player comes back.

export const BACKGROUND_GRACE_MS = 10_000;

export type VisibilitySnapshot = {
  hidden: boolean;
  lastHiddenAt: number | null;
  lastVisibleAt: number | null;
};

/** True when a socket close at `now` is explained by the app being backgrounded. */
export function closedWhileBackgrounded(snapshot: VisibilitySnapshot, now: number): boolean {
  if (snapshot.hidden) return true;
  if (snapshot.lastHiddenAt === null || snapshot.lastVisibleAt === null) return false;
  // Came back to the foreground recently, after having been hidden.
  return snapshot.lastHiddenAt <= snapshot.lastVisibleAt && now - snapshot.lastVisibleAt <= BACKGROUND_GRACE_MS;
}

/** How long the page was hidden in its most recent background stretch, if known. */
export function hiddenDurationMs(snapshot: VisibilitySnapshot, now: number): number | undefined {
  if (snapshot.lastHiddenAt === null) return undefined;
  const end = snapshot.hidden || snapshot.lastVisibleAt === null || snapshot.lastVisibleAt < snapshot.lastHiddenAt ? now : snapshot.lastVisibleAt;
  return Math.max(0, end - snapshot.lastHiddenAt);
}

const state: VisibilitySnapshot = { hidden: false, lastHiddenAt: null, lastVisibleAt: null };
let tracking = false;

export function trackPageVisibility(): void {
  if (tracking || typeof document === 'undefined') return;
  tracking = true;
  state.hidden = document.visibilityState === 'hidden';
  document.addEventListener('visibilitychange', () => {
    const now = Date.now();
    state.hidden = document.visibilityState === 'hidden';
    if (state.hidden) state.lastHiddenAt = now;
    else state.lastVisibleAt = now;
  });
}

export function visibilitySnapshot(): VisibilitySnapshot {
  if (typeof document !== 'undefined') state.hidden = document.visibilityState === 'hidden';
  return { ...state };
}
