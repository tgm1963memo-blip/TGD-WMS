import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState } from '../ui/LoadingState.jsx';
import { listCustomerDepositRequests } from '../../services/customerDepositRequestService.js';
import { getCustomerRequestStatusClass } from './customerRequestStatus.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const WAREHOUSE_DEPOSIT_STATUSES = [
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_RECEIVING',
  'PALLETIZING',
  'COUNT_VARIANCE_REVIEW',
  'ADMIN_RECOUNT_REQUESTED',
  'RECEIVED_CONFIRMED',
  'CUSTOMER_NOTIFIED',
];

export function CustomerDepositNotificationsSection({ testId = 'receiving-customer-deposit-section' }) {
  const t = useTranslation();
  const [state, setState] = useState({ rows: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listCustomerDepositRequests({ statusIn: WAREHOUSE_DEPOSIT_STATUSES }).then((result) => {
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
  }, []);

  if (state.loading) {
    return <LoadingState message={t('customer_portal_loading')} />;
  }

  return (
    <section className="table-card customer-deposit-notifications-section" data-testid={testId}>
      <div className="table-card-header">
        <h3>{t('receiving_customer_deposit_section_title')}</h3>
        <span className="form-helper">{t('receiving_customer_deposit_section_hint')}</span>
      </div>

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      <div className="responsive-table">
        <table className="data-table" data-testid="receiving-customer-deposit-table">
          <thead>
            <tr>
              <th>{t('customer_col_request_no')}</th>
              <th>{t('customer_col_status')}</th>
              <th>{t('customer_field_expected_arrival_date')}</th>
              <th>{t('customer_field_contact_name')}</th>
              <th>{t('customer_field_contact_phone')}</th>
              <th>{t('customer_col_note')}</th>
              <th>{t('catalog_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.length ? state.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.request_no}</td>
                <td>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.expected_arrival_date ?? '-'}</td>
                <td>{row.contact_name ?? '-'}</td>
                <td>{row.contact_phone ?? '-'}</td>
                <td>{row.note || '-'}</td>
                <td>
                  <Link
                    className="btn btn-secondary btn-sm"
                    data-testid={`receiving-review-deposit-${row.id}`}
                    to={`/customer/admin/deposit-review/${row.id}`}
                  >
                    {t('receiving_review_deposit_button')}
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7}>{t('receiving_customer_deposit_empty')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
