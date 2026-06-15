import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { listCustomerPortalRequestHistory } from '../../services/customerPortalRequestHistoryService.js';
import { listCustomerDocumentTimelineEvents } from '../../services/customerDocumentTimelineService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

function statusBadgeClass(status) {
  if (status === 'DRAFT' || status === 'WITHDRAWAL_DRAFT') return 'draft';
  if (status === 'SUBMITTED_BY_CUSTOMER' || status === 'ADMIN_REVIEWING') return 'open';
  return 'hold';
}

function RequestTimelineCell({ documentType, documentId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let active = true;
    if (!documentId) return undefined;

    listCustomerDocumentTimelineEvents(documentType, documentId).then((result) => {
      if (!active) return;
      setEvents(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, [documentId, documentType]);

  if (!events.length) {
    return <span>-</span>;
  }

  return (
    <ol className="customer-request-mini-timeline" data-testid="customer-request-status-timeline">
      {events.map((event) => (
        <li key={event.id}>{event.action} ({event.to_status ?? event.from_status ?? '-'})</li>
      ))}
    </ol>
  );
}

export function CustomerRequestHistoryPage() {
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

    listCustomerPortalRequestHistory(customerId).then((result) => {
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
      <section className="page-shell customer-portal-page" data-testid="customer-request-history-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-request-history-page">
      <PageHeader title={t('customer_request_history_title')} description={t('customer_request_history_description')} />
      <CustomerPortalLiveBanner />

      {!customerId ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_request_history_table_title')}</h3>
          <span className="status-badge status-badge--open">{t('customer_live_data_badge')}</span>
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
                <th>Latest action / updated</th>
                <th>Status timeline</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.length ? state.rows.map((row) => (
                <tr key={`${row.request_type}-${row.request_no}`}>
                  <td>{row.request_no}</td>
                  <td>{row.request_type}</td>
                  <td><span className={`status-badge status-badge--${statusBadgeClass(row.status)}`}>{row.status}</span></td>
                  <td>{row.requested_date}</td>
                  <td>{row.note}</td>
                  <td>
                    {row.latest_action_note}
                    <br />
                    <small>{row.last_updated_at ? new Date(row.last_updated_at).toLocaleString() : '-'}</small>
                  </td>
                  <td>
                    <RequestTimelineCell documentId={row.id} documentType={row.document_type} />
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
