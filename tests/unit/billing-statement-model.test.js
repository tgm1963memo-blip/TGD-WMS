import { describe, expect, it } from 'vitest';
import { computeStorageInvoiceLines, computeOvertimePoolLines } from '../../src/utils/billingRateCalc.js';
import {
  buildBillingStatementModel, buildOvertimeStatementModel, buildStorageSliceRows, addDays,
} from '../../src/utils/billingStatementModel.js';

const CUSTOMER = 'cust-1';
const storageRate = { id: 'r-storage', customer_id: CUSTOMER, customer_product_id: null, service_type: 'STORAGE', rate: 0.42, unit_basis: 'PER_KG', period_days: 15, temperature_type: null, is_active: true };

function lot(overrides = {}) {
  return {
    id: 'dl-1', customer_id: CUSTOMER, customer_product_id: null, temperature_type: 'FROZEN',
    received_weight: 500, receipt_date: '2026-10-01', withdrawal_events: [],
    customer_product_code: '10010-7', product_name: 'แซนวิสแฮม', lot_no: '264', tracking_code: 'FR261001005',
    received_boxes: 50, request_id: 'req-1', request_no: 'CDR-20261001-0001', product_category: 'Finished Goods',
    ...overrides,
  };
}

const PERIOD = { periodStart: '2026-10-01', periodEnd: '2026-10-31' };

describe('buildStorageSliceRows', () => {
  it('splits a lot into one row per dispatch in the period plus the balance at cut-off', () => {
    const rows = buildStorageSliceRows({
      depositLine: lot({ withdrawal_events: [{ weight: 200, date: '2026-10-10' }, { weight: 200, date: '2026-10-15' }] }),
      rate: storageRate, ...PERIOD,
    });
    expect(rows.map((r) => [r.status, r.endDate, r.weight, r.days, r.cumulativeCycles, r.billedCycles, r.cycles, r.amount])).toEqual([
      ['จ่ายออกแล้ว', '2026-10-10', 200, 10, 1, 0, 1, 84],
      ['จ่ายออกแล้ว', '2026-10-15', 200, 15, 1, 0, 1, 84],
      ['คงเหลือ', '2026-10-31', 100, 31, 3, 0, 3, 126],
    ]);
    expect(rows[0].source).toBe('รับเข้า ต.ค. 69');
  });

  it('counts rounds already billed up to the previous cut-off for a carried-forward lot', () => {
    // received 28/09 -> rounds start 28/09, 13/10, 28/10: one before October, two in it
    const [row] = buildStorageSliceRows({
      depositLine: lot({ receipt_date: '2026-09-28', received_weight: 10008 }), rate: storageRate, ...PERIOD,
    });
    expect(row).toMatchObject({ days: 34, cumulativeCycles: 3, billedCycles: 1, cycles: 2, amount: 8406.72, isBalance: true });
    expect(row.source).toBe('ยกมา (คงเหลือ 30/09/69)');
  });

  it('treats a dispatch after the cut-off as still in the room, and drops what left before the period', () => {
    const rows = buildStorageSliceRows({
      depositLine: lot({
        receipt_date: '2026-09-01',
        withdrawal_events: [{ weight: 100, date: '2026-09-20' }, { weight: 50, date: '2026-11-03' }],
      }),
      rate: storageRate, ...PERIOD,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'คงเหลือ', weight: 400, endDate: '2026-10-31' });
  });

  it('shows a dispatched slice that starts no new round, with a zero charge', () => {
    // received 25/09: rounds start 25/09, 10/10 -- dispatched 05/10, before the second
    const rows = buildStorageSliceRows({
      depositLine: lot({ receipt_date: '2026-09-25', withdrawal_events: [{ weight: 500, date: '2026-10-05' }] }),
      rate: storageRate, ...PERIOD,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'จ่ายออกแล้ว', cycles: 0, amount: 0 });
  });

  it('returns nothing for a lot fully dispatched before the period or received after it', () => {
    expect(buildStorageSliceRows({
      depositLine: lot({ receipt_date: '2026-08-01', withdrawal_events: [{ weight: 500, date: '2026-09-10' }] }), rate: storageRate, ...PERIOD,
    })).toEqual([]);
    expect(buildStorageSliceRows({ depositLine: lot({ receipt_date: '2026-11-02' }), rate: storageRate, ...PERIOD })).toEqual([]);
  });

  it('bills exactly the kg x rounds the rate engine bills, for any mix of receipt and dispatch dates', () => {
    let seed = 7;
    const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < 300; i += 1) {
      const receipt = addDays('2026-08-15', rand(75));
      const received = 100 * (1 + rand(20));
      const events = [];
      let remaining = received;
      for (let k = rand(4); k > 0 && remaining > 0; k -= 1) {
        const weight = Math.min(remaining, 50 * (1 + rand(8)));
        remaining -= weight;
        events.push({ weight, date: addDays(receipt, rand(90)) });
      }
      const depositLine = lot({ id: `dl-${i}`, receipt_date: receipt, received_weight: received, withdrawal_events: events });
      const engineKgRounds = computeStorageInvoiceLines({ depositLines: [depositLine], rates: [storageRate], ...PERIOD })
        .reduce((sum, l) => sum + l.weight, 0);
      const sheetKgRounds = buildStorageSliceRows({ depositLine, rate: storageRate, ...PERIOD })
        .reduce((sum, r) => sum + r.weight * r.cycles, 0);
      expect(sheetKgRounds, `lot ${i}: received ${receipt}, events ${JSON.stringify(events)}`).toBeCloseTo(engineKgRounds, 6);
    }
  });
});

describe('buildBillingStatementModel', () => {
  const handlingRate = { id: 'r-hin', customer_id: CUSTOMER, service_type: 'HANDLING_IN', rate: 0.17, unit_basis: 'PER_KG' };
  const freezeRate = { id: 'r-frz', customer_id: CUSTOMER, service_type: 'FREEZING', rate: 0.42, unit_basis: 'PER_KG' };
  const r3Rate = { id: 'r-r3', customer_id: CUSTOMER, service_type: 'R3_DOCUMENT', rate: 150, unit_basis: 'FLAT' };
  const slowRate = { id: 'r-slow', customer_id: CUSTOMER, service_type: 'OTHER', note: 'Slow Freeze', rate: 2, unit_basis: 'PER_KG' };
  const thawRate = { id: 'r-thaw', customer_id: CUSTOMER, service_type: 'THAW', rate: 1, unit_basis: 'PER_KG' };

  function preview() {
    const frozen = lot();
    const chilled = lot({ id: 'dl-2', temperature_type: 'CHILLED', tracking_code: 'CH261001008', received_weight: 1000, request_id: 'req-2', request_no: 'CDR-20261001-0002' });
    const depositLines = [frozen, chilled];
    const rates = [storageRate, handlingRate, freezeRate, r3Rate, slowRate, thawRate];
    return {
      depositLines,
      rates,
      storageLines: computeStorageInvoiceLines({ depositLines, rates, ...PERIOD }),
      handlingLines: [
        { depositLineId: 'dl-1', rate: handlingRate, weight: 500, amount: 85, receiptDate: '2026-10-01' },
        { depositLineId: 'dl-1', rate: freezeRate, weight: 500, amount: 210, receiptDate: '2026-10-01' },
      ],
      handlingOutLines: [{ rate: thawRate, weight: 30, amount: 30, dispatchDate: '2026-10-09', withdrawalNo: 'CWR-1', productCode: '10010-7', lotNo: '264' }],
      auxLines: [
        { sourceRequestId: 'wd-1', rate: r3Rate, quantity: 1, amount: 150 },
        { sourceRequestId: 'req-2', rate: slowRate, quantity: 1000, amount: 2000 },
      ],
      overtimeLines: [],
      requestInfoById: new Map([
        ['wd-1', { requestType: 'WITHDRAWAL', requestNo: 'CWR-20261001-0001', date: '2026-10-01', destination: 'TGM2', lineCount: 7, totalWeight: 2229, totalBoxes: 10 }],
        ['req-2', { requestType: 'DEPOSIT', requestNo: 'CDR-20261001-0002', date: '2026-10-01', lineCount: 1, totalWeight: 1000, totalBoxes: 50 }],
      ]),
    };
  }

  it('puts each storage room on its own sheet and every fee on the sheet the hand-made files use', () => {
    const model = buildBillingStatementModel({ preview: preview(), customer: { customer_code: 'C003', customer_name: 'OVO' }, ...PERIOD });
    expect(model.storageSheets.map((s) => [s.sheetName, s.rate, s.periodDays, s.rows.length])).toEqual([
      ['Frozen 10.69', 0.42, 15, 1],
      ['Chilled 10.69', 0.42, 15, 1],
    ]);
    expect(model.handlingIn.rows).toHaveLength(1);
    expect(model.handlingIn.rows[0]).toMatchObject({ trackingCode: 'FR261001005', weight: 500, amount: 85 });
    expect(model.freezing.rows[0]).toMatchObject({ requestNo: 'CDR-20261001-0001', boxes: 50, amount: 210 });
    expect(model.r3.rows[0]).toMatchObject({ requestNo: 'CWR-20261001-0001', destination: 'TGM2', lineCount: 7, amount: 150 });
    expect(model.r3.allWithdrawals).toBe(true);
    // billed on the request's whole received weight -> shown per lot
    expect(model.slowFreeze.rows).toEqual([expect.objectContaining({ trackingCode: 'CH261001008', weight: 1000, amount: 2000 })]);
    expect(model.other.rows).toEqual([expect.objectContaining({ label: 'ค่าบริการละลาย', documentNo: 'CWR-1', amount: 30 })]);
  });

  it('adds up to the rate engine total, section by section', () => {
    const model = buildBillingStatementModel({ preview: preview(), customer: {}, ...PERIOD });
    expect(model.reconciliation.every((r) => r.diff === 0)).toBe(true);
    expect(model.sheetGrandTotal).toBe(model.engineGrandTotal);
    // 500 x 3 x 0.42 + 1000 x 3 x 0.42 + 85 + 210 + 150 + 2000 + 30
    expect(model.sheetGrandTotal).toBe(4365);
  });

  it('keeps the storage rows on the plain formula and shows a contract adjustment as its own row', () => {
    const discounted = { ...storageRate, discount_percent: 10 };
    const depositLines = [lot()];
    const p = {
      depositLines, rates: [discounted],
      storageLines: computeStorageInvoiceLines({ depositLines, rates: [discounted], ...PERIOD }),
    };
    const model = buildBillingStatementModel({ preview: p, customer: {}, ...PERIOD });
    expect(model.storageSheets[0].sheetTotal).toBe(630);
    expect(model.other.rows).toEqual([expect.objectContaining({ label: 'ปรับยอดค่าฝากตามเงื่อนไขสัญญา', amount: -63 })]);
    expect(model.sheetGrandTotal).toBe(model.engineGrandTotal);
  });
});

describe('buildOvertimeStatementModel', () => {
  const otRate = { id: 'r-ot', customer_id: CUSTOMER, customer_product_id: null, service_type: 'OVERTIME', rate: 0.2, unit_basis: 'PER_KG', min_charge_amount: 2000, is_active: true };
  const line = (o) => ({ customerId: CUSTOMER, customerProductId: null, temperatureType: 'FROZEN', overtimeType: 'WORKDAY', ...o });

  it('pools a day across product groups, applies the minimum once and splits it back by weight', () => {
    const overtimePoolLines = computeOvertimePoolLines({
      rates: [otRate],
      lines: [
        line({ id: 'a', requestId: 'w1', requestType: 'WITHDRAWAL', requestNo: 'CWR-1', productCategory: 'Raw material', weight: 2332, workDate: '2026-10-06' }),
        line({ id: 'b', requestId: 'd1', requestType: 'DEPOSIT', requestNo: 'CDR-1', productCategory: 'Finished Goods', weight: 1868, workDate: '2026-10-06' }),
        line({ id: 'c', requestId: 'w2', requestType: 'WITHDRAWAL', requestNo: 'CWR-2', productCategory: 'Raw material', weight: 9184, workDate: '2026-10-20' }),
        line({ id: 'd', requestId: 'w2', requestType: 'WITHDRAWAL', requestNo: 'CWR-2', productCategory: 'Finished Goods', weight: 6118, workDate: '2026-10-20' }),
      ],
    });
    const model = buildOvertimeStatementModel({ overtimePoolLines, customer: { customer_code: 'C002' }, ...PERIOD });

    expect(model.categories.map((c) => c.short)).toEqual(['RM', 'FG']);
    expect(model.days).toHaveLength(2);
    // 4,200 kg x 0.20 = 840 -> minimum 2,000, split 2332 : 1868
    expect(model.days[0]).toMatchObject({ date: '2026-10-06', totalWeight: 4200, rawAmount: 840, minApplied: true, amount: 2000 });
    expect(model.days[0].amountByCategory).toEqual({ 'Raw material': 1110.48, 'Finished Goods': 889.52 });
    // 15,302 kg x 0.20 = 3,060.40 -> above the minimum
    expect(model.days[1]).toMatchObject({ rawAmount: 3060.4, minApplied: false, amount: 3060.4 });
    expect(model.days[1].amountByCategory).toEqual({ 'Raw material': 1836.8, 'Finished Goods': 1223.6 });
    expect(model.totalAmount).toBe(5060.4);

    const rm = model.details.find((d) => d.category.short === 'RM');
    expect(rm.rows).toEqual([
      { date: '2026-10-06', requestNo: 'CWR-1', workType: 'จ่ายออก (แจ้งเบิก)', lineCount: 1, weight: 2332, dayTotalWeight: 4200, amount: 1110.48 },
      { date: '2026-10-20', requestNo: 'CWR-2', workType: 'จ่ายออก (แจ้งเบิก)', lineCount: 1, weight: 9184, dayTotalWeight: 15302, amount: 1836.8 },
    ]);
    expect(model.workday).toEqual({ rate: 0.2, minCharge: 2000 });
  });
});
