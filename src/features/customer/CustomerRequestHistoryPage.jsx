import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { CUSTOMER_PORTAL_DEMO_REQUEST_HISTORY } from '../../data/customerPortalDemoData.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

function statusBadgeClass(status) {
  if (status === 'DRAFT') return 'draft';
  if (status === 'SUBMITTED') return 'open';
  return 'hold';
}

export function CustomerRequestHistoryPage() {
  const t = useTranslation();

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-request-history-page">
      <PageHeader title={t('customer_request_history_title')} description={t('customer_request_history_description')} />

      <CustomerPortalDemoBanner />

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_request_history_table_title')}</h3>
          <span className="status-badge status-badge--uat">{t('customer_demo_data_badge')}</span>
        </div>
        <div className="responsive-table">
          <table className="data-table" data-testid="customer-request-history-table">
            <thead>
              <tr>
                <th>{t('customer_col_request_no')}</th>
                <th>{t('customer_col_request_type')}</th>
                <th>{t('customer_col_status')}</th>
                <th>{t('customer_col_requested_date')}</th>
                <th>{t('customer_col_note')}</th>
              </tr>
            </thead>
            <tbody>
              {CUSTOMER_PORTAL_DEMO_REQUEST_HISTORY.map((row) => (
                <tr key={row.request_no}>
                  <td>{row.request_no}</td>
                  <td>{row.request_type}</td>
                  <td><span className={`status-badge status-badge--${statusBadgeClass(row.status)}`}>{row.status}</span></td>
                  <td>{row.requested_date}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
