import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BillingMovementWeightTable } from '../../src/components/reports/BillingMovementWeightTable.jsx';

const lineA = {
  movement_id: 'mv-1',
  movement_type: 'RECEIVE_CONFIRM',
  movement_date: '2026-06-01T10:00:00.000Z',
  customer_id: 'cust-1',
  customer_name: 'Alpha',
  product_name: 'Frozen Shrimp',
  lot_no: 'LOT-1',
  qty: 10,
  net_weight: 100,
  gross_weight: 105,
  chargeable_weight: 100,
  billing_status: 'READY_FOR_PREVIEW',
  source_document_no: 'OB-20260630-042523',
};

const lineB = {
  ...lineA,
  movement_id: 'mv-2',
  product_name: 'Frozen Fish',
  lot_no: 'LOT-2',
  qty: 20,
  net_weight: 200,
  gross_weight: 210,
  chargeable_weight: 200,
};

const lineOtherDoc = {
  ...lineA,
  movement_id: 'mv-3',
  source_document_no: 'OB-20260701-000001',
  qty: 5,
  chargeable_weight: 50,
};

function getSelectionState() {
  return { selectable: true, reason: null };
}

describe('BillingMovementWeightTable document grouping', () => {
  it('groups multiple lines from the same source document into a single row with summed totals', () => {
    render(
      <BillingMovementWeightTable
        data={[lineA, lineB, lineOtherDoc]}
        getSelectionState={getSelectionState}
        selectedMovementIds={new Set()}
      />,
    );

    // Two documents in the fixture -> two summary rows, not three (one per line).
    const rows = screen.getAllByText(/OB-2026/);
    expect(rows).toHaveLength(2);

    const groupedRow = screen.getByText('OB-20260630-042523').closest('tr');
    expect(within(groupedRow).getByText('30')).toBeInTheDocument(); // 10 + 20 qty
    expect(within(groupedRow).getByText('300.00')).toBeInTheDocument(); // 100 + 200 weight
  });

  it('expanding a document row reveals its individual lines', () => {
    render(
      <BillingMovementWeightTable
        data={[lineA, lineB]}
        getSelectionState={getSelectionState}
        selectedMovementIds={new Set()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Detail' }));

    const detailTable = screen.getByTestId('billing-movement-document-lines-table');
    expect(within(detailTable).getByText('Frozen Shrimp')).toBeInTheDocument();
    expect(within(detailTable).getByText('Frozen Fish')).toBeInTheDocument();
  });

  it('toggling a document checkbox selects every movement id in that document at once', () => {
    const onToggleRow = vi.fn();

    render(
      <BillingMovementWeightTable
        data={[lineA, lineB]}
        getSelectionState={getSelectionState}
        selectedMovementIds={new Set()}
        onToggleRow={onToggleRow}
      />,
    );

    fireEvent.click(screen.getByTestId('billing-movement-row-checkbox'));

    expect(onToggleRow).toHaveBeenCalledWith('mv-1');
    expect(onToggleRow).toHaveBeenCalledWith('mv-2');
    expect(onToggleRow).toHaveBeenCalledTimes(2);
  });

  it('does not re-toggle movements that are already selected when the group checkbox is unchecked', () => {
    const onToggleRow = vi.fn();

    render(
      <BillingMovementWeightTable
        data={[lineA, lineB]}
        getSelectionState={getSelectionState}
        selectedMovementIds={new Set(['mv-1'])}
        onToggleRow={onToggleRow}
      />,
    );

    // Group isn't fully selected (only mv-1 is), so clicking should select the
    // remaining line (mv-2) without flipping mv-1 back off.
    fireEvent.click(screen.getByTestId('billing-movement-row-checkbox'));

    expect(onToggleRow).toHaveBeenCalledWith('mv-2');
    expect(onToggleRow).not.toHaveBeenCalledWith('mv-1');
    expect(onToggleRow).toHaveBeenCalledTimes(1);
  });
});
