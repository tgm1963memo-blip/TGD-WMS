import { describe, expect, it } from 'vitest';
import {
  extractSalesOrderLines,
  groupSalesOrderLinesByDebtor,
  matchSalesOrderGroupsToCatalog,
  parseSalesOrderRows,
} from '../../src/utils/customerSalesOrderImportUtils.js';

// Fixture mirrors the real file's exact row shapes (verified against
// "ใบส่งสินค้า 18-7-69.xls" during planning): a block header row, one or
// more product rows, a "รวม เอกสาร" subtotal, repeated across debtors,
// with trailing "รวม วันที่ / รวม ทั้งหมด / หมายเหตุ" summary rows.
const RAW_ROWS = [
  ['บริษัท ไทย - เยอรมัน มีท โปรดักท์ จำกัด (สำนักงานใหญ่)', 'หมวดสินค้า : ทั้งหมด'],
  ['18/07/2569', 'SO-F256907/166', 'TSM-01-PA', 'บริษัท ไทยซอสเซสมาร์เก็ตติ้ง  จำกัด', ' สาขา :'],
  ['10022-9', 'บาโลน่าพริก  90 กรัม 1แถม1', '', 'ซอง', 250],
  ['10098-9', 'ค็อกเทลชีส 90 กรัม TGM 1 แถม 1', '', 'ซอง', 200],
  [' รวม เอกสาร ', 'SO-F256907/166', '', 450, 0],
  ['18/07/2569', 'SO-F256907/167', 'TSM-01-PA', 'บริษัท ไทยซอสเซสมาร์เก็ตติ้ง  จำกัด', ' สาขา :'],
  // same product code as SO/166 — must aggregate within the debtor group
  ['10022-9', 'บาโลน่าพริก  90 กรัม 1แถม1', '', 'ซอง', 100],
  ['UNKNOWN-999', 'สินค้าที่ไม่มีในแคตตาล็อก', '', 'แพ็ค', 5],
  [' รวม เอกสาร ', 'SO-F256907/167', '', 105, 0],
  ['18/07/2569', 'SO-G256907/200', 'ABC-01', 'บริษัท เอบีซี จำกัด', ' สาขา :'],
  ['10046', 'ไส้กรอกแฟร้งเฟิร์ตเตอร์ 4.5 นิ้ว (เบเกอร์รี่)', '', 'กิโลกรัม', 255],
  [' รวม เอกสาร ', 'SO-G256907/200', '', 255, 0],
  [' รวม วันที่ ', '18/07/2569', 'เอกสารใช้งาน', 3, 'รายการ'],
  [' รวม ทั้งหมด ', '', 'เอกสารใช้งาน', '', 3],
  ['หมายเหตุ', ' * = เอกสารถูกยกเลิก'],
];

const CATALOG = [
  { id: 'cat-1', customer_product_code: '10022-9', product_name: 'บาโลน่าพริก 90 กรัม' },
  { id: 'cat-2', customer_product_code: '10098-9', product_name: 'ค็อกเทลชีส 90 กรัม' },
  { id: 'cat-3', customer_product_code: '10046', product_name: 'ไส้กรอกแฟร้งเฟิร์ตเตอร์' },
];

describe('extractSalesOrderLines', () => {
  it('extracts product lines and skips headers, subtotals, and summary rows', () => {
    const lines = extractSalesOrderLines(RAW_ROWS);
    expect(lines).toHaveLength(5);
    expect(lines.every((l) => !String(l.productCode).startsWith('รวม'))).toBe(true);
  });

  it('attaches the correct SO number and debtor to each line', () => {
    const lines = extractSalesOrderLines(RAW_ROWS);
    const firstLine = lines.find((l) => l.productCode === '10022-9' && l.soNumber === 'SO-F256907/166');
    expect(firstLine).toMatchObject({ debtorCode: 'TSM-01-PA', debtorName: 'บริษัท ไทยซอสเซสมาร์เก็ตติ้ง  จำกัด', qty: 250 });
  });
});

describe('groupSalesOrderLinesByDebtor', () => {
  it('produces one group per distinct debtor', () => {
    const lines = extractSalesOrderLines(RAW_ROWS);
    const groups = groupSalesOrderLinesByDebtor(lines);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.debtorCode).sort()).toEqual(['ABC-01', 'TSM-01-PA']);
  });

  it('aggregates the same product code across multiple SOs within one debtor group', () => {
    const lines = extractSalesOrderLines(RAW_ROWS);
    const groups = groupSalesOrderLinesByDebtor(lines);
    const tsm = groups.find((g) => g.debtorCode === 'TSM-01-PA');
    const product = tsm.products.find((p) => p.productCode === '10022-9');
    expect(product.qty).toBe(350); // 250 (SO/166) + 100 (SO/167)
    expect(tsm.soNumbers.sort()).toEqual(['SO-F256907/166', 'SO-F256907/167']);
  });
});

describe('matchSalesOrderGroupsToCatalog', () => {
  it('resolves matched codes and collects unmatched ones for the blocking preview', () => {
    const { groups, unmatchedCodes } = parseSalesOrderRows(RAW_ROWS, CATALOG);
    expect(unmatchedCodes).toEqual(['UNKNOWN-999']);

    const tsm = groups.find((g) => g.debtorCode === 'TSM-01-PA');
    const matchedProduct = tsm.products.find((p) => p.productCode === '10022-9');
    expect(matchedProduct.matched).toBe(true);
    expect(matchedProduct.catalogProductId).toBe('cat-1');

    const unmatchedProduct = tsm.products.find((p) => p.productCode === 'UNKNOWN-999');
    expect(unmatchedProduct.matched).toBe(false);
    expect(unmatchedProduct.catalogProductId).toBeNull();
  });

  it('maps a weight-unit row (กิโลกรัม) to requestedWeight, not requestedBoxes', () => {
    const { groups } = parseSalesOrderRows(RAW_ROWS, CATALOG);
    const abc = groups.find((g) => g.debtorCode === 'ABC-01');
    const product = abc.products.find((p) => p.productCode === '10046');
    expect(product.requestedWeight).toBe(255);
    expect(product.requestedBoxes).toBeNull();
  });

  it('maps a count-unit row (ซอง) to requestedBoxes, not requestedWeight', () => {
    const { groups } = parseSalesOrderRows(RAW_ROWS, CATALOG);
    const tsm = groups.find((g) => g.debtorCode === 'TSM-01-PA');
    const product = tsm.products.find((p) => p.productCode === '10022-9');
    expect(product.requestedBoxes).toBe(350);
    expect(product.requestedWeight).toBeNull();
  });
});
