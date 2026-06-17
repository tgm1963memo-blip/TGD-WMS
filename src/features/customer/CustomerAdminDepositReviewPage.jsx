import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerDepositRequestLinesDisplay } from '../../components/customer/CustomerDepositRequestLinesDisplay.jsx';
import { CustomerDepositRequestPrintDocument } from '../../components/customer/CustomerDepositRequestPrintDocument.jsx';
import { CustomerDepositStaffWorkOrderPrint } from '../../components/customer/CustomerDepositStaffWorkOrderPrint.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import {
  listCustomerDepositRequests,
  listCustomerDepositRequestLines,
  reviewCustomerDepositRequest,
  enqueueCustomerDepositNotification,
} from '../../services/customerDepositRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const REVIEW_STATUSES = [
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_RECEIVING',
];

export function CustomerAdminDepositReviewPage() {
  const t = useTranslation();
  const { requestId: routeRequestId } = useParams();
  const [rows, setRows] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedId, setSelectedId] = useState(routeRequestId ?? '');
  const [comment, setComment] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listCustomerDepositRequests({ statusIn: REVIEW_STATUSES }).then((result) => {
      if (!active) return;
      const data = result.data ?? [];
      setRows(data);
      setLoading(false);
      setError(result.error?.message ?? '');
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (routeRequestId) setSelectedId(routeRequestId);
  }, [routeRequestId]);

  useEffect(() => {
    if (!selectedId && rows.length) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  useEffect(() => {
    let active = true;
    if (!selectedId) { setLines([]); return undefined; }

    listCustomerDepositRequestLines(selectedId).then((result) => {
      if (!active) return;
      setLines(result.data ?? []);
    });

    return () => { active = false; };
  }, [selectedId]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const branding = getDocumentBrandingConfig();

  async function handleReview(decision) {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');
    const result = await reviewCustomerDepositRequest(selectedId, decision, comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Review failed');
      return;
    }
    const newStatus = result.data?.status ?? '';
    setActionMsg(getDepositStatusLabel(newStatus, t) || newStatus);
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
  }

  async function handleAcceptDeposit() {
    if (!selectedId || !selected) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');

    if (selected.status === 'SUBMITTED_BY_CUSTOMER') {
      const reviewResult = await reviewCustomerDepositRequest(selectedId, 'REVIEWING', comment);
      if (reviewResult.error) {
        setError(reviewResult.error.message ?? 'Review step failed');
        setSubmitting(false);
        return;
      }
    }

    const acceptResult = await reviewCustomerDepositRequest(selectedId, 'ACCEPT', comment);
    setSubmitting(false);
    if (acceptResult.error) {
      setError(acceptResult.error.message ?? 'Accept failed');
      return;
    }
    const newStatus = acceptResult.data?.status ?? 'WAREHOUSE_RECEIVING';
    setActionMsg(getDepositStatusLabel(newStatus, t) || newStatus);
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
  }

  async function handleNotifyCustomer() {
    if (!selected) return;
    setNotifying(true);
    setError('');
    const result = await enqueueCustomerDepositNotification(
      selected.id,
      selected.customer_id,
      selected.request_no,
      selected.created_by_email ?? null,
    );
    setNotifying(false);
    if (result.error) {
      setError(result.error.message ?? 'Notification failed');
      return;
    }
    setActionMsg(t('admin_notify_customer'));
  }

  if (loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-admin-deposit-review-page">
        <LoadingState />
      </section>
    );
  }

  const canAccept = selected && ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'].includes(selected.status);
  const canNotify = selected?.status === 'WAREHOUSE_RECEIVING';

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-admin-deposit-review-page">
      <PageHeader
        title={t('admin_deposit_review_title')}
        description={t('admin_deposit_review_description')}
        actions={(
          <Link className="btn btn-secondary" to="/operations/receiving">
            {t('receiving')}
          </Link>
        )}
      />
      <CustomerPortalLiveBanner />
      {actionMsg ? <div className="alert-success-panel" role="status">{actionMsg}</div> : null}
      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('admin_deposit_review_table_title')}</h3>
        </div>
        <div className="responsive-table">
          <table className="data-table" data-testid="admin-deposit-review-table">
            <thead>
              <tr>
                <th>{t('customer_col_request_no')}</th>
                <th>{t('customer_col_status')}</th>
                <th>{t('customer_field_expected_arrival_date')}</th>
                <th>{t('customer_field_contact_name')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr className={row.id === selectedId ? 'table-row-selected' : ''} key={row.id}>
                  <td>{row.request_no}</td>
                  <td>
                    <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                      {getDepositStatusLabel(row.status, t)}
                    </span>
                  </td>
                  <td>{row.expected_arrival_date ?? '-'}</td>
                  <td>{row.contact_name ?? '-'}</td>
                  <td>
                    <Link
                      className={`btn btn-secondary btn-sm${row.id === selectedId ? ' btn-primary' : ''}`}
                      data-testid={`admin-deposit-review-select-${row.id}`}
                      to={`/customer/admin/deposit-review/${row.id}`}
                    >
                      {t('receiving_review_deposit_button')}
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5}>{t('admin_deposit_review_empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <div className="table-card">
          <div className="table-card-header">
            <h3>{selected.request_no}</h3>
            <div className="action-row">
              <Link
                className="btn btn-secondary btn-sm"
                data-testid={`admin-deposit-view-${selected.id}`}
                to={`/customer/deposit-request/${selected.id}`}
              >
                {t('customer_request_view_button')}
              </Link>
              <ReportPrintActions
                disabled={!selected}
                renderReport={(language) => (
                  <CustomerDepositStaffWorkOrderPrint
                    branding={branding}
                    header={selected}
                    language={language}
                    lines={lines}
                  />
                )}
                title={`${selected.request_no} — ${t('admin_staff_work_order')}`}
              />
              <ReportPrintActions
                disabled={!selected}
                renderReport={(language) => (
                  <CustomerDepositRequestPrintDocument
                    branding={branding}
                    header={selected}
                    language={language}
                    lines={lines}
                  />
                )}
                title={`${selected.request_no} — ${t('admin_customer_deposit_document')}`}
              />
            </div>
          </div>
          <CustomerDepositRequestLinesDisplay lines={lines} testId="admin-deposit-review-lines-table" />
        </div>
      ) : null}

      <label className="form-field">
        <span>{t('admin_review_comment_label')}</span>
        <textarea className="form-control" onChange={(e) => setComment(e.target.value)} rows={3} value={comment} />
      </label>
      <div className="action-row">
        <button
          className="btn btn-primary"
          data-testid="admin-accept-deposit-button"
          disabled={submitting || !canAccept}
          onClick={handleAcceptDeposit}
          type="button"
        >
          {t('admin_confirm_accept_deposit')}
        </button>
        {canNotify ? (
          <button
            className="btn btn-secondary"
            disabled={notifying}
            onClick={handleNotifyCustomer}
            type="button"
          >
            {notifying ? '...' : t('admin_notify_customer')}
          </button>
        ) : null}
        <button
          className="btn btn-secondary"
          disabled={submitting || !selectedId}
          onClick={() => handleReview('REJECT')}
          type="button"
        >
          {t('admin_reject_request')}
        </button>
      </div>
    </section>
  );
}
