import { describe, expect, it } from 'vitest';
import { zoneNamesForLocationText } from '../../src/utils/locationGroupUtils.js';
import { buildMovementLedgerExcelRows, movementLedgerExcelLayout } from '../../src/utils/movementLedgerExcelUtils.js';

// Reports show which zone a location belongs to (zones are labels for runs of
// rows inside a room; see tgd_location_groups).

const groups = [
  { id: 'g1', zone_code: '41', name: 'โซน A · OVO', side: 'L', row_from: 21, row_to: 30 },
  { id: 'g2', zone_code: '42', name: 'โซน B', side: 'R', row_from: 1, row_to: 5 },
];

describe('zoneNamesForLocationText', () => {
  it('reads row codes, pallet codes and picker labels', () => {
    expect(zoneNamesForLocationText(groups, '41-L-25')).toBe('โซน A · OVO');
    expect(zoneNamesForLocationText(groups, '41-L-25-03')).toBe('โซน A · OVO');
    expect(zoneNamesForLocationText(groups, '41 · 41-L-30')).toBe('โซน A · OVO');
  });

  it('lists each zone once for several pallets and skips rows outside zones', () => {
    expect(zoneNamesForLocationText(groups, '41-L-21-01, 41-L-22-02, 42-R-03-01, 41-L-05-01')).toBe('โซน A · OVO, โซน B');
    expect(zoneNamesForLocationText(groups, '42-L-03')).toBe('');
  });

  it('does not match a zone from another room with the same side and row', () => {
    expect(zoneNamesForLocationText(groups, '42-L-25')).toBe('');
  });

  it('returns empty for missing input', () => {
    expect(zoneNamesForLocationText([], '41-L-25')).toBe('');
    expect(zoneNamesForLocationText(groups, '')).toBe('');
    expect(zoneNamesForLocationText(groups, null)).toBe('');
  });
});

describe('movement ledger Excel Zone column', () => {
  const base = { movement_type: 'RECEIPT', qty: 10, weight: 100, product_id: 'p1', product_name: 'สินค้า', lot_no: 'L1', tracking_code: 'FR1', location_name: '41-L-25', created_at: '2026-11-20T08:00:00Z' };

  it('adds Zone right after Location when rows carry zone_name', () => {
    const { headers, widths } = movementLedgerExcelLayout([{ ...base, zone_name: 'โซน A · OVO' }]);
    expect(headers[headers.indexOf('Location') + 1]).toBe('Zone');
    expect(widths).toHaveLength(headers.length);
    const rows = buildMovementLedgerExcelRows([{ ...base, zone_name: 'โซน A · OVO' }], new Map(), 'date');
    expect(rows.some((r) => r.Zone === 'โซน A · OVO')).toBe(true);
  });

  it('keeps the original columns for the customer report (no zone_name)', () => {
    const { headers } = movementLedgerExcelLayout([base]);
    expect(headers).not.toContain('Zone');
    const rows = buildMovementLedgerExcelRows([base], new Map(), 'date');
    expect(rows.every((r) => !('Zone' in r))).toBe(true);
  });
});
