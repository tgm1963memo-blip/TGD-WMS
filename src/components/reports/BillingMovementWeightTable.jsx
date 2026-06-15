import { CompactExpandableTable } from '../ui/CompactExpandableTable.jsx';
import { formatCompactText, formatDetailValue, formatDocumentDate } from '../../utils/documentDisplayUtils.js';

function BillingStatusBadge({ status }) {
  if (!status) return <span className="status-badge status-badge--draft" data-testid="billing-status-badge">-</span>;

  const modifier = status === 'NEEDS_WEIGHT_REVIEW'
    ? 'hold'
    : status === 'READY_FOR_PREVIEW'
      ? 'confirmed'
      : 'draft';

  return (
    <span className={`status-badge status-badge--${modifier}`} data-testid="billing-status-badge">
      {status === 'READY_FOR_PREVIEW' ? 'Ready' : status === 'NEEDS_WEIGHT_REVIEW' ? 'Review' : status}
    </span>
  );
}

function DetailField({ label, value, testId }) {
  return (
    <div className="compact-detail-field">
      <span className="compact-detail-label">{label}</span>
      <span className="compact-detail-value" data-testid={testId}>{formatDetailValue(value)}</span>
    </div>
  );
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function buildSummaryColumns({
  selectedMovementIds,
  onToggleRow,
  onToggleAllSelectable,
  getSelectionState,
  selectableRows,
  allSelectableSelected,
}) {
  const columns = [];

  if (getSelectionState) {
    columns.push({
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelectableSelected}
          disabled={!selectableRows.length}
          onChange={() => onToggleAllSelectable?.(selectableRows.map((row) => String(row.movement_id)))}
          data-testid="billing-movement-select-all-checkbox"
          aria-label="Select all billable rows"
        />
      ),
      render: (row) => {
        const selectionState = getSelectionState(row);
        const movementId = String(row.movement_id ?? '');

        return (
          <input
            type="checkbox"
            checked={selectedMovementIds.has(movementId)}
            disabled={!selectionState.selectable}
            title={selectionState.reason ?? 'Selectable for invoice draft'}
            onChange={() => onToggleRow?.(movementId)}
            data-testid="billing-movement-row-checkbox"
            aria-label={`Select movement ${movementId}`}
          />
        );
      },
    });
  }

  columns.push(
    {
      key: 'movement_date',
      header: 'Date',
      render: (row) => (
        <span className="table-meta-text">
          {formatDocumentDate(row.movement_date, { dateOnly: true })}
        </span>
      ),
    },
    {
      key: 'movement_type',
      header: 'Type',
      render: (row) => <span className="compact-cell-text">{row.movement_type ?? '-'}</span>,
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (row) => (
        <span className="compact-cell-text">
          {formatCompactText(row.customer_name ?? row.customer_code ?? row.customer_id, 18)}
        </span>
      ),
      title: (row) => row.customer_name ?? row.customer_code ?? row.customer_id,
    },
    {
      key: 'product_name',
      header: 'Product',
      render: (row) => (
        <span className="compact-cell-text">
          {formatCompactText(row.product_name ?? row.product_code ?? row.product_id, 20)}
        </span>
      ),
      title: (row) => row.product_name ?? row.product_code ?? row.product_id,
    },
    {
      key: 'qty',
      header: 'Qty',
      render: (row) => <span className="compact-cell-qty">{formatNumber(row.qty)}</span>,
    },
    {
      key: 'chargeable_weight',
      header: 'Weight',
      render: (row) => <span className="table-meta-text">{formatNumber(row.chargeable_weight)}</span>,
    },
    {
      key: 'billing_status',
      header: 'Status',
      render: (row) => <BillingStatusBadge status={row.billing_status} />,
    },
    {
      key: 'source_document_no',
      header: 'Doc',
      render: (row) => (
        <span className="compact-cell-text">{formatCompactText(row.source_document_no, 14)}</span>
      ),
      title: (row) => row.source_document_no,
    },
  );

  return columns;
}

function renderBillingDetail(row) {
  return (
    <>
      <DetailField label="Movement Date" value={formatDocumentDate(row.movement_date)} />
      <DetailField label="Movement Type" value={row.movement_type} />
      <DetailField label="Canonical Type" value={row.canonical_movement_type} />
      <DetailField label="Customer" value={row.customer_name ?? row.customer_code ?? row.customer_id} />
      <DetailField label="Product Code" value={row.product_code} />
      <DetailField label="Product Name" value={row.product_name} />
      <DetailField label="Lot No" value={row.lot_no ?? row.lot_id} />
      <DetailField label="Pallet No" value={row.pallet_no ?? row.pallet_id} />
      <DetailField label="Qty" value={formatNumber(row.qty)} />
      <DetailField label="UOM" value={row.uom} />
      <DetailField label="Net Weight" value={formatNumber(row.net_weight)} />
      <DetailField label="Gross Weight" value={formatNumber(row.gross_weight)} />
      <DetailField label="Chargeable Weight" value={formatNumber(row.chargeable_weight)} />
      <DetailField label="Is Billable" value={row.is_billable ? 'Yes' : 'No'} />
      <DetailField label="Billing Service Type" value={row.billing_service_type} />
      <DetailField label="Billing Status" value={row.billing_status} />
      <DetailField label="Exclusion Reason" value={row.billing_exclusion_reason} testId="billing-exclusion-reason-badge" />
      <DetailField label="Source Document No" value={row.source_document_no} />
      <DetailField label="Source Document ID" value={row.source_document_id} />
      <DetailField label="Movement ID" value={row.movement_id} />
    </>
  );
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
  if (!loading && !error && !data.length) {
    return emptyState;
  }

  const selectableRows = data.filter((row) => getSelectionState?.(row)?.selectable);
  const allSelectableSelected = selectableRows.length > 0
    && selectableRows.every((row) => selectedMovementIds.has(String(row.movement_id)));

  return (
    <CompactExpandableTable
      rows={data}
      rowKey={(row) => String(row.movement_id ?? `${row.movement_type}-${row.movement_date}`)}
      summaryColumns={buildSummaryColumns({
        selectedMovementIds,
        onToggleRow,
        onToggleAllSelectable,
        getSelectionState,
        selectableRows,
        allSelectableSelected,
      })}
      renderDetail={renderBillingDetail}
      loading={loading}
      error={error}
      emptyMessage="No billing movement weight rows found."
      tableTestId="billing-movement-weight-table"
    />
  );
}
