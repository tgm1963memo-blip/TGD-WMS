import { X } from 'lucide-react';
import { useEffect } from 'react';

// closeOnBackdrop: pass false for forms, so a stray click outside the dialog
// doesn't throw away what the user has typed. Escape and the close button
// still close it.
export function Modal({ isOpen, onClose, title, children, size = 'md', footer, closeOnBackdrop = true }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidth = {
    sm: 500,
    md: 720,
    lg: 980,
    xl: 'calc(100vw - 48px)',
  }[size] ?? 720;

  return (
    <div
      className="operational-report-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
    >
      <div className="operational-report-modal" style={{ maxWidth, width: '100%' }}>
        <div className="operational-report-modal-toolbar">
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button" aria-label="ปิด"><X size={14} aria-hidden="true" /></button>
        </div>
        <div className="operational-report-modal-scroll-body">
          {children}
        </div>
        {footer ? (
          <div className="operational-report-modal-footer">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
