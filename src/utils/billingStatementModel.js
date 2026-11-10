// Pure data shaping for the customer-format Excel billing statements (the
// layouts accounting used to build by hand -- see Template/*.xlsx). Takes the
// rate engine's own period preview (getBillingPeriodPreview) and reshapes it
// into the rows those sheets print; billingStatementExcel.js only draws it.
//
// The storage sheet is the one place this does NOT just relabel engine
// lines. The hand-made sheet prints one row per "tracking code x slice" (each
// partial dispatch in the period, plus what is still in the room at cut-off)
// and lets Excel work the charge out as
//   rounds = ROUNDUP(days stored / days per round) - rounds billed up to the
//            previous cut-off
//   amount = ROUND(kg x rounds x rate, 2)
// which bills exactly the cycles computeStorageInvoiceLines bills (every
// cycle that STARTS inside the period, on the weight present when it
// starts), only rounded per row instead of per cycle. So the two totals can
// differ by satang; `reconciliation` reports both so the UI can say so
// instead of one silently winning.
import { resolveStorageRateForLine } from './billingRateCalc.js';

export const STATEMENT_THEME = { NAVY: 'NAVY', LIGHT: 'LIGHT' };

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const ENGLISH_MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

const ROOM_LABELS = {
  FROZEN: { sheet: 'Frozen', thai: 'ห้องเย็นแช่แข็ง / Frozen', english: 'FROZEN' },
  CHILLED: { sheet: 'Chilled', thai: 'ห้องเย็น / Chilled', english: 'CHILLED' },
  AMBIENT: { sheet: 'Ambient', thai: 'อุณหภูมิห้อง / Ambient', english: 'AMBIENT' },
};
const ROOM_ORDER = ['FROZEN', 'CHILLED', 'AMBIENT'];

const CATEGORY_LABELS = {
  'raw material': { thai: 'วัตถุดิบ (Raw Material)', english: 'RAW MATERIAL', short: 'RM' },
  'finished goods': { thai: 'สินค้าสำเร็จรูป (Finished Goods)', english: 'FINISHED GOODS', short: 'FG' },
};
const UNCATEGORIZED = '__UNCATEGORIZED__';

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDateOnly(value) {
  if (!value) return null;
  return String(value).split('T')[0];
}

function toUtcMs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(dateStr, days) {
  return new Date(toUtcMs(dateStr) + days * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(startDate, endDate) {
  return Math.round((toUtcMs(endDate) - toUtcMs(startDate)) / 86400000);
}

function parts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

const pad2 = (n) => String(n).padStart(2, '0');

// dd/mm/yyyy in the Buddhist era -- only ever used inside text (titles,
// period strings); table dates stay real Gregorian date cells.
export function formatThaiDate(dateStr, { shortYear = false } = {}) {
  if (!dateStr) return '';
  const { y, m, d } = parts(dateStr);
  const be = y + 543;
  return `${pad2(d)}/${pad2(m)}/${shortYear ? String(be).slice(2) : be}`;
}

export function formatThaiLongDate(dateStr) {
  const { y, m, d } = parts(dateStr);
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

export function formatThaiMonth(dateStr) {
  const { y, m } = parts(dateStr);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function formatThaiMonthShort(dateStr) {
  const { y, m } = parts(dateStr);
  return `${THAI_MONTHS_SHORT[m - 1]} ${String(y + 543).slice(2)}`;
}

function formatEnglishMonth(dateStr) {
  const { y, m } = parts(dateStr);
  return `${ENGLISH_MONTHS[m - 1]} ${y}`;
}

// "10.69" -- the month tag the hand-made sheet names carry.
export function formatMonthTag(dateStr) {
  const { y, m } = parts(dateStr);
  return `${pad2(m)}.${String(y + 543).slice(2)}`;
}

// A period that is exactly one calendar month reads "เดือนตุลาคม 2569";
// anything else falls back to the explicit date range.
export function describePeriod(periodStart, periodEnd) {
  const s = parts(periodStart);
  const e = parts(periodEnd);
  const lastDay = new Date(Date.UTC(e.y, e.m, 0)).getUTCDate();
  const wholeMonth = s.y === e.y && s.m === e.m && s.d === 1 && e.d === lastDay;
  return {
    wholeMonth,
    monthText: wholeMonth ? `เดือน${formatThaiMonth(periodEnd)}` : `ช่วง ${formatThaiDate(periodStart)} - ${formatThaiDate(periodEnd)}`,
    rangeText: `${formatThaiDate(periodStart)} - ${formatThaiDate(periodEnd)}`,
    englishMonth: formatEnglishMonth(periodEnd),
  };
}

function storageRoomOf(temperatureType) {
  if (temperatureType === 'CHILLED' || temperatureType === 'AMBIENT') return temperatureType;
  return 'FROZEN';
}

export function describeCategory(category) {
  if (!category) return null;
  if (category === UNCATEGORIZED) return { thai: 'ไม่ระบุกลุ่ม', english: 'UNCATEGORIZED', short: 'ไม่ระบุกลุ่ม' };
  return CATEGORY_LABELS[String(category).trim().toLowerCase()]
    ?? { thai: category, english: String(category).toUpperCase(), short: category };
}

// The value that covers the most weight -- the sheet header prints ONE rate
// (and one days-per-round) that the row formulas point at; rows on a
// different one print their own value instead.
function dominantBy(items, valueOf, weightOf) {
  const weightByValue = new Map();
  for (const item of items) {
    const value = valueOf(item);
    weightByValue.set(value, (weightByValue.get(value) ?? 0) + Math.max(weightOf(item), 0));
  }
  let best = null;
  for (const [value, weight] of weightByValue) {
    if (best == null || weight > best.weight) best = { value, weight };
  }
  return best?.value ?? null;
}

const sumBy = (items, valueOf) => items.reduce((sum, item) => sum + toNumber(valueOf(item)), 0);

// One storage lot -> its statement rows (see the file header). Exported for
// the unit test that checks it against computeStorageInvoiceLines.
export function buildStorageSliceRows({ depositLine, rate, periodStart, periodEnd }) {
  const receiptDate = toDateOnly(depositLine.receipt_date);
  const periodDays = toNumber(rate?.period_days);
  if (!receiptDate || receiptDate > periodEnd || !(periodDays > 0)) return [];

  const prevCutoff = addDays(periodStart, -1);
  const billedCycles = receiptDate <= prevCutoff
    ? Math.ceil((daysBetween(receiptDate, prevCutoff) + 1) / periodDays)
    : 0;
  const receivedInPeriod = receiptDate >= periodStart;
  const source = receivedInPeriod
    ? `รับเข้า ${formatThaiMonthShort(receiptDate)}`
    : `ยกมา (คงเหลือ ${formatThaiDate(prevCutoff, { shortYear: true })})`;

  const events = (depositLine.withdrawal_events ?? [])
    .map((e) => ({ weight: toNumber(e.weight), date: toDateOnly(e.date) }))
    .filter((e) => e.date && e.weight > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let left = toNumber(depositLine.received_weight);
  for (const e of events) {
    if (e.date < periodStart) left -= e.weight;
  }
  left = round2(left);
  if (!(left > 0)) return [];

  const base = {
    depositLineId: depositLine.id,
    productCode: depositLine.customer_product_code ?? '',
    productName: depositLine.product_name ?? '',
    lotNo: depositLine.lot_no ?? '-',
    trackingCode: depositLine.tracking_code ?? '',
    startDate: receiptDate,
    billedCycles,
    rate: toNumber(rate.rate),
    periodDays,
    source,
  };
  const finish = (row) => {
    const days = daysBetween(receiptDate, row.endDate) + 1;
    const cumulativeCycles = Math.ceil(days / periodDays);
    const cycles = Math.max(cumulativeCycles - billedCycles, 0);
    return { ...base, ...row, days, cumulativeCycles, cycles, amount: round2(row.weight * cycles * base.rate) };
  };

  const rows = [];
  for (const e of events) {
    if (e.date < periodStart || e.date > periodEnd) continue;
    const weight = round2(Math.min(e.weight, left));
    if (!(weight > 0)) continue;
    left = round2(left - weight);
    rows.push(finish({ status: 'จ่ายออกแล้ว', isBalance: false, endDate: e.date, weight }));
  }
  // Whatever leaves after the cut-off was still in the room on it.
  if (left > 0) rows.push(finish({ status: 'คงเหลือ', isBalance: true, endDate: periodEnd, weight: left }));
  return rows;
}

function compareRows(a, b) {
  return String(a.productCode).localeCompare(String(b.productCode), 'en', { numeric: true })
    || String(a.trackingCode).localeCompare(String(b.trackingCode), 'en', { numeric: true })
    || (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0)
    || Number(a.isBalance) - Number(b.isBalance);
}

function isSlowFreezeRate(rate) {
  return /slow\s*freeze|ปรับอุณหภูมิ/i.test(`${rate?.service_type ?? ''} ${rate?.note ?? ''}`);
}

function serviceLabel(rate) {
  const byType = {
    HANDLING_OUT: 'ค่าบริการนำออก', THAW: 'ค่าบริการละลาย', PLUG_IN: 'ค่าเสียบปลั๊ก', LABEL: 'ค่าติดฉลาก',
    OVERTIME: 'ค่าล่วงเวลา (OT)', OVERTIME_HOLIDAY: 'ค่าล่วงเวลาวันหยุดพิเศษ (OT)', STORAGE: 'ค่าฝากสินค้า (คิดครั้งเดียว)',
  };
  return rate?.note || byType[rate?.service_type] || rate?.service_type || 'ค่าบริการเสริม';
}

const UNIT_LABELS = { PER_KG: 'กก.', PER_HOUR: 'ชม.', FLAT: 'ครั้ง', PER_UNIT: 'หน่วย', PER_PALLET: 'พาเลท', PER_TRIP: 'เที่ยว', PER_DAY: 'วัน' };

function feeSection(rows, engineTotal, extra = {}) {
  if (!rows.length) return null;
  return {
    rows,
    rate: dominantBy(rows, (r) => r.rate, (r) => r.weight ?? r.quantity ?? 1),
    sheetTotal: round2(sumBy(rows, (r) => r.amount)),
    engineTotal: round2(engineTotal),
    ...extra,
  };
}

export function buildBillingStatementModel({
  preview, customer = {}, periodStart, periodEnd, productCategory = null, temperatureType = null,
}) {
  const {
    storageLines = [], auxLines = [], handlingLines = [], handlingOutLines = [], overtimeLines = [],
    depositLines = [], rates = [], requestInfoById = new Map(),
  } = preview ?? {};
  const depositLineById = new Map(depositLines.map((dl) => [dl.id, dl]));
  const prevCutoff = addDays(periodStart, -1);
  const period = describePeriod(periodStart, periodEnd);
  const category = describeCategory(productCategory);
  const otherRows = [];

  // ---- storage ----------------------------------------------------------
  const engineStorageByLine = new Map();
  for (const sl of storageLines) {
    const bucket = engineStorageByLine.get(sl.depositLineId) ?? [];
    bucket.push(sl);
    engineStorageByLine.set(sl.depositLineId, bucket);
  }

  const rowsByRoom = new Map();
  const engineTotalByRoom = new Map();
  for (const dl of depositLines) {
    const receiptDate = toDateOnly(dl.receipt_date);
    const rate = receiptDate ? resolveStorageRateForLine(rates, dl, receiptDate) : null;
    const engineLines = engineStorageByLine.get(dl.id) ?? [];
    const engineAmount = sumBy(engineLines, (l) => l.amount);
    if (!rate) continue;

    if (rate.period_days == null) {
      // A one-time storage fee has no rounds to show -- it goes to the
      // extra-fees sheet as the engine billed it.
      for (const l of engineLines) {
        otherRows.push({
          date: receiptDate, documentNo: dl.request_no ?? '', label: serviceLabel(rate),
          detail: [dl.customer_product_code, dl.tracking_code].filter(Boolean).join(' / '),
          quantity: toNumber(l.weight), unit: 'กก.', rate: toNumber(rate.rate), amount: toNumber(l.amount), literal: true,
        });
      }
      continue;
    }

    const rows = buildStorageSliceRows({ depositLine: dl, rate, periodStart, periodEnd });
    if (!rows.length) continue;
    const room = storageRoomOf(dl.temperature_type);
    rowsByRoom.set(room, [...(rowsByRoom.get(room) ?? []), ...rows]);

    // Contract terms (free days, discount, minimum charge) have no column in
    // the hand-made layout. The storage rows keep the plain formula and the
    // difference the contract makes is one traceable row on the extra sheet.
    const adjusted = engineLines.filter((l) => l.adjustmentNote);
    const formulaAmount = sumBy(rows, (r) => r.amount);
    const adjustment = adjusted.length ? round2(engineAmount - formulaAmount) : 0;
    engineTotalByRoom.set(room, (engineTotalByRoom.get(room) ?? 0) + engineAmount - adjustment);
    if (adjustment !== 0) {
      otherRows.push({
        date: periodEnd, documentNo: dl.request_no ?? '', label: 'ปรับยอดค่าฝากตามเงื่อนไขสัญญา',
        detail: `${[dl.customer_product_code, dl.tracking_code].filter(Boolean).join(' / ')} — ${[...new Set(adjusted.map((l) => l.adjustmentNote))].join('; ')}`,
        quantity: null, unit: '', rate: null, amount: adjustment, literal: true,
      });
    }
  }

  const rooms = ROOM_ORDER.filter((room) => rowsByRoom.has(room));
  const storageSheets = rooms.map((room) => {
    const rows = rowsByRoom.get(room).sort(compareRows);
    return {
      room,
      roomLabel: ROOM_LABELS[room],
      sheetName: rooms.length > 1 ? `${ROOM_LABELS[room].sheet} ${formatMonthTag(periodEnd)}` : 'ค่าบริการรับฝาก',
      summaryLabel: rooms.length > 1 ? `ค่าบริการรับฝากสินค้า (${ROOM_LABELS[room].sheet})` : 'ค่าบริการรับฝากสินค้า',
      rate: dominantBy(rows, (r) => r.rate, (r) => r.weight),
      periodDays: dominantBy(rows, (r) => r.periodDays, (r) => r.weight),
      rows,
      totalWeight: round2(sumBy(rows, (r) => r.weight)),
      totalCycles: sumBy(rows, (r) => r.cycles),
      sheetTotal: round2(sumBy(rows, (r) => r.amount)),
      engineTotal: round2(engineTotalByRoom.get(room) ?? 0),
    };
  });

  // ---- one-time fees per lot: handling-in, blast freeze ------------------
  const lotFeeRow = (hl) => {
    const dl = depositLineById.get(hl.depositLineId) ?? {};
    return {
      date: toDateOnly(hl.receiptDate ?? dl.receipt_date),
      requestNo: dl.request_no ?? '',
      productCode: dl.customer_product_code ?? '',
      productName: dl.product_name ?? '',
      lotNo: dl.lot_no ?? '-',
      trackingCode: dl.tracking_code ?? '',
      temperature: dl.lot_temperature_type ?? dl.temperature_type ?? '',
      boxes: toNumber(dl.received_boxes),
      weight: toNumber(hl.weight),
      rate: toNumber(hl.rate?.rate),
      amount: toNumber(hl.amount),
    };
  };
  const byDateThenCode = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || compareRows(a, b);
  const handlingInLines = handlingLines.filter((hl) => hl.rate?.service_type !== 'FREEZING');
  const freezingLines = handlingLines.filter((hl) => hl.rate?.service_type === 'FREEZING');
  const handlingIn = feeSection(handlingInLines.map(lotFeeRow).sort(byDateThenCode), sumBy(handlingInLines, (l) => l.amount));
  const freezing = feeSection(freezingLines.map(lotFeeRow).sort(byDateThenCode), sumBy(freezingLines, (l) => l.amount));

  // ---- per-request services: Slow Freeze, ร.3, everything else ------------
  const linesByRequest = new Map();
  for (const dl of depositLines) {
    if (!dl.request_id) continue;
    linesByRequest.set(dl.request_id, [...(linesByRequest.get(dl.request_id) ?? []), dl]);
  }

  const slowFreezeRows = [];
  const r3Rows = [];
  let slowFreezeEngine = 0;
  let r3Engine = 0;
  for (const al of auxLines) {
    const rate = al.rate ?? {};
    const info = requestInfoById.get(al.sourceRequestId) ?? {};
    if (rate.service_type === 'R3_DOCUMENT') {
      r3Engine += toNumber(al.amount);
      r3Rows.push({
        date: toDateOnly(info.date), requestNo: info.requestNo ?? '', requestType: info.requestType ?? null,
        destination: info.destination ?? '-', status: 'เสร็จสิ้น', lineCount: toNumber(info.lineCount),
        weight: toNumber(info.totalWeight), quantity: toNumber(al.quantity, 1), rate: toNumber(rate.rate), amount: toNumber(al.amount),
      });
    } else if (isSlowFreezeRate(rate)) {
      slowFreezeEngine += toNumber(al.amount);
      const lots = (linesByRequest.get(al.sourceRequestId) ?? []).filter((dl) => toNumber(dl.received_weight) > 0);
      const lotWeight = sumBy(lots, (dl) => dl.received_weight);
      // Billed on the request's whole received weight -> show it per lot, the
      // way the hand-made sheet does. Any other quantity can't be split by
      // lot without guessing, so it stays one row for the request.
      if (rate.unit_basis === 'PER_KG' && lots.length && Math.abs(lotWeight - toNumber(al.quantity)) < 0.01) {
        for (const dl of lots) {
          slowFreezeRows.push({
            date: toDateOnly(info.date ?? dl.receipt_date), requestNo: info.requestNo ?? dl.request_no ?? '',
            productCode: dl.customer_product_code ?? '', productName: dl.product_name ?? '', lotNo: dl.lot_no ?? '-',
            trackingCode: dl.tracking_code ?? '', boxes: toNumber(dl.received_boxes), weight: toNumber(dl.received_weight),
            rate: toNumber(rate.rate), amount: round2(toNumber(dl.received_weight) * toNumber(rate.rate)),
          });
        }
      } else {
        slowFreezeRows.push({
          date: toDateOnly(info.date), requestNo: info.requestNo ?? '', productCode: '', productName: serviceLabel(rate),
          lotNo: '-', trackingCode: '', boxes: toNumber(info.totalBoxes), weight: toNumber(al.quantity),
          rate: toNumber(rate.rate), amount: toNumber(al.amount),
        });
      }
    } else {
      otherRows.push({
        date: toDateOnly(info.date), documentNo: info.requestNo ?? '', label: serviceLabel(rate), detail: al.note ?? '',
        quantity: toNumber(al.quantity), unit: UNIT_LABELS[rate.unit_basis] ?? rate.unit_basis ?? '',
        rate: toNumber(rate.rate), amount: toNumber(al.amount),
      });
    }
  }
  const slowFreeze = feeSection(slowFreezeRows.sort(byDateThenCode), slowFreezeEngine);
  const r3 = feeSection(
    r3Rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || String(a.requestNo).localeCompare(String(b.requestNo))),
    r3Engine,
    { allWithdrawals: r3Rows.every((r) => r.requestType === 'WITHDRAWAL') },
  );

  // ---- fees the hand-made layouts have no sheet for -----------------------
  for (const hl of handlingOutLines) {
    otherRows.push({
      date: toDateOnly(hl.dispatchDate), documentNo: hl.withdrawalNo ?? '', label: serviceLabel(hl.rate),
      detail: [hl.productCode, hl.lotNo].filter(Boolean).join(' / '),
      quantity: toNumber(hl.weight), unit: 'กก.', rate: toNumber(hl.rate?.rate), amount: toNumber(hl.amount),
    });
  }
  for (const ol of overtimeLines) {
    otherRows.push({
      date: toDateOnly(ol.date), documentNo: ol.requestNo ?? '', label: serviceLabel(ol.rate),
      detail: 'เฉลี่ยจากยอด OT รายวัน — ดูไฟล์รายงานค่าล่วงเวลา',
      quantity: toNumber(ol.weight), unit: 'กก.', rate: null, amount: toNumber(ol.amount), literal: true,
    });
  }
  otherRows.sort((a, b) => String(a.label).localeCompare(String(b.label), 'th')
    || ((a.date ?? '') < (b.date ?? '') ? -1 : (a.date ?? '') > (b.date ?? '') ? 1 : 0)
    || String(a.documentNo).localeCompare(String(b.documentNo)));
  const other = otherRows.length ? {
    rows: otherRows,
    sheetTotal: round2(sumBy(otherRows, (r) => r.amount)),
    engineTotal: round2(sumBy(otherRows, (r) => r.amount)),
  } : null;

  // ---- reconciliation ------------------------------------------------------
  const sections = [
    ...storageSheets.map((s) => ({ label: s.summaryLabel, section: s })),
    { label: 'ค่าบริการจัดการแรกเข้า', section: handlingIn },
    { label: 'ค่าบริการแช่เยือกแข็ง (Blast Freeze)', section: freezing },
    { label: 'ค่าบริการ Slow Freeze', section: slowFreeze },
    { label: 'ค่าบริการใบอนุญาต ร.3', section: r3 },
    { label: 'ค่าบริการอื่น ๆ', section: other },
  ].filter((s) => s.section);
  const reconciliation = sections.map(({ label, section }) => ({
    label,
    sheetTotal: section.sheetTotal,
    engineTotal: section.engineTotal,
    diff: round2(section.sheetTotal - section.engineTotal),
  }));
  const engineGrandTotal = round2(sumBy(
    [...storageLines, ...auxLines, ...handlingLines, ...handlingOutLines, ...overtimeLines],
    (l) => l.amount,
  ));

  return {
    customerName: customer.customer_name ?? customer.customer_code ?? '',
    customerCode: customer.customer_code ?? '',
    periodStart,
    periodEnd,
    prevCutoff,
    period,
    productCategory,
    temperatureType,
    category,
    storageSheets,
    handlingIn,
    freezing,
    slowFreeze,
    r3,
    other,
    reconciliation,
    // A customer with no handling-in rate has no handling-in sheet at all;
    // one with a rate but no receipts this period gets an explicit empty one.
    hasHandlingInRate: rates.some((r) => r.service_type === 'HANDLING_IN'),
    sheetGrandTotal: round2(sumBy(reconciliation, (r) => r.sheetTotal)),
    engineGrandTotal,
    isEmpty: sections.length === 0,
  };
}

// ---- overtime ---------------------------------------------------------------
// One file per customer per period, every product group side by side: the OT
// minimum is charged once per work day across all of them
// (computeOvertimePoolLines), so a per-group file could not show why a group
// was charged what it was.
export function buildOvertimeStatementModel({ overtimePoolLines = [], customer = {}, periodStart, periodEnd }) {
  const lines = overtimePoolLines.filter((l) => l.pool);
  const categoryKeyOf = (l) => String(l.productCategory ?? '').trim() || UNCATEGORIZED;
  const categoryKeys = [...new Set(lines.map(categoryKeyOf))].sort((a, b) => {
    const order = (k) => (k.toLowerCase() === 'raw material' ? 0 : k.toLowerCase() === 'finished goods' ? 1 : k === UNCATEGORIZED ? 3 : 2);
    return order(a) - order(b) || a.localeCompare(b);
  });
  const categories = categoryKeys.map((key) => ({ key, ...describeCategory(key) }));

  const poolsByKey = new Map();
  for (const l of lines) {
    if (!poolsByKey.has(l.pool.key)) poolsByKey.set(l.pool.key, { pool: l.pool, lines: [] });
    poolsByKey.get(l.pool.key).lines.push(l);
  }
  const pools = [...poolsByKey.values()].sort((a, b) =>
    ((a.pool.workDate ?? '') < (b.pool.workDate ?? '') ? -1 : (a.pool.workDate ?? '') > (b.pool.workDate ?? '') ? 1 : 0)
    || String(a.pool.overtimeType).localeCompare(String(b.pool.overtimeType)));

  const days = pools.map(({ pool, lines: poolLines }) => {
    const rateValues = [...new Set(poolLines.map((l) => toNumber(l.rate?.rate)))];
    const weightByCategory = {};
    const amountByCategory = {};
    for (const key of categoryKeys) {
      const own = poolLines.filter((l) => categoryKeyOf(l) === key);
      weightByCategory[key] = round2(sumBy(own, (l) => l.weight));
      amountByCategory[key] = round2(sumBy(own, (l) => l.amount));
    }
    return {
      date: pool.workDate,
      overtimeType: pool.overtimeType,
      weightByCategory,
      amountByCategory,
      totalWeight: round2(pool.totalWeight),
      // One rate for the whole day -> the sheet can show weight x rate as a
      // live formula; mixed per-product rates print the engine's own figure.
      rate: rateValues.length === 1 ? rateValues[0] : null,
      rawAmount: round2(pool.rawAmount),
      minCharge: pool.minCharge != null ? toNumber(pool.minCharge) : null,
      minApplied: pool.minApplied === true,
      amount: round2(pool.poolAmount),
    };
  });

  const details = categories.map((category) => {
    const byDoc = new Map();
    for (const { pool, lines: poolLines } of pools) {
      for (const l of poolLines) {
        if (categoryKeyOf(l) !== category.key) continue;
        const key = `${pool.key}|${l.requestType}:${l.sourceRequestId}`;
        if (!byDoc.has(key)) {
          byDoc.set(key, {
            date: pool.workDate, requestNo: l.requestNo ?? '',
            workType: l.requestType === 'DEPOSIT' ? 'รับเข้า (แจ้งฝาก)' : 'จ่ายออก (แจ้งเบิก)',
            lineCount: 0, weight: 0, dayTotalWeight: round2(pool.totalWeight), amount: 0,
          });
        }
        const doc = byDoc.get(key);
        doc.lineCount += 1;
        doc.weight = round2(doc.weight + toNumber(l.weight));
        doc.amount = round2(doc.amount + toNumber(l.amount));
      }
    }
    const rows = [...byDoc.values()];
    return { category, rows, totalWeight: round2(sumBy(rows, (r) => r.weight)), totalAmount: round2(sumBy(rows, (r) => r.amount)) };
  });

  const rateOf = (type) => {
    const line = lines.find((l) => l.pool.overtimeType === type);
    return line ? { rate: toNumber(line.rate?.rate), minCharge: line.pool.minCharge != null ? toNumber(line.pool.minCharge) : null } : null;
  };

  return {
    customerName: customer.customer_name ?? customer.customer_code ?? '',
    customerCode: customer.customer_code ?? '',
    periodStart,
    periodEnd,
    period: describePeriod(periodStart, periodEnd),
    categories,
    days,
    details,
    workday: rateOf('WORKDAY'),
    holiday: rateOf('HOLIDAY'),
    hasHoliday: days.some((d) => d.overtimeType === 'HOLIDAY'),
    totalAmount: round2(sumBy(days, (d) => d.amount)),
    isEmpty: days.length === 0,
  };
}
