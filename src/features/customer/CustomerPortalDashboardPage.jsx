import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { getCustomerPortalDashboardSummary } from '../../services/customerPortalDashboardService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { AdminCustomerPortalSwitcher } from '../../components/customer/AdminCustomerPortalSwitcher.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerPortalDashboardPage() {
  const t = useTranslation();
  const { customerId, isRequestProxy, loading: profileLoading, error: profileError } = useCustomerPortalProfile();
  const [state, setState] = useState({ summary: null, loading: true, error: null });

  useEffect(() => {
    let active = true;

    if (profileLoading) return undefined;

    if (!customerId) {
      setState({ summary: null, loading: false, error: null });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    getCustomerPortalDashboardSummary(customerId).then((result) => {
      if (!active) return;
      setState({
        summary: result.data,
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
      <section className="page-shell customer-portal-page" data-testid="customer-portal-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  const summary = state.summary ?? {
    pendingDepositRequests: 0,
    pendingWithdrawalRequests: 0,
    availableStockLots: 0,
    lastActivity: '-',
  };

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-portal-page">
      <PageHeader
        title={t('customer_portal_title')}
        description={t('customer_portal_description')}
        actions={
          <>
            {isRequestProxy && <AdminCustomerPortalSwitcher />}
            <span className="status-badge status-badge--open">{t('customer_portal_live_badge')}</span>
          </>
        }
      />

      <CustomerPortalLiveBanner />

      {profileError || state.error ? (
        <div className="banner banner-danger" role="alert">{profileError?.message ?? state.error?.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      {!customerId ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}

      <div className="kpi-grid customer-portal-kpi-grid">
        <div className="card kpi-card info">
          <p className="kpi-label">{t('customer_portal_pending_deposits')}</p>
          <p className="kpi-value">{summary.pendingDepositRequests}</p>
        </div>
        <div className="card kpi-card success">
          <p className="kpi-label">{t('customer_portal_available_lots')}</p>
          <p className="kpi-value">{summary.availableStockLots}</p>
        </div>
        <div className="card kpi-card warning">
          <p className="kpi-label">{t('customer_portal_pending_withdrawals')}</p>
          <p className="kpi-value">{summary.pendingWithdrawalRequests}</p>
        </div>
        <div className="card kpi-card navy">
          <p className="kpi-label">{t('customer_portal_last_activity')}</p>
          <p className="kpi-value customer-portal-activity-text">{summary.lastActivity}</p>
        </div>
      </div>

      <div className="customer-portal-quick-actions">
        <h3 className="section-card-title">{t('customer_portal_quick_actions')}</h3>
        <div className="customer-portal-action-grid">
          <Link className="card customer-portal-action-card" data-testid="customer-deposit-request-link" to="/customer/deposit-request">
            <strong>{t('customer_portal_deposit_request')}</strong>
            <p>{t('customer_portal_deposit_request_hint')}</p>
          </Link>
          <Link className="card customer-portal-action-card" data-testid="customer-stock-balance-link" to="/customer/stock-balance">
            <strong>{t('customer_portal_stock_balance')}</strong>
            <p>{t('customer_portal_stock_balance_hint')}</p>
          </Link>
          <Link className="card customer-portal-action-card" data-testid="customer-withdrawal-request-link" to="/customer/withdrawal-request">
            <strong>{t('customer_portal_withdrawal_request')}</strong>
            <p>{t('customer_portal_withdrawal_request_hint')}</p>
          </Link>
          <Link className="card customer-portal-action-card" data-testid="customer-request-history-link" to="/customer/requests">
            <strong>{t('customer_portal_request_history')}</strong>
            <p>{t('customer_portal_request_history_hint')}</p>
          </Link>
          <Link className="card customer-portal-action-card" data-testid="customer-product-catalog-link" to="/customer/product-catalog">
            <strong>{t('customer_portal_product_catalog')}</strong>
            <p>{t('customer_portal_product_catalog_hint')}</p>
          </Link>
          <Link className="card customer-portal-action-card" data-testid="customer-movement-ledger-link" to="/customer/movement-ledger">
            <strong>{t('customer_portal_movement_ledger')}</strong>
            <p>{t('customer_portal_movement_ledger_hint')}</p>
          </Link>
        </div>
      </div>
    </section>
  );
}
