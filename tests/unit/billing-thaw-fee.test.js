import { describe, expect, it } from 'vitest';
import { computeHandlingOutFeeLines, findHandlingOutLinesMissingWeight } from '../../src/utils/billingRateCalc.js';
import { buildInvoiceDraftLineFromHandlingOutLine } from '../../src/utils/billingInvoiceDraftUtils.js';

// THAW (ค่าละลาย): withdrawal lines ticked "ละลาย" (requires_thaw) bill picked
// weight x a per-kg THAW rate, dated by the confirmed dispatch day — the same
// mechanism as HANDLING_OUT, selected by serviceType.

const CUSTOMER_ID = 'cust-1';

const rate = (service_type, value, unit_basis = 'PER_KG') => ({
  id: `rate-${service_type}`, customer_id: CUSTOMER_ID, customer_product_id: null,
  service_type, rate: value, unit_basis, currency: 'THB', note: null, is_active: true,
  period_days: null, temperature_type: null, max_quantity: null, created_at: '2026-01-01T00:00:00Z',
});

const LINE = {
  id: 'wl-1', withdrawalNo: 'CWR-20261105-0002', customerId: CUSTOMER_ID, customerProductId: null,
  temperatureType: 'FROZEN', productCode: 'SPC112', lotNo: 'Lot253',
  weight: 156, pickedBoxes: 16, dispatchDate: '2026-11-05', requiresThaw: true,
};
const PERIOD = { periodStart: '2026-11-01', periodEnd: '2026-11-30' };

describe('THAW fee lines', () => {
  it('bills picked weight x the THAW rate, not the HANDLING_OUT rate', () => {
    const rates = [rate('HANDLING_OUT', 0.3), rate('THAW', 1.5)];
    const [thaw] = computeHandlingOutFeeLines({ lines: [LINE], rates, ...PERIOD, serviceType: 'THAW' });
    expect(thaw.rate.service_type).toBe('THAW');
    expect(thaw.amount).toBeCloseTo(234, 2);
    // HANDLING_OUT is unaffected by the new parameter's default.
    const [out] = computeHandlingOutFeeLines({ lines: [LINE], rates, ...PERIOD });
    expect(out.rate.service_type).toBe('HANDLING_OUT');
  });

  it('bills nothing without a THAW rate, or for a flat THAW rate', () => {
    expect(computeHandlingOutFeeLines({ lines: [LINE], rates: [rate('HANDLING_OUT', 0.3)], ...PERIOD, serviceType: 'THAW' })).toEqual([]);
    expect(computeHandlingOutFeeLines({ lines: [LINE], rates: [rate('THAW', 500, 'FLAT')], ...PERIOD, serviceType: 'THAW' })).toEqual([]);
  });

  it('flags a thaw line confirmed with boxes but no picked weight', () => {
    const missing = findHandlingOutLinesMissingWeight({
      lines: [{ ...LINE, weight: 0 }], rates: [rate('THAW', 1.5)], ...PERIOD, serviceType: 'THAW',
    });
    expect(missing.map((l) => l.id)).toEqual(['wl-1']);
  });

  it('builds a draft line labelled ค่าละลาย with THAW as its type', () => {
    const [thaw] = computeHandlingOutFeeLines({ lines: [LINE], rates: [rate('THAW', 1.5)], ...PERIOD, serviceType: 'THAW' });
    const draft = buildInvoiceDraftLineFromHandlingOutLine(thaw);
    expect(draft).toMatchObject({
      source_document_type: 'THAW', movement_type: 'THAW', source_document_no: 'CWR-20261105-0002',
      chargeable_weight: 156, amount: 234, service_rate_id: 'rate-THAW',
    });
    expect(draft.line_note).toMatch(/^ค่าละลาย/);
  });
});
