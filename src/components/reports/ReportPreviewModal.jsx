import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getTranslation } from '../../i18n/translationCatalog.js';

export function ReportPreviewModal({
  open = false,
  title,
  language = 'th',
  orientation = 'portrait',
  onClose,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const previewLabel = getTranslation('preview', language) || 'Preview';
  const printLabel = getTranslation('print', language) || 'Print';
  const closeLabel = getTranslation('close', language) || 'Close';

  const handlePrint = () => {
    let injected = null;
    if (orientation === 'landscape') {
      injected = document.createElement('style');
      injected.id = '__print-page-orientation__';
      injected.textContent = '@page { size: A4 landscape; margin: 8mm; }';
      document.head.appendChild(injected);
    }
    window.print();
    if (injected) document.head.removeChild(injected);
  };

  return createPortal(
    <div className="operational-report-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="operational-report-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="operational-report-modal-toolbar no-print">
          <h2>{title}</h2>
          <div className="operational-report-modal-actions">
            <button type="button" className="btn" data-testid="report-preview-button">
              {previewLabel}
            </button>
            <button type="button" className="btn btn-primary-gold" data-testid="report-print-button" onClick={handlePrint}>
              {printLabel}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </header>
        <div className="operational-report-modal-body operational-report-print-root">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
