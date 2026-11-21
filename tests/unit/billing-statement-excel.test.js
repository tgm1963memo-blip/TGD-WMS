import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { computeStorageInvoiceLines, computeOvertimePoolLines } from '../../src/utils/billingRateCalc.js';
import { buildBillingStatementModel, buildOvertimeStatementModel, STATEMENT_THEME } from '../../src/utils/billingStatementModel.js';
import {
  buildBillingStatementWorkbook, buildOvertimeStatementWorkbook, billingStatementFileName, overtimeStatementFileName,
} from '../../src/utils/billingStatementExcel.js';

const CUSTOMER = 'cust-1';
const PERIOD = { periodStart: '2026-10-01', periodEnd: '2026-10-31' };
const storageRate = { id: 'r-storage', customer_id: CUSTOMER, customer_product_id: null, service_type: 'STORAGE', rate: 0.42, unit_basis: 'PER_KG', period_days: 15, temperature_type: null, is_active: true };
const handlingRate = { id: 'r-hin', customer_id: CUSTOMER, service_type: 'HANDLING_IN', rate: 0.17, unit_basis: 'PER_KG' };

function makeModel({ productCategory = null } = {}) {
  const depositLines = [
    {
      id: 'dl-1', customer_id: CUSTOMER, customer_product_id: null, temperature_type: 'FROZEN', received_weight: 500,
      receipt_date: '2026-10-01', withdrawal_events: [{ weight: 200, date: '2026-10-10' }],
      customer_product_code: '10010-7', product_name: 'แซนวิสแฮม', lot_no: '264', tracking_code: 'FR261001005',
      received_boxes: 50, request_id: 'req-1', request_no: 'CDR-20261001-0001',
    },
    {
      id: 'dl-2', customer_id: CUSTOMER, customer_product_id: null, temperature_type: 'FROZEN', received_weight: 10008,
      receipt_date: '2026-09-28', withdrawal_events: [],
      customer_product_code: 'RCF085', product_name: 'หนังไก่', lot_no: 'Lot 259', tracking_code: 'FR260928002',
      received_boxes: 400, request_id: 'req-0', request_no: 'CDR-20260928-0001',
    },
  ];
  const rates = [storageRate, handlingRate];
  const preview = {
    depositLines, rates,
    storageLines: computeStorageInvoiceLines({ depositLines, rates, ...PERIOD }),
    handlingLines: [{ depositLineId: 'dl-1', rate: handlingRate, weight: 500, amount: 85, receiptDate: '2026-10-01' }],
  };
  return buildBillingStatementModel({
    preview, customer: { customer_code: 'C002', customer_name: 'บริษัท ไทย - เยอรมัน มีท โปรดักท์ จำกัด' }, productCategory, ...PERIOD,
  });
}

// Round-trip through a real .xlsx buffer so the assertions cover what Excel
// will actually open, not just the in-memory object.
async function roundTrip(workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(buffer);
  return reread;
}

const fillOf = (cell) => cell.fill?.fgColor?.argb;

describe('buildBillingStatementWorkbook', () => {
  it('draws the TGM (light) layout: header block, live formulas, summary box, cross-sheet totals', async () => {
    const model = makeModel({ productCategory: 'Finished Goods' });
    const wb = await roundTrip(await buildBillingStatementWorkbook(model, { theme: STATEMENT_THEME.LIGHT }));

    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['ค่าบริการรับฝาก', 'ค่าบริการจัดการแรกเข้า']);
    const ws = wb.getWorksheet('ค่าบริการรับฝาก');
    expect(ws.getCell('A1').value).toBe('TG Cold Storage Co., Ltd.');
    expect(ws.getCell('A2').value).toBe('รายงานคำนวณค่าบริการรับฝากสินค้า — สินค้าสำเร็จรูป (Finished Goods) ณ วันที่ 31 ตุลาคม 2569');
    expect(ws.getCell('B3').value).toBe('บริษัท ไทย - เยอรมัน มีท โปรดักท์ จำกัด');
    expect(ws.getCell('B4').value).toEqual(new Date(Date.UTC(2026, 9, 31)));
    expect(ws.getCell('B4').numFmt).toBe('dd/mm/yyyy');
    expect(ws.getCell('B5').value).toBe(0.42);
    expect(ws.getCell('B6').value).toBe(15);
    expect(ws.getCell('B7').value).toEqual(new Date(Date.UTC(2026, 8, 30)));
    expect(ws.getCell('D4').value).toBe('COLD STORAGE CHARGE STATEMENT — FINISHED GOODS — OCTOBER 2026');
    expect(ws.getCell('M3').value).toBe('เลขประจำตัวผู้เสียภาษี 0105569101151');

    // header on row 10, light blue, bold Browallia New
    expect(ws.getCell('A10').value).toBe('รหัสสินค้า');
    expect(ws.getCell('L10').value).toBe('ค่าบริการรับฝาก (บาท)');
    expect(ws.getCell('N10').value).toBe('รอบที่คิดแล้วถึง 30/09/69 (อ้างอิง)');
    expect(fillOf(ws.getCell('A10'))).toBe('FFBDD7EE');
    expect(ws.getCell('A10').font).toMatchObject({ name: 'Browallia New', size: 13, bold: true });

    // rows sorted by product code: 10010-7 (dispatched slice, then balance), RCF085
    expect(ws.getCell('D11').value).toBe('FR261001005');
    expect(ws.getCell('E11').value).toBe('จ่ายออกแล้ว');
    expect(ws.getCell('G11').value).toEqual(new Date(Date.UTC(2026, 9, 10)));
    expect(ws.getCell('I11').value).toEqual({ formula: 'G11-F11+1', result: 10 });
    expect(ws.getCell('J11').value).toEqual({ formula: 'MAX(M11-N11,0)', result: 1 });
    expect(ws.getCell('K11').value).toEqual({ formula: '$B$5', result: 0.42 });
    expect(ws.getCell('L11').value).toEqual({ formula: 'ROUND(H11*J11*K11,2)', result: 84 });
    expect(ws.getCell('M11').value).toEqual({ formula: 'ROUNDUP(I11/$B$6,0)', result: 1 });
    expect(ws.getCell('H11').numFmt).toBe('#,##0.000');
    expect(ws.getCell('L11').numFmt).toBe('#,##0.00');

    // in-stock rows are shaded, dispatched rows are not
    expect(ws.getCell('E12').value).toBe('คงเหลือ');
    expect(fillOf(ws.getCell('A12'))).toBe('FFF2F7FB');
    expect(fillOf(ws.getCell('A11'))).toBeUndefined();
    expect(ws.getCell('L13').value).toEqual({ formula: 'ROUND(H13*J13*K13,2)', result: 8406.72 });
    expect(ws.getCell('N13').value).toBe(1);

    // total row
    expect(ws.getCell('A14').value).toBe('รวม');
    expect(ws.getCell('L14').value).toEqual({ formula: 'ROUND(SUM(L11:L13),2)', result: 8868.72 });
    expect(fillOf(ws.getCell('L14'))).toBe('FFFCE4D6');

    // summary box K3:L6
    expect(ws.getCell('K3').value).toBe('สรุปค่าบริการรวม');
    expect(ws.getCell('L4').value).toEqual({ formula: 'L14', result: 8868.72 });
    expect(ws.getCell('L5').value).toEqual({ formula: "'ค่าบริการจัดการแรกเข้า'!H10", result: 85 });
    expect(ws.getCell('K6').value).toBe('รวมทั้งสิ้น');
    expect(ws.getCell('L6').value).toEqual({ formula: 'SUM(L4:L5)', result: 8953.72 });

    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 10, showGridLines: false });
    expect(ws.autoFilter).toBe('A10:O14');
    expect(ws.getColumn(2).width).toBe(34);
    expect(ws.pageSetup).toMatchObject({ orientation: 'landscape', paperSize: 9, printTitlesRow: '1:10' });

    const fee = wb.getWorksheet('ค่าบริการจัดการแรกเข้า');
    expect(fee.getCell('B5').value).toBe(0.17);
    expect(fee.getCell('A8').value).toBe('วันที่รับฝากเข้า');
    expect(fee.getCell('H9').value).toEqual({ formula: 'ROUND(G9*$B$5,2)', result: 85 });
    expect(fee.getCell('H10').value).toEqual({ formula: 'ROUND(SUM(H9:H9),2)', result: 85 });
  });

  it('draws the OVO / THAIMAX (navy) layout: navy header on row 8, cut-off formula for in-stock rows, boxed title', async () => {
    const model = makeModel();
    const wb = await roundTrip(await buildBillingStatementWorkbook(model, { theme: STATEMENT_THEME.NAVY }));
    const ws = wb.getWorksheet('ค่าบริการรับฝาก');

    expect(ws.getCell('A2').value).toBe('รายงานคำนวณค่าบริการรับฝากสินค้า (ห้องเย็นแช่แข็ง / Frozen) ณ วันที่ 31 ตุลาคม 2569');
    expect(ws.getCell('A8').value).toBe('รหัสสินค้า');
    expect(ws.getCell('L8').value).toBe('ค่าบริการ (บาท)');
    expect(fillOf(ws.getCell('A8'))).toBe('FF1F4E78');
    expect(ws.getCell('A8').font).toMatchObject({ name: 'Browallia New', size: 16, bold: true, color: { argb: 'FFFFFFFF' } });

    expect(ws.getCell('D4').value).toBe('COLD STORAGE CHARGE STATEMENT — OCTOBER 2026');
    expect(ws.getCell('D4').isMerged).toBe(true);
    expect(ws.getCell('J6').master.address).toBe('D4');

    // row 10 is the 10010-7 balance: G points at the cut-off cell
    expect(ws.getCell('E10').value).toBe('คงเหลือ');
    expect(ws.getCell('G10').value.formula).toBe('$B$4');
    expect(ws.getCell('G10').font.color.argb).toBe('FF008000');
    expect(fillOf(ws.getCell('M10'))).toBe('FFF2F2F2');

    expect(ws.getCell('A12').value).toBe('รวมทั้งสิ้น');
    expect(ws.getCell('D12').value).toEqual({ formula: 'COUNTA(A9:A11)&" รายการ"', result: '3 รายการ' });
    expect(ws.getCell('L12').value).toEqual({ formula: 'SUM(L9:L11)', result: 8868.72 });
    expect(fillOf(ws.getCell('L12'))).toBe('FFDDEBF7');

    // summary box L4:M7
    expect(ws.getCell('L4').value).toBe('สรุปค่าบริการรวม');
    expect(ws.getCell('M5').value).toEqual({ formula: 'L12', result: 8868.72 });
    expect(ws.getCell('M7').value).toEqual({ formula: 'SUM(M5:M6)', result: 8953.72 });
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 8 });

    // THAIMAX column order on the handling-in sheet
    const fee = wb.getWorksheet('ค่าบริการจัดการแรกเข้า');
    expect(fee.getCell('A8').value).toBe('รหัสสินค้า');
    expect(fee.getCell('F8').value).toBe('วันที่รับฝากเข้า');
  });

  it('says so on the handling-in sheet when nothing was received in the period (navy)', async () => {
    const model = makeModel();
    model.handlingIn = null;
    model.reconciliation = model.reconciliation.filter((r) => r.label !== 'ค่าบริการจัดการแรกเข้า');
    const wb = await roundTrip(await buildBillingStatementWorkbook(model, { theme: STATEMENT_THEME.NAVY }));
    const fee = wb.getWorksheet('ค่าบริการจัดการแรกเข้า');
    expect(fee.getCell('A9').value).toBe('— ไม่มีรายการรับเข้าใหม่ในเดือนตุลาคม 2569 —');
    expect(fee.getCell('H10').value).toBe(0);
    // (exceljs does not read a cached 0 back, so only the reference is checked)
    expect(wb.getWorksheet('ค่าบริการรับฝาก').getCell('M6').value.formula).toBe("'ค่าบริการจัดการแรกเข้า'!H10");
  });

  it('appends the raw attachment sheets after the fee sheets', async () => {
    const wb = await roundTrip(await buildBillingStatementWorkbook(makeModel(), {
      theme: STATEMENT_THEME.LIGHT,
      attachments: [{ sheetName: 'Stock Report 31.10', headers: ['ลูกค้า', 'คงเหลือ (กก.)'], widths: [30, 16], rows: [['TGM', 1500]] }],
    }));
    const ws = wb.worksheets[wb.worksheets.length - 1];
    expect(ws.name).toBe('Stock Report 31.10');
    expect(ws.getCell('A1').value).toBe('ลูกค้า');
    expect(ws.getCell('B2').value).toBe(1500);
  });

  it('names the file after the customer, scope and month', () => {
    expect(billingStatementFileName(makeModel({ productCategory: 'Finished Goods' }))).toBe('C002_ค่าบริการรับฝาก_FG_10.69.xlsx');
    expect(billingStatementFileName(makeModel())).toBe('C002_ค่าบริการรับฝาก_10.69.xlsx');
  });
});

describe('buildOvertimeStatementWorkbook', () => {
  it('draws the daily summary with live formulas and one detail sheet per product group', async () => {
    const otRate = { id: 'r-ot', customer_id: CUSTOMER, customer_product_id: null, service_type: 'OVERTIME', rate: 0.2, unit_basis: 'PER_KG', min_charge_amount: 2000, is_active: true };
    const line = (o) => ({ customerId: CUSTOMER, customerProductId: null, temperatureType: 'FROZEN', overtimeType: 'WORKDAY', ...o });
    const overtimePoolLines = computeOvertimePoolLines({
      rates: [otRate],
      lines: [
        line({ id: 'a', requestId: 'w1', requestType: 'WITHDRAWAL', requestNo: 'CWR-1', productCategory: 'Raw material', weight: 2332, workDate: '2026-10-06' }),
        line({ id: 'b', requestId: 'd1', requestType: 'DEPOSIT', requestNo: 'CDR-1', productCategory: 'Finished Goods', weight: 1868, workDate: '2026-10-06' }),
      ],
    });
    const model = buildOvertimeStatementModel({ overtimePoolLines, customer: { customer_code: 'C002', customer_name: 'TGM' }, ...PERIOD });
    const wb = await roundTrip(await buildOvertimeStatementWorkbook(model));

    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['สรุปค่าล่วงเวลารายวัน', 'รายละเอียด RM', 'รายละเอียด FG']);
    const ws = wb.getWorksheet('สรุปค่าล่วงเวลารายวัน');
    expect(ws.getCell('B5').value).toBe(0.2);
    expect(ws.getCell('B6').value).toBe(2000);
    expect([...'ABCDEFGHIJ'].map((c) => ws.getCell(`${c}9`).value)).toEqual([
      'วันที่', 'น้ำหนัก RM (กก.)', 'น้ำหนัก FG (กก.)', 'น้ำหนักรวม (กก.)', 'อัตรา', 'น้ำหนัก × อัตรา', 'ขั้นต่ำ',
      'ค่าล่วงเวลาที่คิด (บาท)', 'เฉลี่ยเข้า RM', 'เฉลี่ยเข้า FG',
    ]);
    expect(ws.getCell('D10').value).toEqual({ formula: 'B10+C10', result: 4200 });
    expect(ws.getCell('E10').value).toEqual({ formula: '$B$5', result: 0.2 });
    expect(ws.getCell('F10').value).toEqual({ formula: 'ROUND(D10*E10,2)', result: 840 });
    expect(ws.getCell('H10').value).toEqual({ formula: 'MAX(F10,G10)', result: 2000 });
    expect(ws.getCell('I10').value).toBe(1110.48);
    expect(fillOf(ws.getCell('H10'))).toBe('FFFFF2CC');
    expect(ws.getCell('A11').value).toBe('รวม');
    expect(ws.getCell('H11').value).toEqual({ formula: 'ROUND(SUM(H10:H10),2)', result: 2000 });
    expect(ws.getCell('D14').value).toEqual({ formula: 'I11', result: 1110.48 });
    expect(ws.getCell('D16').value).toEqual({ formula: 'H11', result: 2000 });

    const rm = wb.getWorksheet('รายละเอียด RM');
    expect(rm.getCell('B6').value).toBe('CWR-1');
    expect(rm.getCell('G6').value).toBe(1110.48);
    expect(overtimeStatementFileName(model)).toBe('C002 OT 10.2569.xlsx');
  });
});
