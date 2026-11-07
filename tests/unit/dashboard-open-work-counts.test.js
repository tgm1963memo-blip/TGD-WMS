import { describe, expect, it, vi } from 'vitest';

// The warehouse flow counts come from customer requests. The older document
// tables must not be used for them: receiving rows never leave DRAFT and
// picking documents are never written.

const COUNTS = { tgd_customer_deposit_requests: 3, tgd_customer_withdrawal_requests: 4 };

function mockSupabase({ failTable = null } = {}) {
  const statusFilters = {};
  const from = (table) => {
    const result = table === failTable
      ? { count: null, data: null, error: { message: 'denied' } }
      : { count: COUNTS[table] ?? 99, data: [], error: null };
    const query = {
      select: () => query,
      gt: () => query,
      in: (column, values) => { if (column === 'status') statusFilters[table] = values; return query; },
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
  };
  vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: { from } }));
  return statusFilters;
}

describe('getReadOnlyDashboardSummary open work', () => {
  it('counts receiving and picking from customer requests in progress', async () => {
    vi.resetModules();
    const statusFilters = mockSupabase();
    const { getReadOnlyDashboardSummary } = await import('../../src/services/readOnlyDashboardService.js');
    const { data, error } = await getReadOnlyDashboardSummary();

    expect(error).toBeNull();
    expect(data.openReceivingRows).toBe(3);
    expect(data.openPickingRows).toBe(4);
    expect(statusFilters.tgd_customer_deposit_requests).toContain('WAREHOUSE_RECEIVING');
    expect(statusFilters.tgd_customer_deposit_requests).not.toContain('RECEIVED_CONFIRMED');
    expect(statusFilters.tgd_customer_withdrawal_requests).toEqual(['ADMIN_ACCEPTED', 'WAREHOUSE_PICKING']);
    expect(statusFilters).not.toHaveProperty('tgd_receiving_documents');
    expect(statusFilters).not.toHaveProperty('tgd_picking_documents');
  });

  it('shows a failed count as unknown, not 0, and keeps the other numbers', async () => {
    vi.resetModules();
    mockSupabase({ failTable: 'tgd_customer_withdrawal_requests' });
    const { getReadOnlyDashboardSummary } = await import('../../src/services/readOnlyDashboardService.js');
    const { data, error } = await getReadOnlyDashboardSummary();

    expect(error).toBeNull();
    expect(data.openPickingRows).toBeNull();
    expect(data.openReceivingRows).toBe(3);
  });
});
