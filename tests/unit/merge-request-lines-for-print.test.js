import { describe, expect, it } from 'vitest';
import {
  mergeDepositRequestsForPrint,
  mergeWithdrawalRequestsForPrint,
} from '../../src/utils/mergeRequestLinesForPrint.js';

function depositHeader(overrides = {}) {
  return {
    id: 'req-1',
    request_no: 'CDR-0001',
    customer_id: 'cust-1',
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function depositLine(overrides = {}) {
  return {
    id: 'line-1',
    customer_product_code: 'ABC',
    lot_no: 'LOT-1',
    expected_boxes: 10,
    expected_weight: 100,
    actual_boxes: 10,
    actual_weight: 100,
    mfg_date: '2026-06-01',
    exp_date: '2027-06-01',
    ...overrides,
  };
}

describe('mergeDepositRequestsForPrint', () => {
  it('sums quantities for lines sharing the same code and lot across requests', () => {
    const entries = [
      { header: depositHeader({ id: 'req-1', request_no: 'CDR-0001', created_at: '2026-07-01T00:00:00Z' }), lines: [depositLine({ id: 'l1' })] },
      { header: depositHeader({ id: 'req-2', request_no: 'CDR-0002', created_at: '2026-07-02T00:00:00Z' }), lines: [depositLine({ id: 'l2', expected_boxes: 5, expected_weight: 50, actual_boxes: 5, actual_weight: 50 })] },
    ];

    const { lines } = mergeDepositRequestsForPrint(entries);

    expect(lines).toHaveLength(1);
    expect(lines[0].expected_boxes).toBe(15);
    expect(lines[0].expected_weight).toBe(150);
    expect(lines[0].actual_boxes).toBe(15);
    expect(lines[0].actual_weight).toBe(150);
    expect(lines[0]._mergeSourceRequestNos).toEqual(['CDR-0001', 'CDR-0002']);
  });

  it('merges lines with the same code and tracking code even when lot_no differs, flagging the conflict', () => {
    // A single LOT label can legitimately span multiple physical batches
    // with different tracking codes (and different weight_per_box — see
    // 20260725090000_recalc_weight_per_box_on_correction.sql's incident
    // notes). Grouping must key off tracking_code, not lot_no — two lines
    // sharing a tracking_code (or both lacking one) are the same batch
    // regardless of what lot_no says, so they merge; lot_no still shows up
    // as a flagged mismatch rather than being silently dropped.
    const entries = [
      { header: depositHeader({ id: 'req-1', request_no: 'CDR-0001' }), lines: [depositLine({ id: 'l1', lot_no: 'LOT-1', tracking_code: 'TRK-1' })] },
      { header: depositHeader({ id: 'req-2', request_no: 'CDR-0002' }), lines: [depositLine({ id: 'l2', lot_no: 'LOT-2', tracking_code: 'TRK-1' })] },
    ];

    const { lines } = mergeDepositRequestsForPrint(entries);

    expect(lines).toHaveLength(1);
    expect(lines[0]._mergeConflicts?.lot_no).toEqual(['LOT-1', 'LOT-2']);
  });

  it('keeps lines with the same code but a different tracking code separate', () => {
    const entries = [
      { header: depositHeader({ id: 'req-1', request_no: 'CDR-0001' }), lines: [depositLine({ id: 'l1', lot_no: 'LOT-1', tracking_code: 'TRK-1' })] },
      { header: depositHeader({ id: 'req-2', request_no: 'CDR-0002' }), lines: [depositLine({ id: 'l2', lot_no: 'LOT-1', tracking_code: 'TRK-2' })] },
    ];

    const { lines } = mergeDepositRequestsForPrint(entries);

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.tracking_code).sort()).toEqual(['TRK-1', 'TRK-2']);
  });

  it('keeps a merged quantity field null when every contributing value is null', () => {
    const entries = [
      { header: depositHeader({ id: 'req-1', request_no: 'CDR-0001' }), lines: [depositLine({ id: 'l1', actual_boxes: null, actual_weight: null })] },
      { header: depositHeader({ id: 'req-2', request_no: 'CDR-0002' }), lines: [depositLine({ id: 'l2', actual_boxes: null, actual_weight: null })] },
    ];

    const { lines } = mergeDepositRequestsForPrint(entries);

    expect(lines[0].actual_boxes).toBeNull();
    expect(lines[0].actual_weight).toBeNull();
  });

  it('records a conflict instead of throwing when identity fields disagree', () => {
    const entries = [
      { header: depositHeader({ id: 'req-1', request_no: 'CDR-0001', created_at: '2026-07-01T00:00:00Z' }), lines: [depositLine({ id: 'l1', mfg_date: '2026-06-01' })] },
      { header: depositHeader({ id: 'req-2', request_no: 'CDR-0002', created_at: '2026-07-02T00:00:00Z' }), lines: [depositLine({ id: 'l2', mfg_date: '2026-06-15' })] },
    ];

    const { lines } = mergeDepositRequestsForPrint(entries);

    expect(lines[0].mfg_date).toBe('2026-06-01');
    expect(lines[0]._mergeConflicts.mfg_date).toEqual(['2026-06-01', '2026-06-15']);
  });

  it('never merges lines with blank code and blank lot, even if identical otherwise', () => {
    const entries = [
      { header: depositHeader({ id: 'req-1', request_no: 'CDR-0001' }), lines: [depositLine({ id: 'l1', customer_product_code: null, internal_product_code: null, lot_no: null })] },
      { header: depositHeader({ id: 'req-2', request_no: 'CDR-0002' }), lines: [depositLine({ id: 'l2', customer_product_code: null, internal_product_code: null, lot_no: null })] },
    ];

    const { lines } = mergeDepositRequestsForPrint(entries);

    expect(lines).toHaveLength(2);
  });

  it('records header conflicts without dropping either source note, and keeps the first value on the field itself', () => {
    const entries = [
      { header: depositHeader({ id: 'req-1', request_no: 'CDR-0001', created_at: '2026-07-01T00:00:00Z', vehicle_registration: 'ABC-111', note: 'note from 1' }), lines: [] },
      { header: depositHeader({ id: 'req-2', request_no: 'CDR-0002', created_at: '2026-07-02T00:00:00Z', vehicle_registration: 'XYZ-222', note: 'note from 2' }), lines: [] },
    ];

    const { header } = mergeDepositRequestsForPrint(entries);

    expect(header.vehicle_registration).toBe('ABC-111');
    expect(header._merge.headerConflicts.some((c) => c.field === 'vehicle_registration')).toBe(true);
    expect(header.note).toContain('note from 1');
    expect(header.note).toContain('note from 2');
  });

  it('joins request numbers and exposes source_request_nos for 3 sources', () => {
    const entries = ['CDR-0001', 'CDR-0002', 'CDR-0003'].map((no, i) => ({
      header: depositHeader({ id: `req-${i}`, request_no: no, created_at: `2026-07-0${i + 1}T00:00:00Z` }),
      lines: [],
    }));

    const { header } = mergeDepositRequestsForPrint(entries);

    expect(header.request_no).toBe('CDR-0001, CDR-0002, CDR-0003');
    expect(header.source_request_nos).toEqual(['CDR-0001', 'CDR-0002', 'CDR-0003']);
  });

  it('blanks signature/audit fields on the merged header', () => {
    const entries = [
      { header: depositHeader({ id: 'req-1', request_no: 'CDR-0001', reviewed_by_email: 'a@x.com' }), lines: [] },
      { header: depositHeader({ id: 'req-2', request_no: 'CDR-0002', reviewed_by_email: 'b@x.com' }), lines: [] },
    ];

    const { header } = mergeDepositRequestsForPrint(entries);

    expect(header.reviewed_by_email).toBeNull();
  });
});

describe('mergeWithdrawalRequestsForPrint', () => {
  function withdrawalHeader(overrides = {}) {
    return {
      id: 'wreq-1',
      withdrawal_no: 'WDR-0001',
      customer_id: 'cust-1',
      created_at: '2026-07-01T00:00:00Z',
      ...overrides,
    };
  }

  function withdrawalLine(overrides = {}) {
    return {
      id: 'wline-1',
      customer_product_code: 'ABC',
      source_lot_no: 'LOT-1',
      requested_boxes: 10,
      requested_weight: 100,
      picked_boxes: 8,
      picked_weight: 80,
      ...overrides,
    };
  }

  it('groups by tracking_code (source_lot_no/lot_no are display-only) and sums requested/picked quantities independently', () => {
    const entries = [
      { header: withdrawalHeader({ id: 'w1', withdrawal_no: 'WDR-0001', created_at: '2026-07-01T00:00:00Z' }), lines: [withdrawalLine({ id: 'l1' })] },
      { header: withdrawalHeader({ id: 'w2', withdrawal_no: 'WDR-0002', created_at: '2026-07-02T00:00:00Z' }), lines: [withdrawalLine({ id: 'l2', requested_boxes: 4, requested_weight: 40, picked_boxes: 4, picked_weight: 40 })] },
    ];

    const { lines } = mergeWithdrawalRequestsForPrint(entries);

    expect(lines).toHaveLength(1);
    expect(lines[0].requested_boxes).toBe(14);
    expect(lines[0].requested_weight).toBe(140);
    expect(lines[0].picked_boxes).toBe(12);
    expect(lines[0].picked_weight).toBe(120);
    expect(lines[0].lot_no).toBe('LOT-1');
  });

  it('keeps withdrawal lines with the same code but a different tracking code separate, even when source_lot_no matches', () => {
    const entries = [
      { header: withdrawalHeader({ id: 'w1', withdrawal_no: 'WDR-0001' }), lines: [withdrawalLine({ id: 'l1', tracking_code: 'TRK-1' })] },
      { header: withdrawalHeader({ id: 'w2', withdrawal_no: 'WDR-0002' }), lines: [withdrawalLine({ id: 'l2', tracking_code: 'TRK-2' })] },
    ];

    const { lines } = mergeWithdrawalRequestsForPrint(entries);

    expect(lines).toHaveLength(2);
  });

  it('orders merged lines by the receiving date embedded in the tracking code (FEFO), not by source request order', () => {
    const entries = [
      // Created/listed out of date order on purpose — the merged print
      // order must follow the tracking code's embedded date, not this.
      { header: withdrawalHeader({ id: 'w1', withdrawal_no: 'WDR-0003', created_at: '2026-07-03T00:00:00Z' }), lines: [withdrawalLine({ id: 'l3', tracking_code: 'FR260801001' })] },
      { header: withdrawalHeader({ id: 'w2', withdrawal_no: 'WDR-0001', created_at: '2026-07-01T00:00:00Z' }), lines: [withdrawalLine({ id: 'l1', tracking_code: 'FR260730002' })] },
      { header: withdrawalHeader({ id: 'w3', withdrawal_no: 'WDR-0002', created_at: '2026-07-02T00:00:00Z' }), lines: [withdrawalLine({ id: 'l2', tracking_code: 'CH260729001' })] },
    ];

    const { lines } = mergeWithdrawalRequestsForPrint(entries);

    expect(lines.map((l) => l.tracking_code)).toEqual(['CH260729001', 'FR260730002', 'FR260801001']);
  });

  it('sorts undated/legacy tracking codes after every dated line, preserving their relative order', () => {
    const entries = [
      { header: withdrawalHeader({ id: 'w1' }), lines: [withdrawalLine({ id: 'l1', tracking_code: 'TRK-OLD-1' })] },
      { header: withdrawalHeader({ id: 'w2' }), lines: [withdrawalLine({ id: 'l2', tracking_code: 'FR260701001' })] },
      { header: withdrawalHeader({ id: 'w3' }), lines: [withdrawalLine({ id: 'l3', tracking_code: 'TRK-OLD-2' })] },
    ];

    const { lines } = mergeWithdrawalRequestsForPrint(entries);

    expect(lines.map((l) => l.tracking_code)).toEqual(['FR260701001', 'TRK-OLD-1', 'TRK-OLD-2']);
  });
});
