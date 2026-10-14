import React, { useEffect, useId, useRef } from 'react';
import { ModalCloseButton } from './ModalCloseButton';

/**
 * The standard campus dialog: a bottom sheet on phones, a centred card on wider screens.
 * One dark theme, Escape / backdrop tap to close, focus kept inside while open, focus
 * returned to whatever opened it. Feature dialogs supply only their icon, title and body.
 */
export function Sheet({
  title,
  subtitle,
  icon,
  accent = '#10b981',
  onClose,
  children,
  footer,
  wide = false,
  closeOnBackdrop = true,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Header accent colour (icon tile + top border). */
  accent?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  closeOnBackdrop?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus?.({ preventScroll: true }); };
  }, []);

  return (
    <div className="campus-sheet-backdrop" onClick={closeOnBackdrop ? onClose : undefined}>
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`campus-sheet${wide ? ' is-wide' : ''}`}
        style={{ '--sheet-accent': accent } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="campus-sheet-header">
          {icon && <div className="campus-sheet-icon" aria-hidden>{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="campus-sheet-title">{title}</h2>
            {subtitle && <p className="campus-sheet-subtitle">{subtitle}</p>}
          </div>
          <ModalCloseButton onClose={onClose} label={`Close ${typeof title === 'string' ? title : 'dialog'}`} />
        </header>
        <div className="campus-sheet-body">{children}</div>
        {footer && <footer className="campus-sheet-footer">{footer}</footer>}
      </section>
    </div>
  );
}
