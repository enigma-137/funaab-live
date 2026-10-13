import React from 'react';
import { useToastStore } from '../stores/toastStore';
import { DmNotificationToast } from './DmNotificationToast';
import { LawnViolationToast } from './LawnViolationToast';

const naira = (n: number) => `${n < 0 ? '−' : '+'}₦${Math.abs(Math.round(n)).toLocaleString()}`;

/** Every transient notice lives in this one column, so they stack instead of overlapping. */
export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="campus-toasts" aria-live="polite">
      <LawnViolationToast />
      <DmNotificationToast />
      {toasts.map((t) => (
        <div key={t.id} role="status" className={`campus-toast is-${t.tone}`} onClick={() => dismiss(t.id)}>
          {t.icon && <span className="campus-toast-icon" aria-hidden>{t.icon}</span>}
          <span className="campus-toast-text">{t.text}</span>
          {typeof t.amount === 'number' && <span className="campus-toast-amount">{naira(t.amount)}</span>}
        </div>
      ))}
    </div>
  );
}
