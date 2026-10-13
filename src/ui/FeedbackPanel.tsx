import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { AppTile } from './phoneIcons';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { FEEDBACK_KINDS, FEEDBACK_LABELS, FEEDBACK_LIMITS, type FeedbackKind } from '../config/feedback';

const isMobile = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 640);

/** Small always-available launcher, stacked under the Phone button by StudentCampusTools. */
export function FeedbackLauncher() {
  const activeModal = useGameStore((s) => s.activeModal);
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const user = useAuthStore((s) => s.user);
  if (!user || activeModal) return null;
  return (
    <button
      type="button"
      onClick={() => setActiveModal('feedback')}
      title="Send feedback"
      aria-label="Send feedback, report a bug or suggest an idea"
      className="campus-launcher-mini flex h-10 w-10 items-center justify-center rounded-xl border border-[#c7d6c9] bg-[#f8faf7] shadow-lg transition active:scale-95"
    >
      <AppTile glyph="feedback" colors={['#2dd4bf', '#0f766e']} />
    </button>
  );
}

/** The feedback form, opened from the launcher or the phone. */
export function FeedbackButton() {
  const activeModal = useGameStore((s) => s.activeModal);
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  return activeModal === 'feedback' ? <FeedbackModal onClose={() => setActiveModal(null)} /> : null;
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [name, setName] = useState(user?.username ?? '');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const tooShort = message.trim().length < FEEDBACK_LIMITS.messageMin;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tooShort || sending) return;
    setSending(true);
    setError(null);
    try {
      await networkManager.sendFeedback({ kind, message, name, contact, device: isMobile() ? 'mobile' : 'desktop' });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const placeholder = kind === 'bug'
    ? 'What happened? Where were you, and what did you expect?'
    : kind === 'suggestion' ? 'What would make campus life better?' : 'Tell us anything about the game.';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
        // Stop WASD/E reaching the game while typing.
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900 font-['Plus_Jakarta_Sans'] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-3.5">
          <div>
            <h2 id="feedback-title" className="font-['Outfit'] text-base font-bold">Send feedback</h2>
            <p className="text-[11px] text-slate-400">Goes straight to the FUNAAB Life team.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="space-y-3 px-5 py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <div className="font-['Outfit'] text-lg font-bold">Thank you!</div>
            <p className="text-xs text-slate-400">The team got your {FEEDBACK_LABELS[kind].label.toLowerCase()}.</p>
            <button type="button" onClick={onClose} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold hover:bg-emerald-500">
              Back to campus
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3.5 px-5 py-4">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type">
              {FEEDBACK_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${kind === k
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'}`}
                >
                  <span className="mr-1">{FEEDBACK_LABELS[k].icon}</span>{FEEDBACK_LABELS[k].label}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">Message</span>
              <textarea
                ref={textRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={FEEDBACK_LIMITS.messageMax}
                rows={5}
                placeholder={placeholder}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <span className="mt-0.5 block text-right text-[10px] text-slate-500">{message.length}/{FEEDBACK_LIMITS.messageMax}</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-400">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={FEEDBACK_LIMITS.nameMax}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-400">Contact (optional)</span>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={FEEDBACK_LIMITS.contactMax}
                  placeholder="Email or phone"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </label>
            </div>

            {error && <p role="alert" className="rounded-lg bg-rose-950/60 px-3 py-2 text-xs text-rose-200">{error}</p>}

            <button
              type="submit"
              disabled={tooShort || sending}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
