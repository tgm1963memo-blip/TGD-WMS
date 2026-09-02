import { Link } from 'react-router-dom';
import { LoadingState } from '../ui/LoadingState.jsx';
import { InvoiceDraftStatusBadge } from './InvoiceDraftStatusBadge.jsx';
import { canApproveBillingInvoiceDraft, canDeleteBillingInvoiceDraft, canRecalculateBillingInvoiceDraft } from '../../utils/billingInvoiceDraftUtils.js';
import { formatFixed2 } from '../../utils/numberFormat.js';
import { getTemperatureTypeShortLabel } from '../../utils/temperatureTypeLabels.js';

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
  onApprove = null,
  approvingId = null,
  onRecalculate = null,
  recalculatingId = null,
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
            <th>Storage Type</th>
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
              <td>{draft.temperature_type ? getTemperatureTypeShortLabel(draft.temperature_type) : 'ทุกประเภท'}</td>
              <td>{formatNumber(draft.total_qty)}</td>
              <td>{formatFixed2(draft.total_chargeable_weight)}</td>
              <td>{formatFixed2(draft.total_amount)}</td>
              <td>{formatDate(draft.created_at)}</td>
              <td style={{ minWidth: 130 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
                  {onView ? (
                    <button className="btn btn-outline" type="button" style={{ width: '100%' }} onClick={() => onView(draft)}>View</button>
                  ) : (
                    <Link className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }} to={`/billing/invoice-drafts/${draft.id}`}>View</Link>
                  )}
                  {canWrite && onApprove && canApproveBillingInvoiceDraft(draft) ? (
                    <button
                      className="btn btn-primary"
                      type="button"
                      style={{ width: '100%' }}
                      disabled={approvingId === draft.id}
                      data-testid={`invoice-draft-approve-button-${draft.id}`}
                      onClick={() => onApprove(draft)}
                    >
                      {approvingId === draft.id ? '⏳ Approving...' : 'Approve'}
                    </button>
                  ) : null}
                  {canWrite && onRecalculate && canRecalculateBillingInvoiceDraft(draft) ? (
                    <button
                      className="btn btn-outline"
                      type="button"
                      style={{ width: '100%' }}
                      disabled={recalculatingId === draft.id}
                      data-testid={`invoice-draft-recalculate-button-${draft.id}`}
                      onClick={() => onRecalculate(draft)}
                      title="ดึงอัตราค่าบริการที่ตั้งไว้มาคำนวณจำนวนเงินใหม่"
                    >
                      {recalculatingId === draft.id ? '⏳ กำลังคำนวณ...' : 'คำนวณอัตราใหม่'}
                    </button>
                  ) : null}
                  {canWrite && onDelete && canDeleteBillingInvoiceDraft(draft) ? (
                    <button
                      className="btn btn-danger"
                      type="button"
                      style={{ width: '100%' }}
                      data-testid={`invoice-draft-delete-button-${draft.id}`}
                      onClick={() => onDelete(draft)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
