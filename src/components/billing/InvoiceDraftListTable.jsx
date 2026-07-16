import { Link } from 'react-router-dom';
import { LoadingState } from '../ui/LoadingState.jsx';
import { InvoiceDraftStatusBadge } from './InvoiceDraftStatusBadge.jsx';
import { canDeleteBillingInvoiceDraft, canRecalculateBillingInvoiceDraft } from '../../utils/billingInvoiceDraftUtils.js';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString() : '-';
}

export function InvoiceDraftListTable({
  data = [],
  loading = false,
  error = null,
  onView = null,
  onDelete = null,
  onRecalculate = null,
  canWrite = false,
}) {
  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="section-card" role="alert" style={{ padding: 16, border: '1px solid var(--tgd-danger)' }}>
        {error.message || String(error)}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="section-card" style={{ padding: 24, textAlign: 'center' }} data-testid="invoice-draft-empty-state">
        No invoice drafts match the selected filters.
      </div>
    );
  }

  return (
    <div className="table-responsive responsive-table" data-testid="billing-invoice-drafts-table">
      <table className="tgd-table">
        <thead>
          <tr>
            <th>Draft No</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Period Start</th>
            <th>Period End</th>
            <th>Total Qty</th>
            <th>Total Chargeable Weight</th>
            <th>Total Amount</th>
            <th>Created At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((draft) => (
            <tr key={draft.id}>
              <td>{draft.draft_no}</td>
              <td>{draft.customer_name ?? '-'}</td>
              <td><InvoiceDraftStatusBadge status={draft.status} /></td>
              <td>{draft.billing_period_start ?? '-'}</td>
              <td>{draft.billing_period_end ?? '-'}</td>
              <td>{formatNumber(draft.total_qty)}</td>
              <td>{formatNumber(draft.total_chargeable_weight)}</td>
              <td>{draft.total_amount == null ? '-' : formatNumber(draft.total_amount)}</td>
              <td>{formatDate(draft.created_at)}</td>
              <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {onView ? (
                  <button className="btn btn-outline" type="button" onClick={() => onView(draft)}>View</button>
                ) : (
                  <Link className="btn btn-outline" to={`/billing/invoice-drafts/${draft.id}`}>View</Link>
                )}
                {canWrite && onRecalculate && canRecalculateBillingInvoiceDraft(draft) ? (
                  <button
                    className="btn btn-outline"
                    type="button"
                    data-testid={`invoice-draft-recalculate-button-${draft.id}`}
                    onClick={() => onRecalculate(draft)}
                    title="ดึงอัตราค่าบริการที่ตั้งไว้มาคำนวณจำนวนเงินใหม่"
                  >
                    คำนวณอัตราใหม่
                  </button>
                ) : null}
                {canWrite && onDelete && canDeleteBillingInvoiceDraft(draft) ? (
                  <button
                    className="btn btn-danger"
                    type="button"
                    data-testid={`invoice-draft-delete-button-${draft.id}`}
                    onClick={() => onDelete(draft)}
                  >
                    Delete
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
