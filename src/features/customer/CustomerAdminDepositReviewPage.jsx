import { useEffect, useState } from 'react';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import {
  listCustomerDepositRequests,
  listCustomerDepositRequestLines,
  reviewCustomerDepositRequest,
} from '../../services/customerDepositRequestService.js';

export function CustomerAdminDepositReviewPage() {
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

    listCustomerDepositRequests({ statusIn: ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'] }).then((result) => {
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
      <PageHeader title="Admin Deposit Review" description="Review customer deposit requests via controlled RPC." />
      <CustomerPortalLiveBanner />
      {action ? <div className="alert-success-panel" role="status">{action}</div> : null}
      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      <div className="table-card">
        <div className="responsive-table">
          <table className="data-table" data-testid="admin-deposit-review-table">
            <thead><tr><th>Request</th><th>Status</th><th>Expected arrival</th><th>Contact</th><th>Select</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.request_no}</td>
                  <td>{row.status}</td>
                  <td>{row.expected_arrival_date ?? '-'}</td>
                  <td>{row.contact_name ?? '-'}</td>
                  <td><button className="btn btn-secondary" onClick={() => setSelectedId(row.id)} type="button">Select</button></td>
                </tr>
              )) : (
                <tr><td colSpan={5}>No submitted deposit requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selected ? (
        <div className="table-card">
          <div className="responsive-table">
            <table className="data-table">
              <thead><tr><th>Line</th><th>Customer product</th><th>Internal product</th><th>Expected</th></tr></thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.line_no}</td>
                    <td>{line.customer_product_code}</td>
                    <td>{line.internal_product_code}</td>
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
