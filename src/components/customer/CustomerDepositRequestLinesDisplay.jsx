import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatRequestWeight } from '../../utils/customerRequestCancelUtils.js';

export function CustomerDepositRequestLinesDisplay({
  lines = [],
  testId = 'customer-deposit-lines-display-table',
}) {
  const t = useTranslation();

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
              <td>{line.note ?? '-'}</td>
            </tr>
          )) : (
            <tr><td colSpan={7}>{t('customer_request_detail_lines_empty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
