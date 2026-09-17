import { describe, expect, it, vi } from 'vitest';

async function loadService(failAllocations = false) {
  vi.resetModules();
  const headers = Array.from({ length: 1001 }, (_, i) => ({ id: `h${i}`, customer_id: 'c1', status: 'RECEIVED_CONFIRMED' }));
  const lines = Array.from({ length: 1001 }, (_, i) => ({ id: `l${i}`, deposit_request_id: 'h0', tracking_code: `FR${i}`, customer_product_code: 'P1', product_name: 'Product' }));
  lines.push({ id: 'last', deposit_request_id: 'h1000', tracking_code: 'LAST' });
  const allocations = Array.from({ length: 1001 }, (_, i) => ({ id: `a${i}`, line_id: 'l0', tgd_locations: { location_code: i === 1000 ? 'B' : 'A' } }));
  const tables = { tgd_customer_deposit_requests: headers, tgd_customer_deposit_request_lines: lines, tgd_customer_deposit_line_locations: allocations };
  vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: {
    from(table) {
      let rows = tables[table];
      const query = {
        select: () => query,
        order: () => query,
        not: (key) => { rows = rows.filter(row => row[key] != null); return query; },
        in: (key, values) => { rows = rows.filter(row => values.includes(row[key])); return query; },
        range: (from, to) => Promise.resolve(failAllocations && table === 'tgd_customer_deposit_line_locations'
          ? { data: null, error: { message: 'Cannot read allocations' } }
          : { data: rows.slice(from, to + 1), error: null }),
      };
      return query;
    },
  } }));
  return import('../../src/services/customerDepositRequestService.js');
}

describe('location assignment export', () => {
  it('keeps headers, lines and plain location codes beyond each 1000-row boundary', async () => {
    const { listDepositLinesForLocationAssignment } = await loadService();
    const { data, error } = await listDepositLinesForLocationAssignment();
    expect(error).toBeNull();
    expect(data).toHaveLength(1002);
    expect(data.find(line => line.id === 'l0').locationCodes).toEqual(['A', 'B']);
    expect(data.find(line => line.id === 'last')).toMatchObject({ customerId: 'c1', trackingCode: 'LAST', locationCodes: [] });
  });

  it('fails visibly if allocations cannot be read instead of exporting false empty locations', async () => {
    const { listDepositLinesForLocationAssignment } = await loadService(true);
    const result = await listDepositLinesForLocationAssignment();
    expect(result.data).toBeNull();
    expect(result.error.message).toBe('Cannot read allocations');
  });
});
