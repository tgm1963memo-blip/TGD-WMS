import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState } from '../ui/LoadingState.jsx';
import { listCustomerWithdrawalRequests } from '../../services/customerWithdrawalRequestService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { buildCustomerRequestCopyPath } from '../../utils/customerRequestCopyUtils.js';
import { getCustomerRequestStatusClass } from './customerRequestStatus.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

const ALL_WITHDRAWAL_STATUSES = [
  'WITHDRAWAL_DRAFT',
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_PICKING',
  'REJECTED',
  'COMPLETED',
  'DISPATCHED',
];

export function CustomerWithdrawalNotificationsSection({
  testId = 'withdrawal-customer-withdrawal-section',
  showCustomerColumn = true,
  showCopyAction = true,
}) {
  const t = useTranslation();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [customerNames, setCustomerNames] = useState({});
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listCustomerWithdrawalRequests().then((result) => {
      if (!active) return;
      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
      });
    });

    if (showCustomerColumn) {
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
  }, [showCustomerColumn]);

  if (state.loading) {
    return <LoadingState message={t('customer_portal_loading')} />;
  }

  const filteredRows = state.rows.filter((row) => {
    const text = filterText.toLowerCase();
    const matchText = !text ||
      (row.withdrawal_no ?? '').toLowerCase().includes(text) ||
      (row.pickup_contact ?? '').toLowerCase().includes(text) ||
      (customerNames[row.customer_id] ?? '').toLowerCase().includes(text);
    const matchStatus = !filterStatus || row.status === filterStatus;
    return matchText && matchStatus;
  });

  const columnCount = 8 + (showCustomerColumn ? 1 : 0) + (showCopyAction ? 1 : 0);

  return (
    <section className="table-card customer-withdrawal-notifications-section" data-testid={testId}>
      <div className="table-card-header">
        <h3>{t('withdrawal_customer_withdrawal_section_title')}</h3>
        <span className="form-helper">{t('withdrawal_customer_withdrawal_section_hint')}</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 16px' }}>
        <label className="form-label" style={{ margin: 0, flex: '1 1 200px' }}>
          {'ค้นหา'}
          <input
            className="form-control"
            type="search"
            placeholder="เลขที่คำขอ / ผู้ติดต่อ / ลูกค้า"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </label>
        <label className="form-label" style={{ margin: 0, flex: '1 1 180px' }}>
          {'สถานะ'}
          <select
            className="form-control"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            {ALL_WITHDRAWAL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        {(filterText || filterStatus) ? (
          <button
            type="button"
            className="btn"
            onClick={() => { setFilterText(''); setFilterStatus(''); }}
            style={{ alignSelf: 'flex-end', background: '#f0f4f8', border: '1px solid var(--tgd-border)' }}
          >
            {'ล้างตัวกรอง'}
          </button>
        ) : null}
      </div>

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      <div className="responsive-table">
        <table className="data-table" data-testid="withdrawal-customer-withdrawal-table">
          <thead>
            <tr>
              <th>{t('customer_col_request_no')}</th>
              {showCustomerColumn ? <th>{t('customer_col_customer_name')}</th> : null}
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
            {filteredRows.length ? filteredRows.map((row) => (
              <tr key={row.id}>
                <td>{row.withdrawal_no}</td>
                {showCustomerColumn ? <td>{customerNames[row.customer_id] ?? row.customer_id ?? '-'}</td> : null}
                <td>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.requested_dispatch_date ?? '-'}</td>
                <td>{row.delivery_type ?? '-'}</td>
                <td>{row.pickup_contact ?? '-'}</td>
                <td>{row.note || '-'}</td>
                <td>
                  <small>{formatDocumentDate(row.last_action_at)}</small>
                </td>
                <td>
                  <div className="action-row">
                    <Link
                      className="btn btn-secondary btn-sm"
                      data-testid={`withdrawal-review-customer-${row.id}`}
                      to="/customer/admin/withdrawal-review"
                    >
                      {t('withdrawal_review_customer_button')}
                    </Link>
                    {showCopyAction ? (
                      <Link
                        className="btn btn-secondary btn-sm"
                        data-testid={`withdrawal-copy-customer-${row.id}`}
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
                <td colSpan={columnCount}>
                  {filterText || filterStatus
                    ? 'ไม่พบรายการที่ตรงกับเงื่อนไข'
                    : t('withdrawal_customer_withdrawal_empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
