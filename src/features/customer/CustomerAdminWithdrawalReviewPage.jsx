import { useEffect, useState } from 'react';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import {
  listCustomerWithdrawalRequests,
  listCustomerWithdrawalRequestLines,
  reviewCustomerWithdrawalRequest,
} from '../../services/customerWithdrawalRequestService.js';

export function CustomerAdminWithdrawalReviewPage() {
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
      <PageHeader title="Admin Withdrawal Review" description="Review customer withdrawal requests via controlled RPC." />
      <CustomerPortalLiveBanner />
      {action ? <div className="alert-success-panel" role="status">{action}</div> : null}
      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      <div className="responsive-table">
        <table className="data-table" data-testid="admin-withdrawal-review-table">
          <thead><tr><th>Request</th><th>Status</th><th>Dispatch date</th><th>Delivery</th><th>Select</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.id}>
                <td>{row.withdrawal_no}</td>
                <td>{row.status}</td>
                <td>{row.requested_dispatch_date ?? '-'}</td>
                <td>{row.delivery_type ?? '-'}</td>
                <td><button className="btn btn-secondary" onClick={() => setSelectedId(row.id)} type="button">Select</button></td>
              </tr>
            )) : (
              <tr><td colSpan={5}>No submitted withdrawal requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {lines.length ? (
        <div className="responsive-table">
          <table className="data-table">
            <thead><tr><th>Line</th><th>Customer product</th><th>Requested</th><th>Rule</th></tr></thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.line_no}</td>
                  <td>{line.customer_product_code}</td>
                  <td>{line.requested_qty} / {line.requested_boxes} boxes / {line.requested_weight} kg</td>
                  <td>{line.picking_rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
