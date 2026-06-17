import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { CustomerDepositRequestLinesDisplay } from './CustomerDepositRequestLinesDisplay.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';

export function CustomerDepositRequestPrintDocument({
  header,
  lines = [],
  language = 'th',
  branding,
}) {
  if (!header) return null;

  return (
    <article className="operational-report-print-document customer-request-print-document" data-testid="customer-deposit-print-document">
      <DocumentHeader
        branding={branding}
        documentDate={header.created_at ? new Date(header.created_at).toLocaleDateString(language === 'en' ? 'en-GB' : 'th-TH') : '-'}
        documentNo={header.request_no}
        documentTitle={getTranslation('customer_deposit_print_title', language)}
        language={language}
      />

      <section className="customer-request-print-meta">
        <p><strong>{getTranslation('customer_col_status', language)}:</strong> {header.status}</p>
        <p><strong>{getTranslation('customer_field_expected_arrival_date', language)}:</strong> {header.expected_arrival_date ?? '-'}</p>
        <p><strong>{getTranslation('customer_field_contact_name', language)}:</strong> {header.contact_name ?? '-'}</p>
        <p><strong>{getTranslation('customer_field_contact_phone', language)}:</strong> {header.contact_phone ?? '-'}</p>
        {header.note ? <p><strong>{getTranslation('customer_col_note', language)}:</strong> {header.note}</p> : null}
      </section>

      <CustomerDepositRequestLinesDisplay lines={lines} testId="customer-deposit-print-lines-table" />
    </article>
  );
}
