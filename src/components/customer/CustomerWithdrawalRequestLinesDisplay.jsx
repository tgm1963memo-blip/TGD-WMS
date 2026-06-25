import { useTableSort } from '../../hooks/useTableSort.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatRequestWeight } from '../../utils/customerRequestCancelUtils.js';

export function CustomerWithdrawalRequestLinesDisplay({
  lines = [],
  testId = 'customer-withdrawal-lines-display-table',
}) {
  const { sortedData, requestSort, getSortIndicator } = useTableSort(lines);

  const t = useTranslation();

  return (
    <div className="responsive-table">
      <table className="data-table" data-testid={testId}>
        <thead>
          <tr>
            <th onClick={() => requestSort('line_no')} style={{ cursor: 'pointer' }}># {getSortIndicator('line_no')}</th>
            <th>{t('catalog_col_customer_code')}</th>
            <th onClick={() => requestSort('product_name')} style={{ cursor: 'pointer' }}>{t('catalog_col_product_name')} {getSortIndicator('product_name')}</th>
            <th>{t('customer_col_requested_qty')}</th>
            <th>{t('customer_col_requested_boxes')}</th>
            <th>{t('customer_col_requested_weight')}</th>
            <th>{t('customer_col_picking_rule')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.length ? sortedData.map((line) => (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td>{line.line_no}</td>
              <td>{line.customer_product_code ?? '-'}</td>
              <td>{line.product_name ?? '-'}</td>
              <td>{line.requested_qty ?? '-'}</td>
              <td>{line.requested_boxes ?? '-'}</td>
              <td>{formatRequestWeight(line.requested_weight)}</td>
              <td>{line.picking_rule ?? '-'}</td>
            </tr>
          )) : (
            <tr><td colSpan={7}>{t('customer_request_detail_lines_empty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
