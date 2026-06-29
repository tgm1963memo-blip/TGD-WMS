import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';

function fmtDate(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return iso; }
}

const TH = { border: '1px solid #bbb', padding: '5px 7px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 };
const TD = { border: '1px solid #bbb', padding: '5px 7px', fontSize: 10 };
const META_LABEL = { fontWeight: 600, fontSize: 12, paddingRight: 8 };
const META_VALUE = { fontSize: 12 };

export function CustomerDepositRequestPrintDocument({
  header,
  lines = [],
  language = 'th',
  branding,
}) {
  if (!header) return null;

  const t = (key) => getTranslation(key, language);

  const hasActual = lines.some((l) => l.actual_boxes != null || l.actual_weight != null);
  const hasLot    = lines.some((l) => l.lot_no || l.mfg_date || l.exp_date);

  const colCount = 7 + (hasLot ? 3 : 0) + (hasActual ? 2 : 0);

  return (
    <article
      className="operational-report-print-document customer-request-print-document"
      data-testid="customer-deposit-print-document"
      style={{ padding: 0 }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10 }}>
        <thead>
          {/* Document header + meta — repeats on every page */}
          <tr>
            <td colSpan={colCount} style={{ padding: '8mm', borderBottom: '2px solid #ccc' }}>
              <DocumentHeader
                branding={branding}
                documentDate={header.created_at ? new Date(header.created_at).toLocaleDateString('en-GB') : '-'}
                documentNo={header.request_no}
                documentTitle={t('customer_deposit_print_title')}
                language={language}
              />

              {/* Document meta */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 12 }}>
                <tbody>
                  <tr>
                    <td style={META_LABEL}>{t('customer_col_status')}:</td>
                    <td style={META_VALUE}>{header.status}</td>
                    <td style={META_LABEL}>{t('customer_field_expected_arrival_date')}:</td>
                    <td style={META_VALUE}>{header.expected_arrival_date ?? '-'}</td>
                  </tr>
                  <tr>
                    <td style={META_LABEL}>{t('customer_field_contact_name')}:</td>
                    <td style={META_VALUE}>{header.contact_name ?? '-'}</td>
                    <td style={META_LABEL}>{t('customer_field_contact_phone')}:</td>
                    <td style={META_VALUE}>{header.contact_phone ?? '-'}</td>
                  </tr>
                  {header.note ? (
                    <tr>
                      <td style={META_LABEL}>{t('customer_col_note')}:</td>
                      <td colSpan={3} style={META_VALUE}>{header.note}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </td>
          </tr>

          {/* Column headers */}
          <tr>
            <th style={{ ...TH, width: '4%', textAlign: 'center' }}>#</th>
            <th style={{ ...TH, width: '12%' }}>{t('catalog_col_customer_code')}</th>
            <th style={{ ...TH, width: hasLot ? '19%' : '25%' }}>{t('catalog_col_product_name')}</th>
            <th style={{ ...TH, width: '9%', textAlign: 'right' }}>{t('customer_col_weight_per_box')}</th>
            <th style={{ ...TH, width: '9%', textAlign: 'right' }}>{t('customer_col_total_deposit_weight')}</th>
            <th style={{ ...TH, width: '7%', textAlign: 'center' }}>{t('customer_col_box_count')}</th>
            {hasLot && <th style={{ ...TH, width: '8%' }}>เลข LOT</th>}
            {hasLot && <th style={{ ...TH, width: '8%', textAlign: 'center' }}>วันผลิต</th>}
            {hasLot && <th style={{ ...TH, width: '8%', textAlign: 'center' }}>วันหมดอายุ</th>}
            {hasActual && <th style={{ ...TH, width: '7%', textAlign: 'center' }}>รับจริง (กล่อง)</th>}
            {hasActual && <th style={{ ...TH, width: '7%', textAlign: 'right' }}>รับจริง (กก.)</th>}
            <th style={{ ...TH, width: hasActual ? '10%' : '14%' }}>{t('customer_col_line_note')}</th>
          </tr>
        </thead>

        <tbody>
          {lines.length ? lines.map((line) => (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td style={{ ...TD, textAlign: 'center' }}>{line.line_no}</td>
              <td style={TD}>{line.customer_product_code ?? '-'}</td>
              <td style={TD}>{line.product_name ?? '-'}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{line.weight_per_box ?? '-'}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{line.expected_weight ?? '-'}</td>
              <td style={{ ...TD, textAlign: 'center' }}>{line.expected_boxes ?? '-'}</td>
              {hasLot && <td style={{ ...TD, fontFamily: 'monospace' }}>{line.lot_no || '-'}</td>}
              {hasLot && <td style={{ ...TD, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(line.mfg_date)}</td>}
              {hasLot && <td style={{ ...TD, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(line.exp_date)}</td>}
              {hasActual && (
                <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: line.actual_boxes != null ? '#16a34a' : undefined }}>
                  {line.actual_boxes ?? '-'}
                </td>
              )}
              {hasActual && (
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: line.actual_weight != null ? '#16a34a' : undefined }}>
                  {line.actual_weight ?? '-'}
                </td>
              )}
              <td style={TD}>{line.note ?? line.actual_note ?? '-'}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={colCount} style={{ ...TD, textAlign: 'center', color: '#888' }}>
                {t('customer_request_detail_lines_empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </article>
  );
}
