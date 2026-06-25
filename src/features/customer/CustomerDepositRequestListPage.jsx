import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { listCustomerDepositRequests, cancelCustomerDepositRequest } from '../../services/customerDepositRequestService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { buildCustomerRequestCopyPath } from '../../utils/customerRequestCopyUtils.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerDepositRequestListPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests, isRequestProxy, loading: profileLoading } = useCustomerPortalProfile();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [customerNames, setCustomerNames] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const PAGE_SIZE = 5;
  const { sortedData, requestSort, getSortIndicator } = useTableSort(state.rows);

  useEffect(() => {
    let active = true;

    if (profileLoading) return undefined;

    if (!isRequestProxy && !customerId) {
      setState({ rows: [], loading: false, error: null });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    const filters = isRequestProxy ? {} : { customerId };

    listCustomerDepositRequests(filters).then((result) => {
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
          names[customer.id] = customer.customer_name ?? customer.customer_code ?? customer.id;
        });
        setCustomerNames(names);
      });
    }

    return () => {
      active = false;
    };
  }, [customerId, profileLoading, isRequestProxy]);

  const columnCount = isRequestProxy ? 9 : 8;
  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pagedData = sortedData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const DELETABLE_STATUSES = new Set(['DRAFT', 'WITHDRAWAL_DRAFT', 'DEPOSIT_DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING']);

  async function handleDelete(requestId) {
    setDeleting(true);
    const result = await cancelCustomerDepositRequest(requestId, 'ลบโดยผู้ใช้งาน');
    setDeleting(false);
    setDeleteConfirmId(null);
    if (result.error) {
      setState((current) => ({ ...current, error: result.error }));
      return;
    }
    setState((current) => ({
      ...current,
      rows: current.rows.map((r) => r.id === requestId ? { ...r, status: 'CANCELLED' } : r),
    }));
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-page">
      <PageHeader
        title={t('customer_deposit_title')}
        description={isRequestProxy ? t('customer_deposit_list_proxy_description') : t('customer_deposit_list_description')}
        actions={canWriteCustomerRequests ? (
          <Link className="btn btn-primary" data-testid="customer-deposit-create-button" to="/customer/deposit-request/new">
            {t('customer_deposit_create_button')}
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
          <h3>{t('customer_deposit_list_title')}</h3>
        </div>
        {(profileLoading || state.loading) ? <LoadingState message={t('customer_portal_loading')} /> : null}
        <div className="responsive-table">
          <table className="data-table" data-testid="customer-deposit-list-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('request_no')} style={{ cursor: 'pointer' }}>{t('customer_col_request_no')} {getSortIndicator('request_no')}</th>
                {isRequestProxy ? <th onClick={() => requestSort('customer_id')} style={{ cursor: 'pointer' }}>{t('customer_col_customer_name')} {getSortIndicator('customer_id')}</th> : null}
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>{t('customer_col_status')} {getSortIndicator('status')}</th>
                <th onClick={() => requestSort('expected_arrival_date')} style={{ cursor: 'pointer' }}>{t('customer_field_expected_arrival_date')} {getSortIndicator('expected_arrival_date')}</th>
                <th onClick={() => requestSort('contact_name')} style={{ cursor: 'pointer' }}>{t('customer_field_contact_name')} {getSortIndicator('contact_name')}</th>
                <th onClick={() => requestSort('contact_phone')} style={{ cursor: 'pointer' }}>{t('customer_field_contact_phone')} {getSortIndicator('contact_phone')}</th>
                <th onClick={() => requestSort('note')} style={{ cursor: 'pointer' }}>{t('customer_col_note')} {getSortIndicator('note')}</th>
                <th onClick={() => requestSort('updated_at')} style={{ cursor: 'pointer' }}>{t('customer_history_latest_action')} {getSortIndicator('updated_at')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedData.length ? pagedData.map((row) => (
                <tr key={row.id}>
                  <td>{row.request_no}</td>
                  {isRequestProxy ? <td>{customerNames[row.customer_id] ?? row.customer_id ?? '-'}</td> : null}
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
                    <small>{row.last_action_at ? new Date(row.last_action_at).toLocaleString() : '-'}</small>
                  </td>
                  <td>
                    <div className="action-row action-row--table">
                      <Link
                        className="btn btn-secondary btn-sm"
                        data-testid={`customer-deposit-view-${row.id}`}
                        to={`/customer/deposit-request/${row.id}`}
                      >
                        {t('customer_request_view_button')}
                      </Link>
                      {(row.status === 'DRAFT' || row.status === 'WITHDRAWAL_DRAFT' || row.status === 'DEPOSIT_DRAFT') && canWriteCustomerRequests ? (
                        <Link
                          className="btn btn-primary btn-sm"
                          data-testid={`customer-deposit-edit-${row.id}`}
                          to={`/customer/deposit-request/new?editId=${row.id}`}
                        >
                          {t('edit') || 'แก้ไข'}
                        </Link>
                      ) : null}
                      {canWriteCustomerRequests ? (
                        <Link
                          className="btn btn-secondary btn-sm"
                          data-testid={`customer-deposit-copy-${row.id}`}
                          to={buildCustomerRequestCopyPath('/customer/deposit-request/new', row.id)}
                        >
                          {t('customer_request_copy_button')}
                        </Link>
                      ) : null}
                      {canWriteCustomerRequests && DELETABLE_STATUSES.has(row.status) ? (
                        deleteConfirmId === row.id ? (
                          <>
                            <button className="btn btn-danger btn-sm" disabled={deleting} onClick={() => handleDelete(row.id)} type="button">
                              {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
                            </button>
                            <button className="btn btn-secondary btn-sm" disabled={deleting} onClick={() => setDeleteConfirmId(null)} type="button">ยกเลิก</button>
                          </>
                        ) : (
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirmId(row.id)} type="button">ลบ</button>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={columnCount}>{t('customer_deposit_list_empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="action-row" style={{ justifyContent: 'center', padding: '12px 0', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} type="button">‹ ก่อนหน้า</button>
            <span style={{ fontSize: 13, padding: '4px 8px' }}>{currentPage} / {totalPages} (ทั้งหมด {sortedData.length} รายการ)</span>
            <button className="btn btn-secondary btn-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} type="button">ถัดไป ›</button>
          </div>
        )}
      </div>
    </section>
  );
}
