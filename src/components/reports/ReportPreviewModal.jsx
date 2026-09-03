import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTranslation } from '../../i18n/translationCatalog.js';

// Browsers suggest `document.title` as the default filename when the user
// picks "Save as PDF" from the print dialog. Modal titles are composed as
// "{document number} — {description}" (or just the bare number) — take the
// part before the dash so the suggested filename is the document number,
// not the generic app title, and strip characters Windows rejects in
// filenames.
function docNumberFromTitle(title) {
  const base = String(title ?? '').split(' — ')[0].trim();
  return (base || 'TGC WMS').replace(/[\\/:*?"<>|]/g, '-');
}

// Shared by ReportPreviewModal's own print button and ReportPrintActions'
// toolbar shortcut, so both paths honor `orientation` instead of only the
// one that goes through the modal's print button.
export function printWithOrientation(orientation, docTitle) {
  let injected = null;
  if (orientation === 'landscape') {
    injected = document.createElement('style');
    injected.id = '__print-page-orientation__';
    injected.textContent = '@page { size: A4 landscape; margin: 8mm; }';
    document.head.appendChild(injected);
  }
  const previousTitle = document.title;
  if (docTitle) document.title = docNumberFromTitle(docTitle);
  window.print();
  document.title = previousTitle;
  if (injected) document.head.removeChild(injected);
}

export function ReportPreviewModal({
  open = false,
  title,
  language = 'th',
  orientation = 'portrait',
  onClose,
  // Optional: a report that can also generate a real downloadable PDF file
  // (distinct from Save-as-PDF via the print dialog, e.g. the invoice draft
  // ledger's own vector-text export) passes an async callback here to get a
  // "ดาวน์โหลด PDF" button next to Print. Reports that don't pass it keep
  // today's Preview/Print/Close toolbar unchanged.
  onDownloadPdf,
  children,
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  const handlePrint = () => printWithOrientation(orientation, title);

  async function handleDownloadPdf() {
    if (!onDownloadPdf || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await onDownloadPdf();
    } finally {
      setDownloadingPdf(false);
    }
  }

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
            {onDownloadPdf ? (
              <button
                type="button"
                className="btn"
                data-testid="report-download-pdf-button"
                disabled={downloadingPdf}
                onClick={handleDownloadPdf}
              >
                {downloadingPdf ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
              </button>
            ) : null}
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
