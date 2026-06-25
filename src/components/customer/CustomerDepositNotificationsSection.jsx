import { useEffect, useState } from 'react';
import { LoadingState } from '../ui/LoadingState.jsx';
import { listCustomerDepositRequests } from '../../services/customerDepositRequestService.js';
import { getCustomerRequestStatusClass } from './customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { CustomerDepositDetailModal } from './CustomerDepositDetailModal.jsx';

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
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailId, setDetailId] = useState(null);

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

  const filteredRows = state.rows.filter((row) => {
    const text = filterText.toLowerCase();
    const matchText = !text ||
      (row.request_no ?? '').toLowerCase().includes(text) ||
      (row.contact_name ?? '').toLowerCase().includes(text);
    const matchStatus = !filterStatus || row.status === filterStatus;
    return matchText && matchStatus;
  });

  return (
    <section className="table-card customer-deposit-notifications-section" data-testid={testId}>
      <div className="table-card-header">
        <h3>{t('receiving_customer_deposit_section_title')}</h3>
        <span className="form-helper">{t('receiving_customer_deposit_section_hint')}</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '16px 20px' }}>
        <label className="form-label" style={{ margin: 0, flex: '1 1 200px', maxWidth: 360 }}>
          {'ค้นหา'}
          <input
            className="form-control"
            type="search"
            placeholder="เลขที่คำขอ / ชื่อผู้ติดต่อ"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </label>
        <label className="form-label" style={{ margin: 0, flex: '1 1 180px', maxWidth: 280 }}>
          {'สถานะ'}
          <select
            className="form-control"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            {WAREHOUSE_DEPOSIT_STATUSES.map((s) => (
              <option key={s} value={s}>{getDepositStatusLabel(s, t)}</option>
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
        <table className="data-table" data-testid="receiving-customer-deposit-table">
          <thead>
            <tr>
              <th>{t('customer_col_request_no')}</th>
              <th>{t('customer_col_customer_name') ?? 'ลูกค้า'}</th>
              <th>{t('customer_col_status')}</th>
              <th>{t('customer_field_expected_arrival_date')}</th>
              <th>{t('customer_field_contact_name')}</th>
              <th>{t('customer_field_contact_phone')}</th>
              <th>{t('customer_col_note')}</th>
              <th>{t('catalog_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? filteredRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <a className="table-action-link" href={`/customer/deposit-request/${row.id}`} onClick={(e) => {
                    e.preventDefault();
                    setDetailId(row.id);
                  }}>{row.request_no}</a>
                </td>
                <td>{row.customer?.customer_name || row.customer?.name || row.customer_id || '-'}</td>
                <td>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {getDepositStatusLabel(row.status, t)}
                  </span>
                </td>
                <td>{row.expected_arrival_date ?? '-'}</td>
                <td>{row.contact_name ?? '-'}</td>
                <td>{row.contact_phone ?? '-'}</td>
                <td>{row.note || '-'}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    data-testid={`receiving-review-deposit-${row.id}`}
                    type="button"
                    onClick={() => setDetailId(row.id)}
                  >
                    {t('receiving_review_deposit_button')}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7}>
                  {filterText || filterStatus
                    ? 'ไม่พบรายการที่ตรงกับเงื่อนไข'
                    : t('receiving_customer_deposit_empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomerDepositDetailModal
        requestId={detailId}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onStatusChange={(id, newStatus) => {
          setState((prev) => ({
            ...prev,
            rows: prev.rows.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
          }));
        }}
      />
    </section>
  );
}
