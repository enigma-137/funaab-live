import React from 'react';
import { X } from 'lucide-react';

/** The standard top-right close (X) for dialogs that don't have their own header button. */
export function ModalCloseButton({ onClose, label = 'Close', style }: { onClose: () => void; label?: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/90 text-slate-300 transition hover:bg-slate-700 hover:text-white active:scale-95"
      style={style}
    >
      <X className="h-5 w-5" />
    </button>
  );
}
