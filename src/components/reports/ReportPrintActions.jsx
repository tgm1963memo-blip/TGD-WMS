import { useState } from 'react';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { ReportPreviewModal, printWithOrientation } from './ReportPreviewModal.jsx';

export function ReportPrintActions({
  title,
  renderReport,
  disabled = false,
  orientation = 'portrait',
  extraActions = null,
}) {
  const { language } = useLanguage();
  const goLive = isGoLivePresentationEnabled();
  const [open, setOpen] = useState(false);
  const previewLabel = goLive
    ? (getTranslation('view_report', language) || getTranslation('print_report', language) || 'View Report')
    : (getTranslation('preview_report', language) || getTranslation('preview', language) || 'Preview Report');
  const printLabel = getTranslation('print_report', language) || getTranslation('print', language) || 'Print Report';

  return (
    <>
      <div className="operational-report-actions no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button
          type="button"
          className="btn btn-primary-gold"
          data-testid="operational-report-preview-action"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {previewLabel}
        </button>
        <button
          type="button"
          className="btn"
          data-testid="operational-report-print-action"
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => printWithOrientation(orientation, title));
          }}
        >
          {printLabel}
        </button>
        {extraActions}
      </div>
      <ReportPreviewModal
        open={open}
        title={title}
        language={language}
        orientation={orientation}
        onClose={() => setOpen(false)}
      >
        {renderReport(language)}
      </ReportPreviewModal>
    </>
  );
}
