import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { CUSTOMER_PORTAL_DEMO_STOCK_ROWS } from '../../data/customerPortalDemoData.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerStockBalancePage() {
  const t = useTranslation();

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-stock-balance-page">
      <PageHeader
        title={t('customer_stock_balance_title')}
        description={t('customer_stock_balance_description')}
        actions={<span className="status-badge status-badge--hold" data-testid="customer-stock-demo-badge">{t('customer_demo_data_badge')}</span>}
      />

      <CustomerPortalDemoBanner />

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_stock_balance_table_title')}</h3>
          <span className="status-badge status-badge--uat">{t('customer_demo_data_badge')}</span>
        </div>
        <div className="responsive-table">
          <table className="data-table" data-testid="customer-stock-balance-table">
            <thead>
              <tr>
                <th>{t('customer_col_product_code')}</th>
                <th>{t('customer_col_product_name')}</th>
                <th>{t('customer_col_lot_no')}</th>
                <th>{t('customer_col_pallet_no')}</th>
                <th>{t('customer_col_location')}</th>
                <th>{t('customer_col_available_qty')}</th>
                <th>{t('customer_col_uom')}</th>
                <th>{t('customer_col_net_weight')}</th>
                <th>{t('customer_col_expiry_date')}</th>
                <th>{t('customer_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {CUSTOMER_PORTAL_DEMO_STOCK_ROWS.map((row) => (
                <tr key={`${row.product_code}-${row.lot_no}-${row.pallet_no}`}>
                  <td>{row.product_code}</td>
                  <td>{row.product_name}</td>
                  <td>{row.lot_no}</td>
                  <td>{row.pallet_no}</td>
                  <td>{row.location}</td>
                  <td>{row.available_qty}</td>
                  <td>{row.uom}</td>
                  <td>{row.net_weight}</td>
                  <td>{row.expiry_date}</td>
                  <td><span className={`status-badge status-badge--${row.status === 'AVAILABLE' ? 'open' : 'hold'}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
