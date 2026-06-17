import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { CustomerWithdrawalRequestLinesDisplay } from './CustomerWithdrawalRequestLinesDisplay.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';

export function CustomerWithdrawalRequestPrintDocument({
  header,
  lines = [],
  language = 'th',
  branding,
}) {
  if (!header) return null;

  return (
    <article className="operational-report-print-document customer-request-print-document" data-testid="customer-withdrawal-print-document">
      <DocumentHeader
        branding={branding}
        documentDate={header.created_at ? new Date(header.created_at).toLocaleDateString(language === 'en' ? 'en-GB' : 'th-TH') : '-'}
        documentNo={header.withdrawal_no}
        documentTitle={getTranslation('customer_withdrawal_print_title', language)}
        language={language}
      />

      <section className="customer-request-print-meta">
        <p><strong>{getTranslation('customer_col_status', language)}:</strong> {header.status}</p>
        <p><strong>{getTranslation('customer_field_requested_dispatch_date', language)}:</strong> {header.requested_dispatch_date ?? '-'}</p>
        <p><strong>{getTranslation('customer_field_delivery_type', language)}:</strong> {header.delivery_type ?? '-'}</p>
        <p><strong>{getTranslation('customer_field_pickup_contact', language)}:</strong> {header.pickup_contact ?? '-'}</p>
        {header.note ? <p><strong>{getTranslation('customer_col_note', language)}:</strong> {header.note}</p> : null}
      </section>

      <CustomerWithdrawalRequestLinesDisplay lines={lines} testId="customer-withdrawal-print-lines-table" />
    </article>
  );
}
