import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerWithdrawalRequestLinesDisplay } from '../../components/customer/CustomerWithdrawalRequestLinesDisplay.jsx';
import { CustomerWithdrawalRequestPrintDocument } from '../../components/customer/CustomerWithdrawalRequestPrintDocument.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getWithdrawalStatusLabel } from '../../utils/customerWithdrawalStatusLabels.js';
import { listCustomerWithdrawalRequests, listCustomerWithdrawalRequestLines } from '../../services/customerWithdrawalRequestService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { buildCustomerRequestCopyPath } from '../../utils/customerRequestCopyUtils.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerWithdrawalRequestListPage() {
  const { sortedData, requestSort, getSortIndicator } = useTableSort(sortedData);

  const t = useTranslation();
  const { customerId, canWriteCustomerRequests, isRequestProxy, loading: profileLoading } = useCustomerPortalProfile();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [customerNames, setCustomerNames] = useState({});
  const [detailRow, setDetailRow] = useState(null);
  const [detailLines, setDetailLines] = useState([]);
  const [detailLinesLoading, setDetailLinesLoading] = useState(false);
  const branding = getDocumentBrandingConfig();

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

  function openDetail(row) {
    setDetailRow(row);
    setDetailLines([]);
    setDetailLinesLoading(true);
    listCustomerWithdrawalRequestLines(row.id).then((result) => {
      setDetailLines(result.data ?? []);
      setDetailLinesLoading(false);
    });
  }

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
                <th onClick={() => requestSort('request_no')} style={{ cursor: 'pointer' }}>{t('customer_col_request_no')} {getSortIndicator('request_no')}</th>
                {isRequestProxy ? <th onClick={() => requestSort('customer_id')} style={{ cursor: 'pointer' }}>{t('customer_col_customer_name')} {getSortIndicator('customer_id')}</th> : null}
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>{t('customer_col_status')} {getSortIndicator('status')}</th>
                <th>{t('customer_field_requested_dispatch_date')}</th>
                <th>{t('customer_field_delivery_type')}</th>
                <th>{t('customer_field_pickup_contact')}</th>
                <th onClick={() => requestSort('note')} style={{ cursor: 'pointer' }}>{t('customer_col_note')} {getSortIndicator('note')}</th>
                <th onClick={() => requestSort('updated_at')} style={{ cursor: 'pointer' }}>{t('customer_history_latest_action')} {getSortIndicator('updated_at')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.length ? sortedData.map((row) => (
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
                      {isRequestProxy ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          data-testid={`customer-withdrawal-view-${row.id}`}
                          onClick={() => openDetail(row)}
                          type="button"
                        >
                          {t('customer_request_view_button')}
                        </button>
                      ) : (
                        <Link
                          className="btn btn-secondary btn-sm"
                          data-testid={`customer-withdrawal-view-${row.id}`}
                          to={`/customer/withdrawal-request/${row.id}`}
                        >
                          {t('customer_request_view_button')}
                        </Link>
                      )}
                      {(row.status === 'DRAFT' || row.status === 'WITHDRAWAL_DRAFT' || row.status === 'DEPOSIT_DRAFT') && canWriteCustomerRequests ? (
                        <Link
                          className="btn btn-primary btn-sm"
                          data-testid={`customer-withdrawal-edit-${row.id}`}
                          to={`/customer/withdrawal-request/new?editId=${row.id}`}
                        >
                          {t('edit') || 'แก้ไข'}
                        </Link>
                      ) : null}
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

      {detailRow ? (
        <Modal
          isOpen
          onClose={() => setDetailRow(null)}
          size="lg"
          title={detailRow.withdrawal_no ?? t('customer_withdrawal_detail_title')}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              {(detailRow.status === 'DRAFT' || detailRow.status === 'WITHDRAWAL_DRAFT' || detailRow.status === 'DEPOSIT_DRAFT') && canWriteCustomerRequests && (
                <Link
                  className="btn btn-primary"
                  data-testid={`customer-withdrawal-edit-${detailRow.id}`}
                  to={`/customer/withdrawal-request/new?editId=${detailRow.id}`}
                >
                  {t('edit') || 'แก้ไข'}
                </Link>
              )}
              <ReportPrintActions
                disabled={!detailRow}
                renderReport={(reportLanguage) => (
                  <CustomerWithdrawalRequestPrintDocument
                    branding={branding}
                    header={detailRow}
                    language={reportLanguage}
                    lines={detailLines}
                  />
                )}
                title={detailRow.withdrawal_no}
              />
              <button className="btn btn-secondary" onClick={() => setDetailRow(null)} type="button">
                {t('close') || 'ปิด'}
              </button>
            </div>
          }
        >
          <div className="form-grid customer-request-detail-meta" style={{ marginBottom: 16 }}>
            <div>
              <div className="form-label">{t('customer_col_customer_name')}</div>
              <div>{customerNames[detailRow.customer_id] ?? detailRow.customer_id ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">{t('customer_col_status')}</div>
              <span className={`status-badge status-badge--${getCustomerRequestStatusClass(detailRow.status)}`}>
                {getWithdrawalStatusLabel(detailRow.status, t)}
              </span>
            </div>
            <div>
              <div className="form-label">{t('customer_field_requested_dispatch_date')}</div>
              <div>{detailRow.requested_dispatch_date ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">{t('customer_field_delivery_type')}</div>
              <div>{detailRow.delivery_type ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">{t('customer_field_pickup_contact')}</div>
              <div>{detailRow.pickup_contact ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">{t('customer_col_note')}</div>
              <div>{detailRow.note || '-'}</div>
            </div>
          </div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('customer_withdrawal_lines_title')}</h4>
          {detailLinesLoading ? <LoadingState message={t('customer_portal_loading')} /> : (
            <CustomerWithdrawalRequestLinesDisplay lines={detailLines} />
          )}
        </Modal>
      ) : null}
    </section>
  );
}
