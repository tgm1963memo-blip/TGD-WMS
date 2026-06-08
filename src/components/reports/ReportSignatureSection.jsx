import { DocumentFooter } from '../documents/DocumentFooter.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';

export function ReportSignatureSection({
  branding,
  language = 'th',
  preparedBy,
  approvedBy,
  receivedByLabel,
  deliveredByLabel,
}) {
  const receivedLabel = receivedByLabel || getTranslation('report_received_by', language) || 'Received by';
  const deliveredLabel = deliveredByLabel || getTranslation('report_delivered_by', language) || 'Delivered by';

  return (
    <section className="operational-report-signatures" data-testid="report-signature-section">
      <div className="operational-report-signature-grid">
        <div className="operational-report-signature-box">
          <span className="operational-report-signature-label">{receivedLabel}</span>
          <span className="operational-report-signature-line" />
          <span className="operational-report-signature-name">{preparedBy || '-'}</span>
        </div>
        <div className="operational-report-signature-box">
          <span className="operational-report-signature-label">{deliveredLabel}</span>
          <span className="operational-report-signature-line" />
          <span className="operational-report-signature-name">{approvedBy || '-'}</span>
        </div>
      </div>
      <DocumentFooter branding={branding} language={language} preparedBy={preparedBy} approvedBy={approvedBy} />
    </section>
  );
}
