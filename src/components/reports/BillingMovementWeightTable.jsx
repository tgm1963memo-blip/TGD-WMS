import { CompactExpandableTable } from '../ui/CompactExpandableTable.jsx';
import { formatDetailValue, formatDocumentDate } from '../../utils/documentDisplayUtils.js';

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

// Movement rows come in one-per-line; group them by source document so the
// table shows one row per document (matching how staff think about billing —
// "this receiving document" — not one row per SKU line), with totals summed
// across the document's lines. Expanding a document row reveals its lines.
function groupRowsByDocument(rows = []) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = row.source_document_no
      || row.source_document_id
      || `${row.movement_type ?? 'unknown'}-${row.movement_date ?? ''}-${row.movement_id ?? ''}`;

    if (!groups.has(key)) {
      groups.set(key, {
        document_key: key,
        source_document_no: row.source_document_no,
        source_document_id: row.source_document_id,
        movement_date: row.movement_date,
        customer_name: row.customer_name,
        customer_code: row.customer_code,
        customer_id: row.customer_id,
        lines: [],
      });
    }
    groups.get(key).lines.push(row);
  });

  return [...groups.values()].map((group) => {
    const movementTypes = [...new Set(group.lines.map((l) => l.movement_type).filter(Boolean))];
    const statuses = [...new Set(group.lines.map((l) => l.billing_status).filter(Boolean))];

    return {
      ...group,
      movement_type: movementTypes.join(', ') || null,
      billing_status: statuses.length === 1 ? statuses[0] : null,
      billing_statuses: statuses,
      total_qty: group.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0),
      total_chargeable_weight: group.lines.reduce((s, l) => s + (Number(l.chargeable_weight) || 0), 0),
      movement_ids: group.lines.map((l) => String(l.movement_id ?? '')).filter(Boolean),
    };
  });
}

function getGroupSelectionState(group, getSelectionState) {
  if (!getSelectionState || !group.lines.length) return { selectable: false, reason: null };

  const lineStates = group.lines.map((line) => getSelectionState(line));
  const selectable = lineStates.every((s) => s.selectable);
  const reason = selectable
    ? null
    : (lineStates.find((s) => !s.selectable)?.reason ?? 'Some lines in this document are not selectable.');

  return { selectable, reason };
}

function buildSummaryColumns({
  groups,
  selectedMovementIds,
  onToggleRow,
  onToggleAllSelectable,
  getSelectionState,
  selectableGroups,
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
          disabled={!selectableGroups.length}
          onChange={() => onToggleAllSelectable?.(selectableGroups.flatMap((group) => group.movement_ids))}
          data-testid="billing-movement-select-all-checkbox"
          aria-label="Select all billable rows"
        />
      ),
      render: (group) => {
        const selectionState = getGroupSelectionState(group, getSelectionState);
        const allSelected = group.movement_ids.length > 0
          && group.movement_ids.every((id) => selectedMovementIds.has(id));

        return (
          <input
            type="checkbox"
            checked={allSelected}
            disabled={!selectionState.selectable}
            title={selectionState.reason ?? 'Selectable for invoice draft'}
            onChange={() => {
              group.movement_ids.forEach((id) => {
                const isSelected = selectedMovementIds.has(id);
                if (allSelected ? isSelected : !isSelected) onToggleRow?.(id);
              });
            }}
            data-testid="billing-movement-row-checkbox"
            aria-label={`Select document ${group.source_document_no ?? group.lines[0]?.movement_id ?? group.document_key}`}
          />
        );
      },
    });
  }

  columns.push(
    {
      key: 'movement_date',
      header: 'วันที่',
      render: (row) => <span className="table-meta-text">{formatDocumentDate(row.movement_date)}</span>,
    },
    {
      key: 'source_document_no',
      header: 'เลขที่เอกสาร',
      render: (row) => <span className="compact-cell-text">{row.source_document_no ?? '-'}</span>,
    },
    {
      key: 'customer_name',
      header: 'ชื่อลูกค้า',
      render: (row) => (
        <span className="compact-cell-text" style={{ whiteSpace: 'normal', minWidth: '150px' }}>
          {row.customer_name ?? row.customer_code ?? row.customer_id}
        </span>
      ),
      title: (row) => row.customer_name ?? row.customer_code ?? row.customer_id,
    },
    {
      key: 'movement_type',
      header: 'ประเภทเอกสาร',
      render: (row) => <span className="compact-cell-text">{row.movement_type ?? '-'}</span>,
    },
    {
      key: 'total_qty',
      header: 'จำนวนรวม',
      render: (row) => <span className="compact-cell-qty">{formatNumber(row.total_qty)}</span>,
    },
    {
      key: 'total_chargeable_weight',
      header: 'น้ำหนักรวม (กก.)',
      render: (row) => <span className="table-meta-text">{formatNumber(row.total_chargeable_weight)}</span>,
    },
    {
      key: 'billing_status',
      header: 'สถานะ',
      render: (row) => (row.billing_statuses?.length > 1
        ? <span className="status-badge status-badge--draft">Mixed</span>
        : <BillingStatusBadge status={row.billing_status} />),
    },
  );

  return columns;
}

function renderBillingDetail(group) {
  return (
    <div className="table-responsive responsive-table">
      <table className="data-table" style={{ fontSize: 12 }} data-testid="billing-movement-document-lines-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Temp</th>
            <th>Lot / Pallet</th>
            <th style={{ textAlign: 'right' }}>Qty</th>
            <th style={{ textAlign: 'right' }}>Net Wt</th>
            <th style={{ textAlign: 'right' }}>Gross Wt</th>
            <th style={{ textAlign: 'right' }}>Chargeable Wt</th>
            <th>Billing Status</th>
            <th>Exclusion Reason</th>
            <th>Movement ID</th>
          </tr>
        </thead>
        <tbody>
          {group.lines.map((line, idx) => (
            <tr key={line.movement_id ?? idx}>
              <td>{idx + 1}</td>
              <td>{line.product_name ?? line.product_code ?? '-'}</td>
              <td>{formatDetailValue(line.temperature_type)}</td>
              <td>{line.lot_no ?? line.lot_id ?? '-'}{line.pallet_no ?? line.pallet_id ? ` / ${line.pallet_no ?? line.pallet_id}` : ''}</td>
              <td style={{ textAlign: 'right' }}>{formatNumber(line.qty)}</td>
              <td style={{ textAlign: 'right' }}>{formatNumber(line.net_weight)}</td>
              <td style={{ textAlign: 'right' }}>{formatNumber(line.gross_weight)}</td>
              <td style={{ textAlign: 'right' }}>{formatNumber(line.chargeable_weight)}</td>
              <td><BillingStatusBadge status={line.billing_status} /></td>
              <td data-testid="billing-exclusion-reason-badge">{formatDetailValue(line.billing_exclusion_reason)}</td>
              <td>{formatDetailValue(line.movement_id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
        <DetailField label="Source Document No" value={group.source_document_no} />
        <DetailField label="Source Document ID" value={group.source_document_id} />
        <DetailField label="Lines" value={group.lines.length} />
      </div>
    </div>
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

  const groups = groupRowsByDocument(data);
  const selectableGroups = groups.filter((group) => getGroupSelectionState(group, getSelectionState).selectable);
  const allSelectableSelected = selectableGroups.length > 0
    && selectableGroups.every((group) => group.movement_ids.every((id) => selectedMovementIds.has(id)));

  return (
    <CompactExpandableTable
      rows={groups}
      rowKey={(group) => group.document_key}
      summaryColumns={buildSummaryColumns({
        groups,
        selectedMovementIds,
        onToggleRow,
        onToggleAllSelectable,
        getSelectionState,
        selectableGroups,
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
