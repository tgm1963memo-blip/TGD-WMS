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
            <th>{t('catalog_col_barcode')}</th>
            <th>{t('customer_field_lot_no')}</th>
            <th>{t('customer_col_mfg_date')}</th>
            <th>{t('customer_col_exp_date')}</th>
            <th>{t('customer_col_expected_qty')}</th>
            <th>{t('customer_col_expected_boxes')}</th>
            <th>{t('customer_col_expected_weight')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? lines.map((line) => (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td>{line.line_no}</td>
              <td>{line.customer_product_code ?? '-'}</td>
              <td>{line.product_name ?? '-'}</td>
              <td>{line.internal_product_code || line.customer_product_code || '-'}</td>
              <td>{line.lot_no ?? '-'}</td>
              <td>{line.mfg_date ?? '-'}</td>
              <td>{line.exp_date ?? '-'}</td>
              <td>{line.expected_qty ?? '-'}</td>
              <td>{line.expected_boxes ?? '-'}</td>
              <td>{formatRequestWeight(line.expected_weight)}</td>
            </tr>
          )) : (
            <tr><td colSpan={10}>{t('customer_request_detail_lines_empty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
