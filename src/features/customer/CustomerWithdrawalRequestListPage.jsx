import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getWithdrawalStatusLabel } from '../../utils/customerWithdrawalStatusLabels.js';
import { listCustomerWithdrawalRequests } from '../../services/customerWithdrawalRequestService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { buildCustomerRequestCopyPath } from '../../utils/customerRequestCopyUtils.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerWithdrawalRequestListPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests, isRequestProxy, loading: profileLoading } = useCustomerPortalProfile();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [customerNames, setCustomerNames] = useState({});

  useEffect(() => {
    let active = true;

    if (profileLoading) return undefined;

    if (!isRequestProxy && !customerId) {
      setState({ rows: [], loading: false, error: null });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    const filters = isRequestProxy ? {} : { customerId };

    listCustomerWithdrawalRequests(filters).then((result) => {
      if (!active) return;
      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
      });
    });

    if (isRequestProxy) {
      getCustomers().then((result) => {
        if (!active) return;
        const names = {};
        (result.data ?? []).forEach((customer) => {
          names[customer.id] = customer.name ?? customer.code ?? customer.id;
        });
        setCustomerNames(names);
      });
    }

    return () => {
      active = false;
    };
  }, [customerId, profileLoading, isRequestProxy]);

  const columnCount = isRequestProxy ? 9 : 8;

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-page">
      <PageHeader
        title={t('customer_withdrawal_title')}
        description={isRequestProxy ? t('customer_withdrawal_list_proxy_description') : t('customer_withdrawal_list_description')}
        actions={canWriteCustomerRequests ? (
          <Link className="btn btn-primary" data-testid="customer-withdrawal-create-button" to="/customer/withdrawal-request/new">
            {t('customer_withdrawal_create_button')}
          </Link>
        ) : null}
      />
      <CustomerPortalLiveBanner />

      {isRequestProxy ? (
        <div className="banner banner-info" role="status">{t('customer_request_proxy_scope_banner')}</div>
      ) : null}

      {!isRequestProxy && !customerId ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_withdrawal_list_title')}</h3>
        </div>
        {(profileLoading || state.loading) ? <LoadingState message={t('customer_portal_loading')} /> : null}
        <div className="responsive-table">
          <table className="data-table" data-testid="customer-withdrawal-list-table">
            <thead>
              <tr>
                <th>{t('customer_col_request_no')}</th>
                {isRequestProxy ? <th>{t('customer_col_customer_name')}</th> : null}
                <th>{t('customer_col_status')}</th>
                <th>{t('customer_field_requested_dispatch_date')}</th>
                <th>{t('customer_field_delivery_type')}</th>
                <th>{t('customer_field_pickup_contact')}</th>
                <th>{t('customer_col_note')}</th>
                <th>{t('customer_history_latest_action')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.length ? state.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.withdrawal_no}</td>
                  {isRequestProxy ? <td>{customerNames[row.customer_id] ?? row.customer_id ?? '-'}</td> : null}
                  <td>
                    <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                      {getWithdrawalStatusLabel(row.status, t)}
                    </span>
                  </td>
                  <td>{row.requested_dispatch_date ?? '-'}</td>
                  <td>{row.delivery_type ?? '-'}</td>
                  <td>{row.pickup_contact ?? '-'}</td>
                  <td>{row.note || '-'}</td>
                  <td>
                    <small>{row.last_action_at ? new Date(row.last_action_at).toLocaleString() : '-'}</small>
                  </td>
                  <td>
                    <div className="action-row action-row--table">
                      <Link
                        className="btn btn-secondary btn-sm"
                        data-testid={`customer-withdrawal-view-${row.id}`}
                        to={`/customer/withdrawal-request/${row.id}`}
                      >
                        {t('customer_request_view_button')}
                      </Link>
                      {canWriteCustomerRequests ? (
                        <Link
                          className="btn btn-secondary btn-sm"
                          data-testid={`customer-withdrawal-copy-${row.id}`}
                          to={buildCustomerRequestCopyPath('/customer/withdrawal-request/new', row.id)}
                        >
                          {t('customer_request_copy_button')}
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={columnCount}>{t('customer_withdrawal_list_empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
