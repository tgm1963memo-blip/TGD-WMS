import { LoadingState } from '../ui/LoadingState.jsx';

function BillingStatusBadge({ status }) {
  if (!status) return <span className="badge badge-neutral" data-testid="billing-status-badge">-</span>;

  const className = status === 'NEEDS_WEIGHT_REVIEW'
    ? 'badge badge-warning'
    : status === 'READY_FOR_PREVIEW'
      ? 'badge badge-success'
      : 'badge badge-neutral';

  return (
    <span className={className} data-testid="billing-status-badge">
      {status}
    </span>
  );
}

function BillingExclusionReasonBadge({ reason }) {
  if (!reason) return <span data-testid="billing-exclusion-reason-badge">-</span>;

  return (
    <span className="badge badge-danger" data-testid="billing-exclusion-reason-badge">
      {reason}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

export function BillingMovementWeightTable({
  data = [],
  loading = false,
  error = null,
  emptyState = null,
  selectedMovementIds = new Set(),
  onToggleRow,
  onToggleAllSelectable,
  getSelectionState,
}) {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return null;
  }

  if (!data.length) {
    return emptyState;
  }

  const selectableRows = data.filter((row) => getSelectionState?.(row)?.selectable);
  const allSelectableSelected = selectableRows.length > 0
    && selectableRows.every((row) => selectedMovementIds.has(String(row.movement_id)));

  return (
    <div className="table-responsive responsive-table" data-testid="billing-movement-weight-table">
      <table className="tgd-table">
        <thead>
          <tr>
            <th>
              {getSelectionState ? (
                <input
                  type="checkbox"
                  checked={allSelectableSelected}
                  disabled={!selectableRows.length}
                  onChange={() => onToggleAllSelectable?.(selectableRows.map((row) => String(row.movement_id)))}
                  data-testid="billing-movement-select-all-checkbox"
                  aria-label="Select all billable rows"
                />
              ) : 'Select'}
            </th>
            <th>Movement Date</th>
            <th>Movement Type</th>
            <th>Canonical Type</th>
            <th>Customer</th>
            <th>Product Code</th>
            <th>Product Name</th>
            <th>Lot No</th>
            <th>Pallet No</th>
            <th>Qty</th>
            <th>UOM</th>
            <th>Net Weight</th>
            <th>Gross Weight</th>
            <th>Chargeable Weight</th>
            <th>Is Billable</th>
            <th>Billing Service Type</th>
            <th>Billing Status</th>
            <th>Billing Exclusion Reason</th>
            <th>Source Document No</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const selectionState = getSelectionState?.(row) ?? { selectable: false, reason: null };
            const movementId = String(row.movement_id ?? '');
            const isSelected = selectedMovementIds.has(movementId);

            return (
            <tr key={row.movement_id ?? `${row.movement_type}-${row.movement_date}`}>
              <td>
                {getSelectionState ? (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!selectionState.selectable}
                    title={selectionState.reason ?? 'Selectable for invoice draft'}
                    onChange={() => onToggleRow?.(movementId)}
                    data-testid="billing-movement-row-checkbox"
                    aria-label={`Select movement ${movementId}`}
                  />
                ) : null}
              </td>
              <td>{formatDate(row.movement_date)}</td>
              <td>{row.movement_type ?? '-'}</td>
              <td>{row.canonical_movement_type ?? '-'}</td>
              <td>{row.customer_name ?? row.customer_code ?? '-'}</td>
              <td>{row.product_code ?? '-'}</td>
              <td>{row.product_name ?? '-'}</td>
              <td>{row.lot_no ?? '-'}</td>
              <td>{row.pallet_no ?? '-'}</td>
              <td>{formatNumber(row.qty)}</td>
              <td>{row.uom ?? '-'}</td>
              <td>{formatNumber(row.net_weight)}</td>
              <td>{formatNumber(row.gross_weight)}</td>
              <td>{formatNumber(row.chargeable_weight)}</td>
              <td>{row.is_billable ? 'Yes' : 'No'}</td>
              <td>{row.billing_service_type ?? '-'}</td>
              <td><BillingStatusBadge status={row.billing_status} /></td>
              <td><BillingExclusionReasonBadge reason={row.billing_exclusion_reason} /></td>
              <td>{row.source_document_no ?? '-'}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
