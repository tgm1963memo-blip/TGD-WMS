import { describe, expect, it, vi } from 'vitest';

// Regression coverage for a real reported gap: a deposit line recorded with
// actual_boxes=0/actual_weight=0 (received_weight resolves to
// actual_weight ?? expected_weight ?? 0, so this is 0 only when actual was
// itself recorded as 0, or nothing was ever entered at all) has nothing to
// bill and nothing to flag -- it's not "unrated," it's just empty. It used
// to show up in the "รายการที่ไม่มีสัญญา/อัตรารองรับ" warning as if a rate
// needed setting up, confusing staff into thinking action was needed for a
// lot that was never actually received. Confirmed real case: two TGM lines
// both RECEIVED_CONFIRMED at the document level but recorded
// actual_boxes=0/actual_weight=0 on the line itself.
//
// Same filter-aware in-memory fake of the supabase query builder used
// elsewhere in this suite (see billing-r3-document-fee.test.js).

function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every(({ type, col, val, vals }) => {
      const actual = row[col];
      if (type === 'eq') return actual === val;
      if (type === 'in') return vals.includes(actual);
      return true;
    })
  );
}

function makeSupabaseMock(db) {
  const from = vi.fn((table) => {
    const filters = [];
    const builder = {
      select: () => builder,
      eq: (col, val) => { filters.push({ type: 'eq', col, val }); return builder; },
      in: (col, vals) => { filters.push({ type: 'in', col, vals }); return builder; },
      or: () => builder,
      order: () => builder,
      then: (resolve, reject) => {
        const rows = applyFilters(db[table] ?? [], filters);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  });
  return { from, rpc: vi.fn() };
}

const CUSTOMER_ID = 'cust-1';

function makeDb() {
  return {
    tgd_customer_deposit_requests: [
      {
        id: 'dep-zero', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-07-05', last_action_at: null, requires_r3_document: false,
        tgd_customer_deposit_request_lines: [
          {
            id: 'line-zero', customer_product_code: 'P-ZERO', internal_product_code: null,
            product_id: null, product_name: 'P-ZERO', lot_no: 'LOT-ZERO', tracking_code: 'TZ001',
            temperature_type: null, actual_boxes: 0, actual_weight: 0, expected_boxes: 10, expected_weight: 100,
          },
        ],
      },
      {
        id: 'dep-real', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-07-06', last_action_at: null, requires_r3_document: false,
        tgd_customer_deposit_request_lines: [
          {
            id: 'line-real', customer_product_code: 'P-REAL', internal_product_code: null,
            product_id: null, product_name: 'P-REAL', lot_no: 'LOT-REAL', tracking_code: 'TZ002',
            temperature_type: 'FROZEN', actual_boxes: 10, actual_weight: 100, expected_boxes: 10, expected_weight: 100,
          },
        ],
      },
    ],
    tgd_customer_withdrawal_requests: [],
    tgd_customer_deposit_request_services: [],
    tgd_customer_product_service_rates: [], // no rates configured at all
    tgd_customer_products: [],
  };
}

describe('getBillingPeriodPreview excludes a deposit line with zero received amount', () => {
  it('does not calculate a storage line or flag it as unrated for a zero-weight line, but still flags a real unrated line', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));

    const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');

    const { data, error } = await getBillingPeriodPreview({
      customerId: CUSTOMER_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(error).toBeFalsy();

    // The zero-weight line never appears anywhere -- not billed, not flagged.
    expect(data.storageLines.some((l) => l.depositLineId === 'line-zero')).toBe(false);
    expect(data.unratedDepositLines.some((u) => u.depositLineId === 'line-zero')).toBe(false);

    // The genuinely-received line with no rate configured still gets flagged,
    // and now carries its own weight so staff can judge whether it's worth
    // fixing.
    const realUnrated = data.unratedDepositLines.find((u) => u.depositLineId === 'line-real');
    expect(realUnrated).toBeTruthy();
    expect(realUnrated.weight).toBe(100);
  });
});
