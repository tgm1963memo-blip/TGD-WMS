import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';

export function CustomerDepositStaffWorkOrderPrint({
  header,
  lines = [],
  language = 'th',
  branding,
}) {
  if (!header) return null;

  return (
    <article className="operational-report-print-document customer-staff-work-order-print" data-testid="customer-deposit-staff-work-order-print">
      <DocumentHeader
        branding={branding}
        documentDate={header.expected_arrival_date ?? '-'}
        documentNo={header.request_no}
        documentTitle={getTranslation('customer_deposit_staff_work_order_title', language)}
        language={language}
      />

      <section className="customer-request-print-meta">
        <p><strong>{getTranslation('customer_field_contact_name', language)}:</strong> {header.contact_name ?? '-'}</p>
        <p><strong>{getTranslation('customer_field_contact_phone', language)}:</strong> {header.contact_phone ?? '-'}</p>
      </section>

      <table className="data-table operational-report-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{getTranslation('catalog_col_product_name', language)}</th>
            <th>{getTranslation('customer_field_lot_no', language)}</th>
            <th>{getTranslation('customer_col_mfg_date', language)}</th>
            <th>{getTranslation('customer_col_exp_date', language)}</th>
            <th>{getTranslation('customer_col_expected_qty', language)}</th>
            <th>{getTranslation('customer_col_expected_weight', language)}</th>
            <th>{getTranslation('catalog_col_argent', language)}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id ?? line.line_no}>
              <td>{line.line_no}</td>
              <td>{line.product_name ?? '-'}</td>
              <td>{line.lot_no ?? '-'}</td>
              <td>{line.mfg_date ?? '-'}</td>
              <td>{line.exp_date ?? '-'}</td>
              <td>{line.expected_qty ?? '-'}</td>
              <td>{line.expected_weight ?? '-'}</td>
              <td>{line.argent_type ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="form-helper">{getTranslation('customer_deposit_argent_sticker_hint', language)}</p>
    </article>
  );
}
