import { traceiq } from 'traceiq-sdk-js';

export type TraceIQUser = {
  id: string;
  username?: string;
  college?: string;
  courseId?: string | null;
  onboardingCompleted?: boolean;
  lastWorld?: string;
};

function readEnvVar(...keys: string[]): string | undefined {
  const candidates = new Set<string>();
  for (const key of keys) {
    candidates.add(key);
    candidates.add(key.replace(/^VITE_/, ''));
    candidates.add(`VITE_${key.replace(/^VITE_/, '')}`);
  }

  for (const key of candidates) {
    const value = (import.meta as any).env?.[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }

  return undefined;
}

export function getTraceIQConfig() {
  const projectId = readEnvVar('TRACEIQ_PROJECT_ID', 'VITE_TRACEIQ_PROJECT_ID');
  const writeKey = readEnvVar('TRACEIQ_WRITE_KEY', 'VITE_TRACEIQ_WRITE_KEY');
  const endpoint = readEnvVar('TRACEIQ_ENDPOINT', 'VITE_TRACEIQ_ENDPOINT') || 'https://api.traceiq.run';

  return {
    projectId,
    writeKey,
    endpoint,
    debug: readEnvVar('TRACEIQ_DEBUG', 'VITE_TRACEIQ_DEBUG') === 'true',
    autoTrackPageViews: readEnvVar('TRACEIQ_AUTO_TRACK_PAGE_VIEWS', 'VITE_TRACEIQ_AUTO_TRACK_PAGE_VIEWS') !== 'false',
    autoCaptureExceptions: readEnvVar('TRACEIQ_AUTO_CAPTURE_EXCEPTIONS', 'VITE_TRACEIQ_AUTO_CAPTURE_EXCEPTIONS') !== 'false',
    autoCaptureRageClicks: readEnvVar('TRACEIQ_AUTO_CAPTURE_RAGE_CLICKS', 'VITE_TRACEIQ_AUTO_CAPTURE_RAGE_CLICKS') !== 'false',
    autoCaptureRequests: readEnvVar('TRACEIQ_AUTO_CAPTURE_REQUESTS', 'VITE_TRACEIQ_AUTO_CAPTURE_REQUESTS') !== 'false',
  };
}

let initialized = false;

export function initializeTraceIQ(): boolean {
  if (typeof window === 'undefined' || initialized) return initialized;

  const config = getTraceIQConfig();
  if (!config.projectId || !config.writeKey) {
    if (import.meta.env.DEV) {
      console.info('[TraceIQ] Skipped init: set VITE_TRACEIQ_PROJECT_ID and VITE_TRACEIQ_WRITE_KEY in your .env file.');
    }
    return false;
  }

  try {
    traceiq.initialize({
      projectId: config.projectId,
      writeKey: config.writeKey,
      endpoint: config.endpoint,
      debug: config.debug,
      autoTrackPageViews: config.autoTrackPageViews,
      autoCaptureExceptions: config.autoCaptureExceptions,
      autoCaptureRageClicks: config.autoCaptureRageClicks,
      autoCaptureRequests: config.autoCaptureRequests,
    });
    initialized = true;
    return true;
  } catch (error) {
    console.warn('[TraceIQ] initialization failed.', error);
    return false;
  }
}

export function identifyTraceIQUser(user: TraceIQUser | null): void {
  if (!user || !user.id || !initialized) return;

  try {
    traceiq.identify({
      userId: user.id,
      traits: {
        username: user.username,
        college: user.college,
        courseId: user.courseId ?? null,
        onboardingCompleted: Boolean(user.onboardingCompleted),
        lastWorld: user.lastWorld ?? 'funaab',
      },
    });
  } catch (error) {
    console.warn('[TraceIQ] identify failed.', error);
  }
}

export function trackTraceIQEvent(eventName: string, properties: Record<string, unknown> = {}): void {
  if (!initialized) return;

  try {
    traceiq.track(eventName, properties);
  } catch (error) {
    console.warn(`[TraceIQ] track('${eventName}') failed.`, error);
  }
}

export function captureTraceIQException(error: unknown, context: Record<string, unknown> = {}): void {
  if (!initialized) return;

  try {
    if (error instanceof Error) {
      traceiq.captureException(error, context);
      return;
    }

    traceiq.captureException(new Error(String(error)), context);
  } catch (captureError) {
    console.warn('[TraceIQ] captureException failed.', captureError);
  }
}
