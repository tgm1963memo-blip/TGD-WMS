import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerWithdrawalRequestLinesDisplay } from '../../components/customer/CustomerWithdrawalRequestLinesDisplay.jsx';
import { CustomerWithdrawalRequestPrintDocument } from '../../components/customer/CustomerWithdrawalRequestPrintDocument.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import {
  listCustomerWithdrawalRequests,
  listCustomerWithdrawalRequestLines,
  reviewCustomerWithdrawalRequest,
} from '../../services/customerWithdrawalRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerAdminWithdrawalReviewPage() {
  const t = useTranslation();
  const [rows, setRows] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [comment, setComment] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listCustomerWithdrawalRequests({ statusIn: ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'] }).then((result) => {
      if (!active) return;
      const data = result.data ?? [];
      setRows(data);
      setSelectedId(data[0]?.id ?? '');
      setLoading(false);
      setError(result.error?.message ?? '');
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!selectedId) {
      setLines([]);
      return undefined;
    }

    listCustomerWithdrawalRequestLines(selectedId).then((result) => {
      if (!active) return;
      setLines(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const branding = getDocumentBrandingConfig();

  async function handleReview(decision, label) {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    const result = await reviewCustomerWithdrawalRequest(selectedId, decision, comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Review failed');
      return;
    }
    setAction(`${label}: ${result.data?.status ?? 'updated'}`);
  }

  if (loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-admin-withdrawal-review-page">
        <LoadingState />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-admin-withdrawal-review-page">
      <PageHeader title={t('admin_withdrawal_review_title')} description={t('admin_withdrawal_review_description')} />
      <CustomerPortalLiveBanner />
      {action ? <div className="alert-success-panel" role="status">{action}</div> : null}
      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      <div className="responsive-table">
        <table className="data-table" data-testid="admin-withdrawal-review-table">
          <thead>
            <tr>
              <th>{t('customer_col_request_no')}</th>
              <th>{t('customer_col_status')}</th>
              <th>{t('customer_field_requested_dispatch_date')}</th>
              <th>{t('customer_field_delivery_type')}</th>
              <th>{t('catalog_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr className={row.id === selectedId ? 'table-row-selected' : ''} key={row.id}>
                <td>{row.withdrawal_no}</td>
                <td>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.requested_dispatch_date ?? '-'}</td>
                <td>{row.delivery_type ?? '-'}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedId(row.id)} type="button">
                    {t('receiving_review_deposit_button')}
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5}>{t('admin_withdrawal_review_empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected ? (
        <div className="table-card">
          <div className="table-card-header">
            <h3>{selected.withdrawal_no}</h3>
            <div className="action-row">
              <Link
                className="btn btn-secondary btn-sm"
                data-testid={`admin-withdrawal-view-${selected.id}`}
                to={`/customer/withdrawal-request/${selected.id}`}
              >
                {t('customer_request_view_button')}
              </Link>
              <ReportPrintActions
                disabled={!selected}
                renderReport={(language) => (
                  <CustomerWithdrawalRequestPrintDocument
                    branding={branding}
                    header={selected}
                    language={language}
                    lines={lines}
                  />
                )}
                title={selected.withdrawal_no}
              />
            </div>
          </div>
          <CustomerWithdrawalRequestLinesDisplay lines={lines} testId="admin-withdrawal-review-lines-table" />
        </div>
      ) : null}
      <label className="form-field"><span>Admin comment</span><textarea className="form-control" onChange={(e) => setComment(e.target.value)} rows={3} value={comment} /></label>
      <div className="action-row">
        <button className="btn btn-secondary" disabled={submitting || !selectedId} onClick={() => handleReview('REVIEWING', 'Review started')} type="button">Start review</button>
        <button className="btn btn-primary" data-testid="admin-accept-withdrawal-button" disabled={submitting || !selectedId} onClick={() => handleReview('ACCEPT', 'Withdrawal accepted')} type="button">Accept withdrawal</button>
        <button className="btn btn-secondary" disabled={submitting || !selectedId} onClick={() => handleReview('REJECT', 'Withdrawal rejected')} type="button">Reject withdrawal</button>
      </div>
    </section>
  );
}
