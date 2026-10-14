// In-game feedback: players send a bug report, suggestion or general feedback, and the Worker
// forwards it to the team's Telegram chat. Shared by the client form, the Worker and tests.

export const FEEDBACK_KINDS = ['bug', 'suggestion', 'feedback'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_LABELS: Record<FeedbackKind, { label: string; icon: string }> = {
  bug: { label: 'Bug', icon: '🐞' },
  suggestion: { label: 'Suggestion', icon: '💡' },
  feedback: { label: 'Feedback', icon: '💬' },
};

export const FEEDBACK_LIMITS = {
  messageMin: 5,
  messageMax: 2000,
  nameMax: 60,
  contactMax: 100,
  /** Per player, per hour. */
  perHour: 4,
  /** Minimum gap between two messages from the same player. */
  gapMs: 20_000,
};

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  name: string;
  contact?: string;
  device?: string;
}

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';

/** Normalise untrusted input; returns an error string instead of throwing. */
export function parseFeedback(data: any): FeedbackInput | { error: string } {
  const kind = FEEDBACK_KINDS.includes(data?.kind) ? (data.kind as FeedbackKind) : null;
  if (!kind) return { error: 'Pick Bug, Suggestion or Feedback.' };
  const message = clean(data?.message, FEEDBACK_LIMITS.messageMax);
  if (message.length < FEEDBACK_LIMITS.messageMin) return { error: 'Write a little more so we can understand.' };
  return {
    kind,
    message,
    name: clean(data?.name, FEEDBACK_LIMITS.nameMax),
    contact: clean(data?.contact, FEEDBACK_LIMITS.contactMax) || undefined,
    device: clean(data?.device, 40) || undefined,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Telegram HTML message. Everything the player typed is escaped. */
export function formatFeedbackMessage(
  input: FeedbackInput,
  who: { username: string; college: string; place: string },
  at = new Date(),
): string {
  const { label, icon } = FEEDBACK_LABELS[input.kind];
  const time = at.toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const name = input.name && input.name.toLowerCase() !== who.username.toLowerCase() ? ` · “${esc(input.name)}”` : '';
  return [
    `${icon} <b>${label}</b> from @${esc(who.username)} (${esc(who.college || 'CAMPUS')})${name}`,
    '',
    esc(input.message),
    '',
    `📍 ${esc(who.place)} · ${input.device === 'mobile' ? '📱 Mobile' : '💻 Desktop'} · ${time}`,
    ...(input.contact ? [`📞 ${esc(input.contact)}`] : []),
  ].join('\n');
}
