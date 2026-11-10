// Draws the customer-format billing statements (Template/*.xlsx) with
// exceljs -- the community `xlsx` build used everywhere else in this app
// cannot write fonts, fills or borders, which is most of what these layouts
// are. All figures come from billingStatementModel.js; this file only decides
// where a cell goes and what it looks like.
//
// Calculated cells are written as live formulas WITH their cached result, the
// same way the hand-made files work, so accounting can still trace and
// re-run a figure in Excel, and the file also reads correctly in viewers that
// never recalculate.
import { formatThaiDate, formatThaiLongDate, formatMonthTag, STATEMENT_THEME } from './billingStatementModel.js';

const COMPANY_NAME = 'TG Cold Storage Co., Ltd.';
const COMPANY_ADDRESS = [
  '78/3 หมู่ 2 นิคมอุตสาหกรรมเวลโกรว์ ซอย 8 ถนนเทพรัตน์ (หล.34) ตำบลพิมพา ',
  'อำเภอบางปะกง จังหวัดฉะเชิงเทรา ',
  'เลขประจำตัวผู้เสียภาษี 0105569101151',
];

const FMT = { int: '#,##0', money: '#,##0.00', kg: '#,##0.000', date: 'dd/mm/yyyy', rate: '0.00', plain: '0' };
const BN = 'Browallia New';

const side = (style, color) => ({ style, color: { argb: `FF${color}` } });
const boxBorder = (style, color) => {
  const s = side(style, color);
  return { top: s, left: s, bottom: s, right: s };
};

// Two looks, measured off the hand-made files: NAVY = OVO / THAIMAX,
// LIGHT = TGM. Everything theme-specific lives here.
const THEMES = {
  [STATEMENT_THEME.NAVY]: {
    key: STATEMENT_THEME.NAVY,
    size: 16,
    titleSize: 18,
    headerFont: { name: BN, size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
    headerFill: '1F4E78',
    headerBorder: boxBorder('thin', '000000'),
    dataBorder: boxBorder('thin', '000000'),
    totalFont: { name: BN, size: 16, bold: true },
    totalFill: 'DDEBF7',
    totalBorder: boxBorder('thin', '000000'),
    totalLabel: 'รวมทั้งสิ้น',
    roundTotals: false,
    referenceFill: 'F2F2F2',
    balanceRowFill: null,
    summaryFill: 'FFF2CC',
    headerHeight: 42,
    dataHeight: 21.95,
    totalHeight: 24,
    paramHeight: 26.45,
    storageHeaderRow: 8,
    storageWidths: [18, 44, 36, 18, 14, 14, 14, 16, 12, 14, 14, 26, 18, 16, 30],
    summaryCol: 12, // L:M
    summaryRow: 4,
    addressCol: 12,
    widthScale: 1.25,
    zoom: 85,
    tabColor: null,
  },
  [STATEMENT_THEME.LIGHT]: {
    key: STATEMENT_THEME.LIGHT,
    size: 13,
    titleSize: 14,
    headerFont: { name: BN, size: 13, bold: true },
    headerFill: 'BDD7EE',
    headerBorder: { left: side('thin', 'BFBFBF'), right: side('thin', 'BFBFBF'), top: side('medium', '808080'), bottom: side('medium', '808080') },
    dataBorder: boxBorder('thin', 'BFBFBF'),
    totalFont: { name: BN, size: 14, bold: true },
    totalFill: 'FCE4D6',
    totalBorder: { left: side('thin', 'BFBFBF'), right: side('thin', 'BFBFBF'), top: side('medium', '808080'), bottom: side('medium', '808080') },
    totalLabel: 'รวม',
    roundTotals: true,
    referenceFill: null,
    balanceRowFill: 'F2F7FB',
    summaryFill: 'DDEBF7',
    headerHeight: 39.95,
    dataHeight: 17.25,
    totalHeight: 21,
    paramHeight: 20,
    storageHeaderRow: 10,
    storageWidths: [14, 34, 16, 16, 13, 15, 15, 14, 12, 14, 30, 16, 15, 16, 24],
    summaryCol: 11, // K:L
    summaryRow: 3,
    addressCol: 13,
    widthScale: 1,
    zoom: 100,
    tabColor: 'FFFF00',
  },
};

export function resolveStatementTheme(theme) {
  return THEMES[theme] ?? THEMES[STATEMENT_THEME.NAVY];
}

export async function loadExcelJs() {
  const mod = await import('exceljs');
  return mod.default ?? mod;
}

// ---- small cell helpers -------------------------------------------------------
export function colLetter(index) {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const DAY_MS = 86400000;
// A date-only cell: midnight UTC, which is what exceljs turns into the
// whole-number Excel serial (a local-midnight Date lands a day early under
// Bangkok's +7 offset).
function dateValue(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function dateSerial(dateStr) {
  const date = dateValue(dateStr);
  return date ? date.getTime() / DAY_MS + 25569 : null;
}
const formula = (text, result) => ({ formula: text, result });
const fillOf = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } });
// 'Sheet name'!A1 -- always quoted, with any apostrophe doubled.
const sheetRef = (sheetName, address) => `'${String(sheetName).replace(/'/g, "''")}'!${address}`;

function put(ws, address, value, style = {}) {
  const cell = ws.getCell(address);
  cell.value = value ?? null;
  if (style.font) cell.font = style.font;
  if (style.fill) cell.fill = fillOf(style.fill);
  if (style.border) cell.border = style.border;
  if (style.numFmt) cell.numFmt = style.numFmt;
  if (style.alignment) cell.alignment = style.alignment;
  return cell;
}

const font = (t, extra = {}) => ({ name: BN, size: t.size, ...extra });

function addCompanyBlock(ws, t, addressCol) {
  put(ws, 'A1', COMPANY_NAME, { font: { name: 'Calibri', size: 20, bold: true } });
  COMPANY_ADDRESS.forEach((line, index) => {
    put(ws, `${colLetter(addressCol)}${index + 1}`, line, {
      font: { name: 'Calibri', size: 11 }, alignment: { horizontal: 'right', vertical: 'middle' },
    });
  });
}

function setWidths(ws, widths, scale = 1) {
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = Math.round(width * scale * 100) / 100; });
}

function finishSheet(ws, t, { headerRow, lastCol, autoFilterTo = null, landscape = true }) {
  ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false, zoomScale: t.zoom }];
  if (autoFilterTo) ws.autoFilter = `A${headerRow}:${colLetter(lastCol)}${autoFilterTo}`;
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: landscape ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `1:${headerRow}`,
    margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };
}

// Generic header-row + data-rows + total-row table. Each column:
//   { header, fmt, align, fill, get(row, r), total(first, last, letter) }
// where get/total return a plain value or a { formula, result } pair.
function drawTable(ws, t, { headerRow, columns, rows, rowFill = null, emptyText = null }) {
  const firstRow = headerRow + 1;
  ws.getRow(headerRow).height = t.headerHeight;
  columns.forEach((col, index) => {
    put(ws, `${colLetter(index + 1)}${headerRow}`, col.header, {
      font: t.headerFont, fill: t.headerFill, border: t.headerBorder,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
  });

  rows.forEach((row, rowIndex) => {
    const r = firstRow + rowIndex;
    ws.getRow(r).height = t.dataHeight;
    const shade = rowFill ? rowFill(row) : null;
    columns.forEach((col, index) => {
      const override = col.font ? col.font(row) : null;
      put(ws, `${colLetter(index + 1)}${r}`, col.get(row, r, rowIndex), {
        font: override ?? font(t),
        fill: col.fill ?? shade ?? undefined,
        border: t.dataBorder,
        numFmt: col.fmt,
        alignment: { horizontal: col.align ?? (col.fmt ? 'right' : 'left'), vertical: 'middle' },
      });
    });
  });

  let lastRow = firstRow + rows.length - 1;
  if (!rows.length) {
    // No rows this period: one merged line saying so, like the hand-made
    // sheet, so an empty table is never mistaken for a broken export.
    lastRow = firstRow;
    ws.mergeCells(`A${firstRow}:${colLetter(columns.length)}${firstRow}`);
    put(ws, `A${firstRow}`, emptyText ?? '— ไม่มีรายการ —', {
      font: font(t, { italic: true }), border: t.dataBorder, alignment: { horizontal: 'center', vertical: 'middle' },
    });
    ws.getRow(firstRow).height = t.dataHeight;
  }

  const totalRow = lastRow + 1;
  ws.getRow(totalRow).height = t.totalHeight;
  columns.forEach((col, index) => {
    const letter = colLetter(index + 1);
    const value = col.total ? col.total(firstRow, lastRow, letter, rows) : null;
    put(ws, `${letter}${totalRow}`, value, {
      font: t.totalFont, fill: t.totalFill, border: t.totalBorder,
      numFmt: col.totalFmt ?? col.fmt,
      alignment: { horizontal: col.totalAlign ?? col.align ?? (col.fmt ? 'right' : 'left'), vertical: 'middle' },
    });
  });

  return { firstRow, lastRow, totalRow };
}

const sumOf = (rows, key) => rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// SUM for a column: live formula over the data rows, or a literal 0 when the
// table is the "no rows" placeholder (a SUM over that merged text row would
// be 0 anyway, but the hand-made sheet prints literals there).
function totalSum(t, key, { money = false } = {}) {
  return (first, last, letter, rows) => {
    if (!rows.length) return 0;
    const total = sumOf(rows, key);
    const range = `${letter}${first}:${letter}${last}`;
    return money && t.roundTotals ? formula(`ROUND(SUM(${range}),2)`, round2(total)) : formula(`SUM(${range})`, money ? round2(total) : total);
  };
}

const totalLabel = (t) => () => t.totalLabel;
const totalCount = (first, last, letter, rows) => (rows.length
  ? formula(`COUNTA(A${first}:A${last})&" รายการ"`, `${rows.length} รายการ`)
  : '0 รายการ');

// ---- storage sheet --------------------------------------------------------------
function drawStorageSheet(wb, t, model, sheet, { headerRow, withSummary }) {
  const ws = wb.addWorksheet(sheet.sheetName);
  if (t.tabColor) ws.properties.tabColor = { argb: `FF${t.tabColor}` };
  setWidths(ws, t.storageWidths);
  addCompanyBlock(ws, t, t.addressCol);

  const scopeText = model.category ? model.category.thai : `${sheet.roomLabel.thai}`;
  const title = t.key === STATEMENT_THEME.LIGHT
    ? `รายงานคำนวณค่าบริการรับฝากสินค้า — ${scopeText} ณ วันที่ ${formatThaiLongDate(model.periodEnd)}`
    : `รายงานคำนวณค่าบริการรับฝากสินค้า (${scopeText}) ณ วันที่ ${formatThaiLongDate(model.periodEnd)}`;
  put(ws, 'A2', title, { font: font(t, { size: t.titleSize, bold: true }) });

  const label = { font: font(t, { bold: true }), alignment: { vertical: 'middle' } };
  const input = (numFmt) => ({
    font: font(t, { color: { argb: 'FF0000FF' } }), numFmt, border: t.dataBorder, alignment: { horizontal: 'center', vertical: 'middle' },
  });
  put(ws, 'A3', 'ลูกค้า', label);
  put(ws, 'B3', model.customerName, { font: font(t), border: t.dataBorder, alignment: { vertical: 'middle' } });
  put(ws, 'A4', 'วันที่คำนวณ (Cut-off)', label);
  put(ws, 'B4', dateValue(model.periodEnd), input(FMT.date));
  put(ws, 'A5', 'อัตราค่าบริการรับฝาก (บาท/กก./รอบ)', label);
  put(ws, 'B5', sheet.rate, input(FMT.rate));
  put(ws, 'A6', 'จำนวนวันต่อ 1 รอบ', label);
  put(ws, 'B6', sheet.periodDays, input(FMT.plain));
  put(ws, 'A7', 'Cut-off งวดก่อน (คิดค่าบริการแล้วถึง)', label);
  put(ws, 'B7', dateValue(model.prevCutoff), input(FMT.date));
  for (let r = 3; r <= 7; r += 1) ws.getRow(r).height = t.paramHeight;

  const statementTitle = [
    'COLD STORAGE CHARGE STATEMENT',
    model.category ? model.category.english : (model.storageSheets.length > 1 ? sheet.roomLabel.english : null),
    model.period.wholeMonth ? model.period.englishMonth : null,
  ].filter(Boolean).join(' — ');
  if (t.key === STATEMENT_THEME.NAVY) {
    // Big boxed title between the parameters and the summary, as in the
    // OVO / THAIMAX files.
    const lastTitleCol = withSummary ? 10 : 12;
    ws.mergeCells(`D4:${colLetter(lastTitleCol)}${headerRow - 2 >= 6 ? 6 : headerRow - 2}`);
    put(ws, 'D4', statementTitle, {
      font: { name: BN, size: 24, bold: true }, border: boxBorder('medium', '000000'),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
  } else {
    put(ws, 'D4', statementTitle, { font: { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF808080' } } });
  }

  const referenceFill = t.referenceFill ?? undefined;
  const prevCutoffText = formatThaiDate(model.prevCutoff, { shortYear: true });
  const columns = [
    { header: 'รหัสสินค้า', get: (row) => String(row.productCode ?? ''), total: totalLabel(t) },
    { header: 'ชื่อสินค้า', get: (row) => row.productName },
    { header: 'เลข LOT', get: (row) => row.lotNo },
    { header: 'รหัสติดตาม', get: (row) => row.trackingCode, total: t.key === STATEMENT_THEME.NAVY ? totalCount : null },
    { header: 'สถานะ', get: (row) => row.status, align: 'center' },
    { header: 'วันที่เริ่มต้นฝาก', fmt: FMT.date, align: 'center', get: (row) => dateValue(row.startDate) },
    {
      header: 'วันที่สิ้นสุดการฝาก', fmt: FMT.date, align: 'center',
      // Still in the room -> ends on the cut-off. The OVO / THAIMAX files
      // point that at the cut-off cell (in green); the TGM ones print the date.
      get: (row) => (row.isBalance && t.key === STATEMENT_THEME.NAVY ? formula('$B$4', dateSerial(row.endDate)) : dateValue(row.endDate)),
      font: (row) => (row.isBalance && t.key === STATEMENT_THEME.NAVY ? font(t, { color: { argb: 'FF008000' } }) : null),
    },
    { header: 'น้ำหนัก (กก.)', fmt: FMT.kg, get: (row) => row.weight, total: totalSum(t, 'weight') },
    { header: 'จำนวนวันที่ฝาก (วัน)', fmt: FMT.int, get: (row, r) => formula(`G${r}-F${r}+1`, row.days) },
    { header: 'ระยะเวลาที่ฝาก (Period/รอบ)', fmt: FMT.int, get: (row, r) => formula(`MAX(M${r}-N${r},0)`, row.cycles), total: totalSum(t, 'cycles') },
    {
      header: 'อัตราค่าบริการ (บาท/กก./รอบ)', fmt: FMT.rate,
      // A lot on a different rate than the sheet header prints its own.
      get: (row) => (row.rate === sheet.rate ? formula('$B$5', row.rate) : row.rate),
    },
    {
      header: t.key === STATEMENT_THEME.NAVY ? 'ค่าบริการ (บาท)' : 'ค่าบริการรับฝาก (บาท)', fmt: FMT.money,
      get: (row, r) => formula(`ROUND(H${r}*J${r}*K${r},2)`, row.amount), total: totalSum(t, 'amount', { money: true }),
    },
    {
      header: 'รอบสะสมถึงวันสิ้นสุด (อ้างอิง)', fmt: FMT.int, fill: referenceFill,
      get: (row, r) => formula(`ROUNDUP(I${r}/${row.periodDays === sheet.periodDays ? '$B$6' : row.periodDays},0)`, row.cumulativeCycles),
    },
    { header: `รอบที่คิดแล้วถึง ${prevCutoffText} (อ้างอิง)`, fmt: FMT.int, fill: referenceFill, get: (row) => row.billedCycles },
    { header: 'แหล่งที่มายอด', fill: referenceFill, get: (row) => row.source },
  ];

  const table = drawTable(ws, t, {
    headerRow, columns, rows: sheet.rows,
    rowFill: t.balanceRowFill ? (row) => (row.isBalance ? t.balanceRowFill : null) : null,
  });
  finishSheet(ws, t, { headerRow, lastCol: columns.length, autoFilterTo: table.totalRow });
  return { ws, sheetName: sheet.sheetName, totalAddress: `L${table.totalRow}` };
}

function drawSummaryBox(ws, t, items) {
  const labelCol = colLetter(t.summaryCol);
  const valueCol = colLetter(t.summaryCol + 1);
  const start = t.summaryRow;
  const fill = t.summaryFill;
  ws.mergeCells(`${labelCol}${start}:${valueCol}${start}`);
  put(ws, `${labelCol}${start}`, 'สรุปค่าบริการรวม', {
    font: { name: BN, size: t.size + 1, bold: true }, fill, border: t.dataBorder, alignment: { horizontal: 'center', vertical: 'middle' },
  });
  items.forEach((item, index) => {
    const r = start + 1 + index;
    put(ws, `${labelCol}${r}`, item.label, { font: font(t), fill: t.key === STATEMENT_THEME.NAVY ? fill : undefined, border: t.dataBorder });
    put(ws, `${valueCol}${r}`, formula(item.ref, item.value), {
      font: font(t), fill: t.key === STATEMENT_THEME.NAVY ? fill : undefined, border: t.dataBorder, numFmt: FMT.money,
    });
  });
  const totalRow = start + 1 + items.length;
  const totalFill = t.key === STATEMENT_THEME.NAVY ? fill : t.totalFill;
  put(ws, `${labelCol}${totalRow}`, 'รวมทั้งสิ้น', { font: font(t, { bold: true }), fill: totalFill, border: t.dataBorder });
  put(ws, `${valueCol}${totalRow}`, formula(
    `SUM(${valueCol}${start + 1}:${valueCol}${totalRow - 1})`,
    round2(items.reduce((sum, item) => sum + item.value, 0)),
  ), { font: font(t, { bold: true }), fill: totalFill, border: t.dataBorder, numFmt: FMT.money });
}

// ---- fee sheets -----------------------------------------------------------------
// Shared frame for the one-time-fee sheets: company block, title, a few
// label/value lines (B5 is always the rate the row formulas point at), then
// the table on row 8.
const FEE_HEADER_ROW = 8;

function drawFeeSheet(wb, t, model, { name, title, rateLabel, rate, rateFmt = FMT.rate, basis, widths, columns, rows, emptyText, note }) {
  const ws = wb.addWorksheet(name);
  if (t.tabColor) ws.properties.tabColor = { argb: `FF${t.tabColor}` };
  setWidths(ws, widths, t.widthScale);
  addCompanyBlock(ws, t, columns.length);
  put(ws, 'A2', title, { font: font(t, { size: t.titleSize, bold: true }) });

  const label = { font: font(t, { bold: true }) };
  put(ws, 'A3', 'ลูกค้า', label);
  put(ws, 'B3', model.customerName, { font: font(t) });
  put(ws, 'A4', 'ช่วงเวลา', label);
  put(ws, 'B4', model.period.rangeText, { font: font(t) });
  if (rateLabel) {
    put(ws, 'A5', rateLabel, label);
    put(ws, 'B5', rate, { font: font(t, { color: { argb: 'FF0000FF' } }), numFmt: rateFmt, alignment: { horizontal: 'left' } });
  }
  if (basis) {
    put(ws, 'A6', 'เกณฑ์การคิด', label);
    put(ws, 'B6', basis, { font: font(t) });
  }

  const table = drawTable(ws, t, { headerRow: FEE_HEADER_ROW, columns, rows, emptyText });
  if (note) {
    put(ws, `A${table.totalRow + 2}`, note, { font: font(t, { italic: true, color: { argb: 'FFC00000' } }) });
  }
  finishSheet(ws, t, { headerRow: FEE_HEADER_ROW, lastCol: columns.length });
  return { ws, sheetName: name, totalAddress: `${colLetter(columns.length)}${table.totalRow}` };
}

// "$B$5" when the row is on the sheet's header rate, its own number otherwise.
const rateRef = (row, section) => (row.rate === section.rate ? '$B$5' : String(row.rate));

function handlingInColumns(t, section) {
  const amount = {
    header: t.key === STATEMENT_THEME.NAVY ? 'ค่าบริการ (บาท)' : 'ค่าบริการจัดการแรกเข้า (บาท)', fmt: FMT.money,
    get: (row, r) => formula(`ROUND(G${r}*${rateRef(row, section)},2)`, row.amount), total: totalSum(t, 'amount', { money: true }),
  };
  const weight = { header: 'น้ำหนักรับเข้า (กก.)', fmt: FMT.kg, get: (row) => row.weight, total: totalSum(t, 'weight') };
  const date = { header: 'วันที่รับฝากเข้า', fmt: FMT.date, align: 'center', get: (row) => dateValue(row.date) };
  const code = { header: 'รหัสสินค้า', get: (row) => String(row.productCode ?? '') };
  const productName = { header: 'ชื่อสินค้า', get: (row) => row.productName };
  const lot = { header: 'เลข LOT', get: (row) => row.lotNo };
  const tracking = { header: 'รหัสติดตาม', get: (row) => row.trackingCode };
  // Column order differs between the two hand-made layouts.
  if (t.key === STATEMENT_THEME.NAVY) {
    return {
      widths: [18, 46, 30, 18, 16, 16, 18, 22],
      columns: [
        { ...code, total: totalLabel(t) }, productName, lot, { ...tracking, total: totalCount },
        { header: 'ประเภท', align: 'center', get: (row) => row.temperature }, date, weight, amount,
      ],
    };
  }
  return {
    widths: [15, 14, 36, 18, 16, 16, 18, 22],
    columns: [
      { ...date, total: totalLabel(t) }, code, productName, lot, tracking,
      { header: 'อุณหภูมิ', align: 'center', get: (row) => row.temperature }, weight, amount,
    ],
  };
}

function lotServiceColumns(t, section) {
  return [
    { header: 'วันที่แจ้งฝาก', fmt: FMT.date, align: 'center', get: (row) => dateValue(row.date), total: totalLabel(t) },
    { header: 'เลขที่คำขอ', get: (row) => row.requestNo },
    { header: 'รหัสสินค้า', get: (row) => String(row.productCode ?? '') },
    { header: 'ชื่อสินค้า', get: (row) => row.productName },
    { header: 'Lot', get: (row) => row.lotNo },
    { header: 'รหัสติดตาม', get: (row) => row.trackingCode },
    { header: 'จำนวนกล่อง', fmt: FMT.int, get: (row) => row.boxes, total: totalSum(t, 'boxes') },
    { header: 'น้ำหนัก (กก.)', fmt: FMT.kg, get: (row) => row.weight, total: totalSum(t, 'weight') },
    { header: 'อัตรา', fmt: FMT.rate, get: (row) => (row.rate === section.rate ? formula('$B$5', row.rate) : row.rate) },
    { header: 'ค่าบริการ (บาท)', fmt: FMT.money, get: (row, r) => formula(`ROUND(H${r}*I${r},2)`, row.amount), total: totalSum(t, 'amount', { money: true }) },
  ];
}
const LOT_SERVICE_WIDTHS = [15, 18.75, 14, 34, 16, 14.5, 9.6, 15, 10, 16.25];

// The THAIMAX file keeps its handling-in sheet in a month with no receipts
// ("— ไม่มีรายการรับเข้าใหม่ —"); only for customers that have that fee.
const showsEmptyHandlingIn = (t, model) => t.key === STATEMENT_THEME.NAVY
  && !model.handlingIn && model.hasHandlingInRate && model.storageSheets.length > 0;

function drawFeeSheets(wb, t, model) {
  const drawn = [];
  const monthText = model.period.monthText;
  const scope = model.category ? ` — ${model.category.thai}` : '';

  if (model.handlingIn || showsEmptyHandlingIn(t, model)) {
    const section = model.handlingIn ?? { rows: [], rate: null, sheetTotal: 0 };
    const { widths, columns } = handlingInColumns(t, section);
    drawn.push({
      label: 'ค่าบริการจัดการแรกเข้า',
      value: section.sheetTotal,
      ...drawFeeSheet(wb, t, model, {
        name: 'ค่าบริการจัดการแรกเข้า',
        title: `รายงานคำนวณค่าบริการจัดการแรกเข้า${scope} ${monthText}`,
        rateLabel: 'อัตราค่าบริการจัดการแรกเข้า (บาท/กก.)',
        rate: section.rate,
        basis: `คิดเฉพาะยอดรับเข้าใหม่ระหว่าง ${model.period.rangeText} (ไม่คิดกับยอดยกมา)`,
        widths, columns, rows: section.rows,
        emptyText: `— ไม่มีรายการรับเข้าใหม่ใน${monthText} —`,
      }),
    });
  }
  if (model.freezing) {
    drawn.push({
      label: 'ค่าบริการแช่เยือกแข็ง (Blast Freeze)',
      value: model.freezing.sheetTotal,
      ...drawFeeSheet(wb, t, model, {
        name: 'ค่าบริการแช่เยือกแข็ง',
        title: `รายงานคำนวณค่าบริการแช่เยือกแข็ง (Blast Freeze)${scope} ${monthText}`,
        rateLabel: 'อัตราค่าบริการ (บาท/กก./ครั้ง)',
        rate: model.freezing.rate,
        widths: LOT_SERVICE_WIDTHS, columns: lotServiceColumns(t, model.freezing), rows: model.freezing.rows,
      }),
    });
  }
  if (model.slowFreeze) {
    drawn.push({
      label: 'ค่าบริการ Slow Freeze',
      value: model.slowFreeze.sheetTotal,
      ...drawFeeSheet(wb, t, model, {
        name: 'ค่าบริการ Slow Freeze',
        title: `รายงานคำนวณค่าบริการปรับอุณหภูมิ (Slow Freeze)${scope} ${monthText}`,
        rateLabel: 'อัตราค่าบริการ Slow Freeze (บาท/กก.)',
        rate: model.slowFreeze.rate,
        widths: LOT_SERVICE_WIDTHS, columns: lotServiceColumns(t, model.slowFreeze), rows: model.slowFreeze.rows,
        note: 'หมายเหตุ: LOT ในรายงานนี้รวมอยู่ในรายงานค่าบริการรับฝากแล้ว — sheet นี้คิดค่าบริการ Slow Freeze เพิ่มเติมเท่านั้น',
      }),
    });
  }
  if (model.r3) {
    const section = model.r3;
    const out = section.allWithdrawals;
    drawn.push({
      label: 'ค่าบริการใบอนุญาต ร.3',
      value: section.sheetTotal,
      ...drawFeeSheet(wb, t, model, {
        name: 'ค่าบริการใบอนุญาต ร.3',
        title: `รายงานค่าบริการใบอนุญาตให้นำหรือเคลื่อนย้ายสัตว์หรือซากสัตว์ (ร.3)${scope} ${monthText}`,
        rateLabel: 'อัตราค่าบริการ (บาท/ใบ)',
        rate: section.rate,
        rateFmt: FMT.money,
        basis: out ? '1 เลขที่คำขอเบิก (CWR) = ใบอนุญาต ร.3 จำนวน 1 ใบ' : '1 เลขที่คำขอ = ใบอนุญาต ร.3 จำนวน 1 ใบ',
        widths: [8, 15, 22, 14, 14, 18, 18.5, 18, 16.75, 16.75],
        columns: [
          { header: 'ลำดับ', fmt: FMT.plain, align: 'center', get: (row, r, index) => index + 1, total: totalLabel(t) },
          { header: out ? 'วันที่แจ้งเบิก' : 'วันที่', fmt: FMT.date, align: 'center', get: (row) => dateValue(row.date) },
          { header: out ? 'เลขที่คำขอเบิก' : 'เลขที่คำขอ', get: (row) => row.requestNo },
          { header: 'ปลายทาง', get: (row) => row.destination },
          { header: 'สถานะ', align: 'center', get: (row) => row.status },
          { header: 'จำนวนรายการสินค้า', fmt: FMT.int, get: (row) => row.lineCount, total: totalSum(t, 'lineCount') },
          { header: out ? 'น้ำหนักที่จ่ายจริง (กก.)' : 'น้ำหนัก (กก.)', fmt: FMT.kg, get: (row) => row.weight, total: totalSum(t, 'weight') },
          { header: 'จำนวนใบอนุญาต (ใบ)', fmt: FMT.int, get: (row) => row.quantity, total: totalSum(t, 'quantity') },
          { header: 'อัตรา (บาท/ใบ)', fmt: FMT.money, get: (row) => (row.rate === section.rate ? formula('$B$5', row.rate) : row.rate) },
          { header: 'ค่าบริการ (บาท)', fmt: FMT.money, get: (row, r) => formula(`ROUND(H${r}*I${r},2)`, row.amount), total: totalSum(t, 'amount', { money: true }) },
        ],
        rows: section.rows,
      }),
    });
  }
  if (model.other) {
    drawn.push({
      label: 'ค่าบริการอื่น ๆ',
      value: model.other.sheetTotal,
      ...drawFeeSheet(wb, t, model, {
        name: 'ค่าบริการอื่น ๆ',
        title: `รายงานค่าบริการอื่น ๆ${scope} ${monthText}`,
        widths: [15, 22, 30, 44, 14, 10, 12, 18],
        columns: [
          { header: 'วันที่', fmt: FMT.date, align: 'center', get: (row) => dateValue(row.date), total: totalLabel(t) },
          { header: 'เลขที่เอกสาร', get: (row) => row.documentNo },
          { header: 'รายการ', get: (row) => row.label },
          { header: 'รายละเอียด', get: (row) => row.detail },
          { header: 'ปริมาณ', fmt: FMT.kg, get: (row) => row.quantity },
          { header: 'หน่วย', align: 'center', get: (row) => row.unit },
          { header: 'อัตรา', fmt: FMT.rate, get: (row) => row.rate },
          {
            header: 'ค่าบริการ (บาท)', fmt: FMT.money,
            // Amounts the engine did not get from quantity x rate (pooled OT
            // shares, contract adjustments) are printed as they were billed.
            get: (row, r) => (row.literal || row.rate == null || row.quantity == null ? row.amount : formula(`ROUND(E${r}*G${r},2)`, row.amount)),
            total: totalSum(t, 'amount', { money: true }),
          },
        ],
        rows: model.other.rows,
      }),
    });
  }
  return drawn;
}

// Raw system exports appended after the fee sheets (Movement Ledger, Stock
// Report): plain tables, header row 1, as the hand-made files carry them.
function drawAttachmentSheet(wb, t, { sheetName, headers, widths = [], rows = [] }) {
  const ws = wb.addWorksheet(sheetName);
  setWidths(ws, headers.map((h, index) => widths[index] ?? 16));
  headers.forEach((header, index) => {
    put(ws, `${colLetter(index + 1)}1`, header, {
      font: { ...t.headerFont, size: 13 }, fill: t.headerFill, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
  });
  rows.forEach((row, rowIndex) => {
    row.forEach((value, index) => {
      put(ws, `${colLetter(index + 1)}${rowIndex + 2}`, value, {
        font: { name: BN, size: 13 }, numFmt: typeof value === 'number' ? '#,##0.###' : undefined,
      });
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  if (rows.length) ws.autoFilter = `A1:${colLetter(headers.length)}${rows.length + 1}`;
  return ws;
}

export async function buildBillingStatementWorkbook(model, { theme = STATEMENT_THEME.NAVY, attachments = [] } = {}) {
  const ExcelJS = await loadExcelJs();
  const t = resolveStatementTheme(theme);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TGC WMS';
  wb.created = new Date();
  // Excel re-runs every formula when the file opens, so what accounting sees
  // is always Excel's own arithmetic, never only the cached figure.
  wb.calcProperties.fullCalcOnLoad = true;

  // The summary box sits above the first storage table, so that table starts
  // lower when there are more fee lines than the layout's usual gap holds.
  const summaryLines = model.reconciliation.length + (showsEmptyHandlingIn(t, model) ? 1 : 0);
  const summaryEnd = t.summaryRow + 1 + summaryLines;

  const storage = model.storageSheets.map((sheet, index) => drawStorageSheet(wb, t, model, sheet, {
    headerRow: index === 0 ? Math.max(t.storageHeaderRow, summaryEnd + 1) : t.storageHeaderRow,
    withSummary: index === 0,
  }));

  let host = storage[0]?.ws;
  if (!host) {
    // Nothing stored this period (fees only): the summary gets its own sheet.
    host = wb.addWorksheet('สรุปค่าบริการ');
    setWidths(host, t.storageWidths);
    addCompanyBlock(host, t, t.addressCol);
    put(host, 'A2', `สรุปค่าบริการ ${model.period.monthText}`, { font: font(t, { size: t.titleSize, bold: true }) });
    put(host, 'A3', 'ลูกค้า', { font: font(t, { bold: true }) });
    put(host, 'B3', model.customerName, { font: font(t) });
    host.views = [{ showGridLines: false }];
  }

  const fees = drawFeeSheets(wb, t, model);
  const hostName = host.name;
  const items = [
    ...storage.map((s, index) => ({
      label: model.storageSheets[index].summaryLabel,
      ref: s.sheetName === hostName ? s.totalAddress : sheetRef(s.sheetName, s.totalAddress),
      value: model.storageSheets[index].sheetTotal,
    })),
    ...fees.map((f) => ({ label: f.label, ref: sheetRef(f.sheetName, f.totalAddress), value: f.value })),
  ];
  drawSummaryBox(host, t, items);

  attachments.filter(Boolean).forEach((attachment) => drawAttachmentSheet(wb, t, attachment));
  return wb;
}

// ---- overtime workbook ------------------------------------------------------------
export async function buildOvertimeStatementWorkbook(model) {
  const ExcelJS = await loadExcelJs();
  const t = THEMES[STATEMENT_THEME.LIGHT];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TGC WMS';
  wb.created = new Date();
  // Excel re-runs every formula when the file opens, so what accounting sees
  // is always Excel's own arithmetic, never only the cached figure.
  wb.calcProperties.fullCalcOnLoad = true;
  const cats = model.categories;
  const monthText = model.period.monthText;

  // -- daily summary --
  const ws = wb.addWorksheet('สรุปค่าล่วงเวลารายวัน');
  const typeLabel = (type) => (type === 'HOLIDAY' ? 'วันหยุดพิเศษ' : 'วันทำการ');
  const first = 1 + (model.hasHoliday ? 1 : 0); // columns before the weight columns
  const weightCols = cats.map((c, index) => colLetter(first + 1 + index));
  const totalCol = colLetter(first + cats.length + 1);
  const rateCol = colLetter(first + cats.length + 2);
  const rawCol = colLetter(first + cats.length + 3);
  const minCol = colLetter(first + cats.length + 4);
  const chargedCol = colLetter(first + cats.length + 5);
  const highlight = (row) => (row.minApplied ? 'FFF2CC' : undefined);

  const columns = [
    { header: 'วันที่', fmt: FMT.date, align: 'center', get: (row) => dateValue(row.date), total: () => 'รวม' },
    ...(model.hasHoliday ? [{ header: 'ประเภท OT', align: 'center', get: (row) => typeLabel(row.overtimeType) }] : []),
    ...cats.map((c) => ({
      header: `น้ำหนัก ${c.short} (กก.)`, fmt: FMT.kg, get: (row) => row.weightByCategory[c.key] ?? 0,
      total: (f, l, letter, rows) => formula(`ROUND(SUM(${letter}${f}:${letter}${l}),2)`, round2(rows.reduce((s, r) => s + (r.weightByCategory[c.key] ?? 0), 0))),
    })),
    {
      header: 'น้ำหนักรวม (กก.)', fmt: FMT.kg,
      get: (row, r) => formula(weightCols.map((letter) => `${letter}${r}`).join('+'), row.totalWeight),
      total: (f, l, letter, rows) => formula(`ROUND(SUM(${letter}${f}:${letter}${l}),2)`, round2(sumOf(rows, 'totalWeight'))),
    },
    {
      header: 'อัตรา', fmt: FMT.rate,
      get: (row) => {
        if (row.rate == null) return 'หลายอัตรา';
        const header = row.overtimeType === 'HOLIDAY' ? model.holiday : model.workday;
        if (header && header.rate === row.rate) return formula(row.overtimeType === 'HOLIDAY' ? '$B$7' : '$B$5', row.rate);
        return row.rate;
      },
    },
    {
      header: 'น้ำหนัก × อัตรา', fmt: FMT.money,
      // Per-product rates in one day can't be one multiplication -- print
      // the engine's own sum instead.
      get: (row, r) => (row.rate == null ? row.rawAmount : formula(`ROUND(${totalCol}${r}*${rateCol}${r},2)`, row.rawAmount)),
      total: (f, l, letter, rows) => formula(`ROUND(SUM(${letter}${f}:${letter}${l}),2)`, round2(sumOf(rows, 'rawAmount'))),
    },
    {
      header: 'ขั้นต่ำ', fmt: FMT.money, get: (row) => row.minCharge ?? 0,
      font: (row) => (row.minApplied ? font(t, { bold: true }) : null),
    },
    {
      header: 'ค่าล่วงเวลาที่คิด (บาท)', fmt: FMT.money,
      get: (row, r) => formula(`MAX(${rawCol}${r},${minCol}${r})`, row.amount),
      font: (row) => (row.minApplied ? font(t, { bold: true }) : null),
      total: (f, l, letter, rows) => formula(`ROUND(SUM(${letter}${f}:${letter}${l}),2)`, round2(sumOf(rows, 'amount'))),
    },
    ...cats.map((c) => ({
      header: `เฉลี่ยเข้า ${c.short}`, fmt: FMT.money, get: (row) => row.amountByCategory[c.key] ?? 0,
      total: (f, l, letter, rows) => formula(`ROUND(SUM(${letter}${f}:${letter}${l}),2)`, round2(rows.reduce((s, r) => s + (r.amountByCategory[c.key] ?? 0), 0))),
    })),
  ];
  setWidths(ws, columns.map((c, index) => (index === 0 ? 34 : 16.875)));
  addCompanyBlock(ws, t, columns.length);
  put(ws, 'A2', `รายงานคำนวณค่าล่วงเวลา (Overtime Service) ${monthText}`, { font: font(t, { size: t.titleSize, bold: true }) });
  const label = { font: font(t, { bold: true }) };
  const value = (numFmt) => ({ font: font(t), numFmt, alignment: { horizontal: 'left' } });
  put(ws, 'A4', 'ลูกค้า', label);
  put(ws, 'B4', model.customerName, value());
  put(ws, 'A5', 'อัตราค่าล่วงเวลา วันทำการ (บาท/กก.)', label);
  put(ws, 'B5', model.workday?.rate ?? null, value(FMT.rate));
  put(ws, 'A6', 'ขั้นต่ำ วันทำการ (บาท/ครั้ง)', label);
  put(ws, 'B6', model.workday?.minCharge ?? null, value(FMT.money));
  let headerRow = 9;
  if (model.hasHoliday) {
    put(ws, 'A7', 'อัตราค่าล่วงเวลา วันหยุดพิเศษ (บาท/กก.)', label);
    put(ws, 'B7', model.holiday?.rate ?? null, value(FMT.rate));
    put(ws, 'A8', 'ขั้นต่ำ วันหยุดพิเศษ (บาท/ครั้ง)', label);
    put(ws, 'B8', model.holiday?.minCharge ?? null, value(FMT.money));
    headerRow = 11;
  }
  put(ws, `A${headerRow - 2}`, 'เกณฑ์การคิด', label);
  put(ws, `B${headerRow - 2}`, 'คิดเป็นรายวันที่ (1 วัน = 1 ครั้ง) รวมน้ำหนักทุกกลุ่มสินค้าของวันนั้นเข้าด้วยกัน แล้วเทียบกับขั้นต่ำ จากนั้นเฉลี่ยกลับตามสัดส่วนน้ำหนัก', value());

  const table = drawTable(ws, t, { headerRow, columns, rows: model.days });
  // Days charged at the minimum are highlighted on the two cells that show it.
  model.days.forEach((row, index) => {
    const fill = highlight(row);
    if (!fill) return;
    [minCol, chargedCol].forEach((letter) => { ws.getCell(`${letter}${table.firstRow + index}`).fill = fillOf(fill); });
  });

  let r = table.totalRow + 2;
  put(ws, `A${r}`, 'สรุปแยกกลุ่มสินค้า', { font: font(t, { size: 14, bold: true }) });
  cats.forEach((c, index) => {
    r += 1;
    const allocCol = colLetter(first + cats.length + 6 + index);
    put(ws, `A${r}`, `ค่าล่วงเวลา — ${c.thai}`, { font: font(t) });
    put(ws, `D${r}`, formula(`${allocCol}${table.totalRow}`, round2(model.days.reduce((s, d) => s + (d.amountByCategory[c.key] ?? 0), 0))), { font: font(t), numFmt: FMT.money });
  });
  r += 1;
  put(ws, `A${r}`, 'รวมทั้งสิ้น', { font: font(t, { bold: true }) });
  put(ws, `D${r}`, formula(`${chargedCol}${table.totalRow}`, model.totalAmount), { font: font(t, { bold: true }), numFmt: FMT.money });
  ws.views = [{ showGridLines: false }];
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } };

  // -- one detail sheet per product group --
  model.details.forEach((detail) => {
    const dws = wb.addWorksheet(`รายละเอียด ${detail.category.short}`.slice(0, 31));
    const detailColumns = [
      { header: 'วันที่', fmt: FMT.date, align: 'center', get: (row) => dateValue(row.date), total: () => 'รวม' },
      { header: 'เลขที่คำขอ', get: (row) => row.requestNo },
      { header: 'ประเภทงาน', get: (row) => row.workType },
      { header: 'จำนวนรายการ', fmt: FMT.int, get: (row) => row.lineCount },
      { header: 'น้ำหนัก (กก.)', fmt: FMT.kg, get: (row) => row.weight, total: (f, l, letter, rows) => formula(`ROUND(SUM(${letter}${f}:${letter}${l}),2)`, round2(sumOf(rows, 'weight'))) },
      { header: 'น้ำหนักรวมทั้งวัน ทุกกลุ่ม (กก.)', fmt: FMT.kg, get: (row) => row.dayTotalWeight },
      { header: 'ค่าล่วงเวลาที่เฉลี่ยเข้ารายการนี้ (บาท)', fmt: FMT.money, get: (row) => row.amount, total: (f, l, letter, rows) => formula(`ROUND(SUM(${letter}${f}:${letter}${l}),2)`, round2(sumOf(rows, 'amount'))) },
    ];
    setWidths(dws, [14, 24, 22, 14, 18, 28, 32]);
    addCompanyBlock(dws, t, detailColumns.length);
    put(dws, 'A2', `รายละเอียดค่าล่วงเวลา — ${detail.category.thai} ${monthText}`, { font: font(t, { size: t.titleSize, bold: true }) });
    put(dws, 'A3', 'ลูกค้า', label);
    put(dws, 'B3', model.customerName, value());
    drawTable(dws, t, { headerRow: 5, columns: detailColumns, rows: detail.rows });
    finishSheet(dws, t, { headerRow: 5, lastCol: detailColumns.length });
  });

  return wb;
}

// ---- file names + download ----------------------------------------------------------
const safeName = (text) => String(text ?? '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

export function billingStatementFileName(model) {
  const scope = model.category?.short
    ?? (model.temperatureType ? model.temperatureType : null);
  return `${[safeName(model.customerCode || model.customerName), 'ค่าบริการรับฝาก', scope ? safeName(scope) : null, formatMonthTag(model.periodEnd)]
    .filter(Boolean).join('_')}.xlsx`;
}

export function overtimeStatementFileName(model) {
  const [y, m] = model.periodEnd.split('-').map(Number);
  return `${safeName(model.customerCode || model.customerName)} OT ${String(m).padStart(2, '0')}.${y + 543}.xlsx`;
}

export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
