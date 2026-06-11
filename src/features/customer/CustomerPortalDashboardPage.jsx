import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { CUSTOMER_PORTAL_DASHBOARD_SUMMARY } from '../../data/customerPortalDemoData.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerPortalDashboardPage() {
  const t = useTranslation();
  const summary = CUSTOMER_PORTAL_DASHBOARD_SUMMARY;

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-portal-page">
      <PageHeader
        title={t('customer_portal_title')}
        description={t('customer_portal_description')}
        actions={<span className="status-badge status-badge--uat">{t('customer_portal_demo_badge')}</span>}
      />

      <CustomerPortalDemoBanner />

      <div className="kpi-grid customer-portal-kpi-grid">
        <div className="card kpi-card info">
          <p className="kpi-label">{t('customer_portal_pending_deposits')}</p>
          <p className="kpi-value">{summary.pendingDepositRequests}</p>
          <p className="kpi-demo-tag">{t('demo_uat_placeholder')}</p>
        </div>
        <div className="card kpi-card success">
          <p className="kpi-label">{t('customer_portal_available_lots')}</p>
          <p className="kpi-value">{summary.availableStockLots}</p>
          <p className="kpi-demo-tag">{t('demo_uat_placeholder')}</p>
        </div>
        <div className="card kpi-card warning">
          <p className="kpi-label">{t('customer_portal_pending_withdrawals')}</p>
          <p className="kpi-value">{summary.pendingWithdrawalRequests}</p>
          <p className="kpi-demo-tag">{t('demo_uat_placeholder')}</p>
        </div>
        <div className="card kpi-card navy">
          <p className="kpi-label">{t('customer_portal_last_activity')}</p>
          <p className="kpi-value customer-portal-activity-text">{summary.lastActivity}</p>
          <p className="kpi-demo-tag">{t('demo_uat_placeholder')}</p>
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
        </div>
      </div>
    </section>
  );
}
