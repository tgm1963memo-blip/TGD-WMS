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
            <th>{t('customer_col_confirmed_boxes')}</th>
            <th>{t('customer_col_confirmed_weight')}</th>
            <th>{t('customer_col_picking_rule')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.length ? sortedData.map((line) => {
            // picked_boxes/weight is only set once a recount/pick has been
            // recorded — it's the CONFIRMED quantity and can legitimately
            // differ from what was originally requested (e.g. a recount
            // finding fewer boxes than requested). Show '-' until then
            // rather than silently repeating the requested figure, so it's
            // clear whether a line has actually been confirmed yet.
            const hasConfirmedBoxes = line.picked_boxes != null;
            const hasConfirmedWeight = line.picked_weight != null;
            return (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td>{line.line_no}</td>
              <td>{line.customer_product_code ?? '-'}</td>
              <td>{line.product_name ?? '-'}</td>
              <td>{line.requested_qty ?? '-'}</td>
              <td>
                {line.requested_boxes ?? '-'}
                {line.entry_unit_code && line.entry_unit_qty != null && (
                  <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>
                    ({line.entry_unit_qty} {line.entry_unit_code})
                  </div>
                )}
              </td>
              <td>{formatRequestWeight(line.requested_weight)}</td>
              <td>{hasConfirmedBoxes ? line.picked_boxes : '-'}</td>
              <td>{hasConfirmedWeight ? formatRequestWeight(line.picked_weight) : '-'}</td>
              <td>{line.picking_rule ?? '-'}</td>
            </tr>
            );
          }) : (
            <tr><td colSpan={9}>{t('customer_request_detail_lines_empty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
