import { describe, expect, it, vi } from 'vitest';
import {
  UNCATEGORIZED_PRODUCT_CATEGORY, matchesProductCategory, pickDominantCategory,
} from '../../src/utils/billingRateCalc.js';

// Period billing split by product group (tgd_customer_products.product_category,
// e.g. "Raw material" vs "Finished Goods"): per-lot charges follow each
// lot's group, per-document charges (ร.3, aux services) follow the
// document's heaviest group so splitting never bills them twice.

const RM = 'Raw material';
const FG = 'Finished Goods';
const CUSTOMER_ID = 'cust-1';

describe('matchesProductCategory', () => {
  it('matches everything when no group is selected', () => {
    expect(matchesProductCategory('', RM)).toBe(true);
    expect(matchesProductCategory(null, null)).toBe(true);
  });
  it('matches the exact group only', () => {
    expect(matchesProductCategory(RM, RM)).toBe(true);
    expect(matchesProductCategory(RM, FG)).toBe(false);
  });
  it('"ไม่ระบุกลุ่ม" matches only products with no group', () => {
    expect(matchesProductCategory(UNCATEGORIZED_PRODUCT_CATEGORY, null)).toBe(true);
    expect(matchesProductCategory(UNCATEGORIZED_PRODUCT_CATEGORY, '  ')).toBe(true);
    expect(matchesProductCategory(UNCATEGORIZED_PRODUCT_CATEGORY, RM)).toBe(false);
  });
});

describe('pickDominantCategory', () => {
  it('picks the group with the most total weight', () => {
    expect(pickDominantCategory([
      { category: RM, weight: 100 }, { category: FG, weight: 60 }, { category: FG, weight: 60 },
    ])).toBe(FG);
  });
  it('breaks ties alphabetically and treats blanks as uncategorized', () => {
    expect(pickDominantCategory([{ category: RM, weight: 50 }, { category: FG, weight: 50 }])).toBe(FG);
    expect(pickDominantCategory([{ category: null, weight: 10 }])).toBe(UNCATEGORIZED_PRODUCT_CATEGORY);
    expect(pickDominantCategory([])).toBe(UNCATEGORIZED_PRODUCT_CATEGORY);
  });
});

function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every(({ type, col, val, vals }) => {
      const actual = row[col];
      if (type === 'eq') return actual === val;
      if (type === 'neq') return actual !== val;
      if (type === 'in') return vals.includes(actual);
      if (type === 'lte') return actual <= val;
      if (type === 'gte') return actual >= val;
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
      neq: (col, val) => { filters.push({ type: 'neq', col, val }); return builder; },
      in: (col, vals) => { filters.push({ type: 'in', col, vals }); return builder; },
      lte: (col, val) => { filters.push({ type: 'lte', col, val }); return builder; },
      gte: (col, val) => { filters.push({ type: 'gte', col, val }); return builder; },
      not: () => builder,
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

// Two deposits on 2026-10-05: one all Raw material, one mostly Finished
// Goods (with a small RM line) and flagged for ร.3. HANDLING_IN (weight x
// rate, per lot) stands in for any per-lot charge.
function makeDb() {
  return {
    tgd_customer_deposit_requests: [
      {
        id: 'dep-rm', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-10-05', last_action_at: '2026-10-05T10:00:00Z', requires_r3_document: false, is_overtime: false,
        tgd_customer_deposit_request_lines: [
          { id: 'l-rm-1', customer_product_code: 'RM-1', temperature_type: 'FROZEN', actual_boxes: 10, actual_weight: 100 },
        ],
      },
      {
        id: 'dep-fg', customer_id: CUSTOMER_ID, status: 'RECEIVED_CONFIRMED',
        expected_arrival_date: '2026-10-05', last_action_at: '2026-10-05T10:00:00Z', requires_r3_document: true, is_overtime: false,
        tgd_customer_deposit_request_lines: [
          { id: 'l-fg-1', customer_product_code: 'FG-1', temperature_type: 'FROZEN', actual_boxes: 30, actual_weight: 300 },
          { id: 'l-rm-2', customer_product_code: 'RM-1', temperature_type: 'FROZEN', actual_boxes: 5, actual_weight: 50 },
          { id: 'l-none', customer_product_code: 'X-1', temperature_type: 'FROZEN', actual_boxes: 1, actual_weight: 10 },
        ],
      },
    ],
    tgd_customer_withdrawal_requests: [],
    tgd_customer_deposit_request_services: [],
    tgd_customer_withdrawal_request_services: [],
    tgd_customer_document_timeline_events: [],
    tgd_customer_product_service_rates: [
      {
        id: 'rate-hin', customer_id: CUSTOMER_ID, customer_product_id: null, service_type: 'HANDLING_IN',
        rate: 1, unit_basis: 'PER_KG', currency: 'THB', is_active: true, temperature_type: null, created_at: '2026-07-01T00:00:00Z',
      },
      {
        id: 'rate-r3', customer_id: CUSTOMER_ID, customer_product_id: null, service_type: 'R3_DOCUMENT',
        rate: 30, unit_basis: 'FLAT', currency: 'THB', is_active: true, temperature_type: null, created_at: '2026-07-01T00:00:00Z',
      },
    ],
    tgd_customer_products: [
      { id: 'p-rm', customer_id: CUSTOMER_ID, customer_product_code: 'RM-1', temperature_type: 'FROZEN', product_category: RM },
      { id: 'p-fg', customer_id: CUSTOMER_ID, customer_product_code: 'FG-1', temperature_type: 'FROZEN', product_category: FG },
      { id: 'p-x', customer_id: CUSTOMER_ID, customer_product_code: 'X-1', temperature_type: 'FROZEN', product_category: null },
    ],
  };
}

async function preview(productCategory) {
  vi.resetModules();
  vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(makeDb()) }));
  const { getBillingPeriodPreview } = await import('../../src/services/billingRateEngineService.js');
  const { data, error } = await getBillingPeriodPreview({
    customerId: CUSTOMER_ID, periodStart: '2026-10-01', periodEnd: '2026-10-31', productCategory,
  });
  expect(error).toBeFalsy();
  const handlingIds = data.handlingLines.map((l) => l.depositLineId).sort();
  const r3Docs = data.auxLines.filter((l) => l.rate?.service_type === 'R3_DOCUMENT').map((l) => l.sourceRequestId);
  return { handlingIds, r3Docs };
}

describe('getBillingPeriodPreview — product group scope', () => {
  it('"ทุกกลุ่ม" bills every lot and the ร.3 fee, as before', async () => {
    const { handlingIds, r3Docs } = await preview(null);
    expect(handlingIds).toEqual(['l-fg-1', 'l-none', 'l-rm-1', 'l-rm-2']);
    expect(r3Docs).toEqual(['dep-fg']);
  });

  it('a Raw material bill takes only RM lots and none of the FG-heavy document\'s ร.3 fee', async () => {
    const { handlingIds, r3Docs } = await preview(RM);
    expect(handlingIds).toEqual(['l-rm-1', 'l-rm-2']);
    expect(r3Docs).toEqual([]);
  });

  it('a Finished Goods bill takes FG lots plus the ร.3 fee of the FG-heavy document', async () => {
    const { handlingIds, r3Docs } = await preview(FG);
    expect(handlingIds).toEqual(['l-fg-1']);
    expect(r3Docs).toEqual(['dep-fg']);
  });

  it('"ไม่ระบุกลุ่ม" takes only products with no group', async () => {
    const { handlingIds, r3Docs } = await preview(UNCATEGORIZED_PRODUCT_CATEGORY);
    expect(handlingIds).toEqual(['l-none']);
    expect(r3Docs).toEqual([]);
  });
});

describe('findOverlappingBillingPeriodDrafts — product group scope', () => {
  async function overlaps(existingCategory, newCategory) {
    vi.resetModules();
    const db = {
      tgd_billing_invoice_drafts: [{
        id: 'd1', draft_no: 'BID-1', customer_id: CUSTOMER_ID, status: 'DRAFT',
        billing_period_start: '2026-10-01', billing_period_end: '2026-10-31',
        temperature_type: null, product_category: existingCategory,
      }],
    };
    vi.doMock('../../src/services/supabaseClient.js', () => ({ supabase: makeSupabaseMock(db) }));
    const { findOverlappingBillingPeriodDrafts } = await import('../../src/services/billingInvoiceDraftService.js');
    const { data } = await findOverlappingBillingPeriodDrafts({
      customerId: CUSTOMER_ID, billingPeriodStart: '2026-10-01', billingPeriodEnd: '2026-10-31', productCategory: newCategory,
    });
    return data.length > 0;
  }

  it('lets a Raw material and a Finished Goods draft share a period', async () => {
    expect(await overlaps(RM, FG)).toBe(false);
  });
  it('still blocks the same group twice, and an all-groups draft against either', async () => {
    expect(await overlaps(RM, RM)).toBe(true);
    expect(await overlaps(null, FG)).toBe(true);
    expect(await overlaps(FG, null)).toBe(true);
  });
});
