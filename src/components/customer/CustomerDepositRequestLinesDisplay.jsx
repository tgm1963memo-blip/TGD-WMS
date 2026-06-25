import { useTableSort } from '../../hooks/useTableSort.js';
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
  const { sortedData, requestSort, getSortIndicator } = useTableSort(lines);

  const t = useTranslation();

  const hasActual = lines.some((l) => l.actual_boxes != null || l.actual_weight != null);
  const hasLot = lines.some((l) => l.lot_no || l.mfg_date || l.exp_date);

  return (
    <div className="responsive-table">
      <table className="data-table" data-testid={testId}>
        <thead>
          <tr>
            <th onClick={() => requestSort('line_no')} style={{ cursor: 'pointer' }}># {getSortIndicator('line_no')}</th>
            <th onClick={() => requestSort('customer_product_code')} style={{ cursor: 'pointer' }}>{t('catalog_col_customer_code')} {getSortIndicator('customer_product_code')}</th>
            <th onClick={() => requestSort('product_name')} style={{ cursor: 'pointer' }}>{t('catalog_col_product_name')} {getSortIndicator('product_name')}</th>
            <th onClick={() => requestSort('weight_per_box')} style={{ cursor: 'pointer' }}>{t('customer_col_weight_per_box')} {getSortIndicator('weight_per_box')}</th>
            <th onClick={() => requestSort('expected_weight')} style={{ cursor: 'pointer' }}>{t('customer_col_total_deposit_weight')} {getSortIndicator('expected_weight')}</th>
            <th onClick={() => requestSort('expected_boxes')} style={{ cursor: 'pointer' }}>{t('customer_col_box_count')} {getSortIndicator('expected_boxes')}</th>
            {hasLot && <th onClick={() => requestSort('lot_no')} style={{ cursor: 'pointer' }}>เลข LOT {getSortIndicator('lot_no')}</th>}
            {hasLot && <th onClick={() => requestSort('mfg_date')} style={{ cursor: 'pointer' }}>วันผลิต {getSortIndicator('mfg_date')}</th>}
            {hasLot && <th onClick={() => requestSort('exp_date')} style={{ cursor: 'pointer' }}>วันหมดอายุ {getSortIndicator('exp_date')}</th>}
            {hasActual && <th onClick={() => requestSort('actual_boxes')} style={{ cursor: 'pointer' }}>รับจริง (กล่อง) {getSortIndicator('actual_boxes')}</th>}
            {hasActual && <th onClick={() => requestSort('actual_weight')} style={{ cursor: 'pointer' }}>รับจริง (กก.) {getSortIndicator('actual_weight')}</th>}
            <th onClick={() => requestSort('note')} style={{ cursor: 'pointer' }}>{t('customer_col_line_note')} {getSortIndicator('note')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.length ? sortedData.map((line) => (
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
