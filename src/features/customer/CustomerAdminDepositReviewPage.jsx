import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import {
  listCustomerDepositRequests,
  listCustomerDepositRequestLines,
  reviewCustomerDepositRequest,
} from '../../services/customerDepositRequestService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const REVIEW_STATUSES = ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED'];

export function CustomerAdminDepositReviewPage() {
  const t = useTranslation();
  const { requestId: routeRequestId } = useParams();
  const [rows, setRows] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedId, setSelectedId] = useState(routeRequestId ?? '');
  const [comment, setComment] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (routeRequestId) {
      setSelectedId(routeRequestId);
    }
  }, [routeRequestId]);

  useEffect(() => {
    if (!selectedId && rows.length) {
      setSelectedId(rows[0].id);
    }
  }, [rows, selectedId]);

  useEffect(() => {
    let active = true;
    if (!selectedId) {
      setLines([]);
      return undefined;
    }

    listCustomerDepositRequestLines(selectedId).then((result) => {
      if (!active) return;
      setLines(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function handleReview(decision, label) {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    const result = await reviewCustomerDepositRequest(selectedId, decision, comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Review failed');
      return;
    }
    setAction(`${label}: ${result.data?.status ?? 'updated'}`);
  }

  if (loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-admin-deposit-review-page">
        <LoadingState />
      </section>
    );
  }

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
      {action ? <div className="alert-success-panel" role="status">{action}</div> : null}
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
                      {row.status}
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
          </div>
          <div className="responsive-table">
            <table className="data-table" data-testid="admin-deposit-review-lines-table">
              <thead><tr><th>Line</th><th>{t('catalog_col_customer_code')}</th><th>{t('catalog_col_barcode')}</th><th>Expected</th></tr></thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.line_no}</td>
                    <td>{line.customer_product_code}</td>
                    <td>{line.internal_product_code || line.customer_product_code}</td>
                    <td>{line.expected_qty} / {line.expected_boxes} boxes / {line.expected_weight} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <label className="form-field"><span>Admin comment</span><textarea className="form-control" onChange={(e) => setComment(e.target.value)} rows={3} value={comment} /></label>
      <div className="action-row">
        <button className="btn btn-secondary" data-testid="admin-accept-deposit-button" disabled={submitting || !selectedId} onClick={() => handleReview('REVIEWING', 'Review started')} type="button">Start review</button>
        <button className="btn btn-primary" disabled={submitting || !selectedId} onClick={() => handleReview('ACCEPT', 'Deposit accepted')} type="button">Accept request</button>
        <button className="btn btn-secondary" disabled={submitting || !selectedId} onClick={() => handleReview('REJECT', 'Deposit rejected')} type="button">Reject request</button>
      </div>
    </section>
  );
}
