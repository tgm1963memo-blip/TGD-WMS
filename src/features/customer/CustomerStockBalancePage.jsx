import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { getCustomerStorageBalanceRows } from '../../services/customerStorageBalanceReportService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

function statusBadgeClass(qtyAvailable) {
  return Number(qtyAvailable) > 0 ? 'open' : 'hold';
}

export function CustomerStockBalancePage() {
  const t = useTranslation();
  const { customerId, loading: profileLoading } = useCustomerPortalProfile();
  const [state, setState] = useState({ rows: [], loading: true, error: null });

  useEffect(() => {
    let active = true;

    if (profileLoading) return undefined;

    if (!customerId) {
      setState({ rows: [], loading: false, error: null });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    getCustomerStorageBalanceRows({ customerId }).then((result) => {
      if (!active) return;
      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => {
      active = false;
    };
  }, [customerId, profileLoading]);

  if (profileLoading || state.loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-stock-balance-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-stock-balance-page">
      <PageHeader
        title={t('customer_stock_balance_title')}
        description={t('customer_stock_balance_description')}
        actions={<span className="status-badge status-badge--open" data-testid="customer-stock-live-badge">{t('customer_live_data_badge')}</span>}
      />

      <CustomerPortalLiveBanner />

      {!customerId ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_stock_balance_table_title')}</h3>
          <span className="status-badge status-badge--open">{t('customer_live_data_badge')}</span>
        </div>
        <div className="responsive-table">
          <table className="data-table" data-testid="customer-stock-balance-table">
            <thead>
              <tr>
                <th>{t('customer_col_product_code')}</th>
                <th>{t('customer_col_lot_no')}</th>
                <th>{t('customer_col_pallet_no')}</th>
                <th>{t('customer_col_location')}</th>
                <th>{t('customer_col_available_qty')}</th>
                <th>{t('customer_col_uom')}</th>
                <th>{t('customer_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.length ? state.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.product_id ?? '-'}</td>
                  <td>{row.lot_id ?? '-'}</td>
                  <td>{row.pallet_id ?? '-'}</td>
                  <td>{row.location_id ?? '-'}</td>
                  <td>{row.qty_available ?? 0}</td>
                  <td>{row.uom ?? '-'}</td>
                  <td>
                    <span className={`status-badge status-badge--${statusBadgeClass(row.qty_available)}`}>
                      {Number(row.qty_available) > 0 ? 'AVAILABLE' : 'EMPTY'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>{t('customer_portal_empty_rows')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
