import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatRequestWeight } from '../../utils/customerRequestCancelUtils.js';

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return iso; }
}

export function CustomerDepositRequestLinesDisplay({
  lines = [],
  testId = 'customer-deposit-lines-display-table',
}) {
  const t = useTranslation();

  const hasActual = lines.some((l) => l.actual_boxes != null || l.actual_weight != null);
  const hasLot = lines.some((l) => l.lot_no || l.mfg_date || l.exp_date);

  return (
    <div className="responsive-table">
      <table className="data-table" data-testid={testId}>
        <thead>
          <tr>
            <th>#</th>
            <th>{t('catalog_col_customer_code')}</th>
            <th>{t('catalog_col_product_name')}</th>
            <th>{t('customer_col_weight_per_box')}</th>
            <th>{t('customer_col_total_deposit_weight')}</th>
            <th>{t('customer_col_box_count')}</th>
            {hasLot && <th>เลข LOT</th>}
            {hasLot && <th>วันผลิต</th>}
            {hasLot && <th>วันหมดอายุ</th>}
            {hasActual && <th>รับจริง (กล่อง)</th>}
            {hasActual && <th>รับจริง (กก.)</th>}
            <th>{t('customer_col_line_note')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? lines.map((line) => (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td>{line.line_no}</td>
              <td>{line.customer_product_code ?? '-'}</td>
              <td>{line.product_name ?? '-'}</td>
              <td>{formatRequestWeight(line.weight_per_box)}</td>
              <td>{formatRequestWeight(line.expected_weight)}</td>
              <td>{line.expected_boxes ?? '-'}</td>
              {hasLot && <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{line.lot_no || '-'}</td>}
              {hasLot && <td style={{ whiteSpace: 'nowrap' }}>{formatDate(line.mfg_date)}</td>}
              {hasLot && <td style={{ whiteSpace: 'nowrap' }}>{formatDate(line.exp_date)}</td>}
              {hasActual && (
                <td style={{ fontWeight: 700, color: line.actual_boxes != null ? 'var(--tgd-success, #22c55e)' : undefined }}>
                  {line.actual_boxes != null ? line.actual_boxes : '-'}
                </td>
              )}
              {hasActual && (
                <td style={{ fontWeight: 700, color: line.actual_weight != null ? 'var(--tgd-success, #22c55e)' : undefined }}>
                  {line.actual_weight != null ? line.actual_weight : '-'}
                </td>
              )}
              <td>{line.note ?? line.actual_note ?? '-'}</td>
            </tr>
          )) : (
            <tr><td colSpan={7 + (hasLot ? 3 : 0) + (hasActual ? 2 : 0)}>{t('customer_request_detail_lines_empty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
