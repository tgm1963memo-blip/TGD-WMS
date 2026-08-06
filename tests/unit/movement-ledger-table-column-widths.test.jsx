import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MovementLedgerTable } from '../../src/components/reports/MovementLedgerTable.jsx';

// Regression: under the default table-layout:auto, a wrapping column (the
// product name) only gets whatever width is left over AFTER every other
// nowrap column claims its own natural content width — its own declared
// `width` was just a hint that lost this negotiation every time, no matter
// how generous. Confirmed with a real multi-page render: a ~45-character
// product name wrapped across 6-11 single-character-wide lines regardless
// of the column's declared %. Fixed by opting into fixedLayout (makes each
// column's width authoritative) with a widened, pixel-based budget and a
// minTableWidth that lets the table scroll horizontally on a narrow
// container instead of every column losing width to fit.

const row = {
  id: 'row-1', movement_date: '2026-08-01T07:00:00Z', movement_type: 'DISPATCH', movement_type_raw: 'DISPATCH',
  tracking_code: 'FR260730030', product_code: '10003-71', product_name: 'สินค้าทดสอบ',
  lot_no: '203', qty: 30, weight: 450, balanceQty: 0, balanceWeight: null,
};

describe('MovementLedgerTable column widths', () => {
  it('opts into fixedLayout with a table-wide minTableWidth, so declared widths are authoritative', () => {
    const { container } = render(<MovementLedgerTable data={[row]} />);
    const table = container.querySelector('table');
    expect(table.className).toContain('compact-table--fixed');
    expect(table.style.minWidth).toBeTruthy();
  });

  it('gives the product column meaningfully more width than the lot column', () => {
    const { container } = render(<MovementLedgerTable data={[row]} />);
    const cols = container.querySelectorAll('colgroup col');
    const widths = Array.from(cols).map((c) => parseInt(c.style.width, 10));
    // Column order: created_at, movement_type, tracking_code, product_id, lot_no, ...
    const [, , , productWidth, lotWidth] = widths;
    expect(productWidth).toBeGreaterThan(lotWidth * 3);
    expect(productWidth).toBeGreaterThanOrEqual(300);
  });
});
