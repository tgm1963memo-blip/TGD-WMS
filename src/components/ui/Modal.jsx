import { useEffect } from 'react';

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidth = { sm: 500, md: 720, lg: 980, xl: 1200 }[size] ?? 720;

  return (
    <div
      className="operational-report-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="operational-report-modal" style={{ maxWidth, width: '100%' }}>
        <div className="operational-report-modal-toolbar">
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button" aria-label="ปิด">✕</button>
        </div>
        <div style={{ padding: 20 }}>
          {children}
        </div>
        {footer ? (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--tgd-border)', background: 'var(--tgd-surface)' }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
