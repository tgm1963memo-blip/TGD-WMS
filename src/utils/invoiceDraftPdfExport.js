import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildInvoiceLotLedger } from './invoiceLotLedgerUtils.js';
import { formatFixed2 } from './numberFormat.js';
import { getDefaultDocumentBranding, normalizeDocumentBrandingConfig } from '../config/documentBrandingConfig.js';
import { APPROVED_OR_LATER_INVOICE_DRAFT_STATUSES } from './billingInvoiceDraftUtils.js';
import { SARABUN_REGULAR_BASE64, SARABUN_BOLD_BASE64 } from '../assets/fonts/SarabunBase64.js';
import { supabase } from '../services/supabaseClient.js';
import { listCustomerProducts } from '../services/customerProductCatalogService.js';

// jsPDF's built-in fonts (Helvetica etc.) have no Thai glyphs at all, so
// every Thai character would render as a blank box without embedding a real
// Thai-covering font file first. Sarabun (not Noto Sans Thai -- that family
// is a Thai-script-ONLY companion font with zero Latin/digit glyphs, which
// silently blanked every English/number cell) covers Thai + Latin + digits
// in one file and matches this app's own print CSS font stack. See
// src/assets/fonts/SarabunBase64.js.
const FONT_FILE_REGULAR = 'Sarabun-Regular.ttf';
const FONT_FILE_BOLD = 'Sarabun-Bold.ttf';
const FONT_NAME = 'Sarabun';

function registerThaiFont(doc) {
  doc.addFileToVFS(FONT_FILE_REGULAR, SARABUN_REGULAR_BASE64);
  doc.addFont(FONT_FILE_REGULAR, FONT_NAME, 'normal');
  doc.addFileToVFS(FONT_FILE_BOLD, SARABUN_BOLD_BASE64);
  doc.addFont(FONT_FILE_BOLD, FONT_NAME, 'bold');
  doc.setFont(FONT_NAME, 'normal');
}

function fmt(value) {
  if (value == null) return '-';
  return formatFixed2(value);
}

function fmtQty(value) {
  if (value == null || value === 0) return '-';
  return Number(value).toLocaleString('th-TH');
}

function fmtDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMonthYear(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

async function fetchCustomerContact(customerId) {
  if (!customerId || !supabase) return null;
  const { data } = await supabase
    .from('tgd_customers')
    .select('customer_name, address, phone, contact_name')
    .eq('id', customerId)
    .maybeSingle();
  return data ?? null;
}

// Some already-created invoice draft lines have product_name stuck
// duplicating product_code (a data snapshot bug fixed upstream for lines
// created after it, but not backfilled for older ones) -- so resolve the
// display name from the customer's current product catalog instead of
// trusting the stored field, same "master catalog wins" reasoning already
// used when building draft lines in the first place.
async function fetchProductNameByCode(customerId) {
  if (!customerId) return new Map();
  const { data } = await listCustomerProducts({ customerId });
  const map = new Map();
  for (const row of data ?? []) {
    if (row.customer_product_code && row.product_name) {
      map.set(row.customer_product_code, row.product_name);
    }
  }
  return map;
}

// Filenames can't carry path separators or other characters Windows/macOS
// reject — same sanitizing the printed document's Save-as-PDF flow already
// does via ReportPreviewModal's docNumberFromTitle.
function safeFilename(draftNo) {
  const base = String(draftNo ?? 'invoice-draft').trim() || 'invoice-draft';
  return `${base.replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
}

const HEADER_HEIGHT_MM = 40;
const PAGE_MARGIN_MM = 8;

function drawHeaderBlock(doc, { branding, draft, customerName, customer, isApprovedOrLater }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont(FONT_NAME, 'normal');

  let y = 11;
  doc.setFontSize(13);
  doc.setTextColor(45, 147, 72);
  doc.text(branding.company_name_en || 'TGD Cold Storage', PAGE_MARGIN_MM, y);
  y += 4.5;
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(branding.company_name_th || '', PAGE_MARGIN_MM, y);
  y += 3.8;
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(branding.company_address_th || '', PAGE_MARGIN_MM, y);
  y += 3.5;
  const contactLine = [
    branding.phone ? `โทร ${branding.phone}` : null,
    branding.tax_id ? `เลขประจำตัวผู้เสียภาษี ${branding.tax_id}` : null,
  ].filter(Boolean).join('   ');
  if (contactLine) doc.text(contactLine, PAGE_MARGIN_MM, y);

  const rightX = pageWidth - PAGE_MARGIN_MM;
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(isApprovedOrLater ? 'ใบแจ้งหนี้ / INVOICE' : 'ใบแจ้งหนี้ (ร่าง) / INVOICE (DRAFT)', rightX, 9, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(45, 147, 72);
  doc.text(draft.draft_no ?? '', rightX, 13.5, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`REF NO   ${draft.internal_reference || draft.draft_no || '-'}`, rightX, 17.5, { align: 'right' });
  doc.text(`FOR MONTH   ${fmtMonthYear(draft.billing_period_start)}`, rightX, 21, { align: 'right' });
  doc.text(`ISSUED DATE   ${fmtDate(draft.created_at)}`, rightX, 24.5, { align: 'right' });

  let cy = 24.5;
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`CUSTOMER   ${customerName}`, PAGE_MARGIN_MM, cy);
  cy += 3.8;
  doc.setTextColor(100, 116, 139);
  doc.text(`ADDRESS   ${customer?.address ?? '-'}`, PAGE_MARGIN_MM, cy);
  cy += 3.8;
  doc.text(`TEL   ${customer?.phone ?? '-'}      ATTN   ${customer?.contact_name ?? '-'}`, PAGE_MARGIN_MM, cy);

  doc.setDrawColor(45, 147, 72);
  doc.setLineWidth(0.4);
  doc.line(PAGE_MARGIN_MM, HEADER_HEIGHT_MM - 2, rightX, HEADER_HEIGHT_MM - 2);
}

function buildTableHead() {
  return [
    [
      { content: 'RECEIVED\nDATE', rowSpan: 2 },
      { content: 'DELIVERY\nDATE', rowSpan: 2 },
      { content: 'LOT NO', rowSpan: 2 },
      { content: 'CUSTOMER PRODUCT', rowSpan: 2 },
      { content: 'WT/UNIT\n(KG)', rowSpan: 2 },
      { content: 'BALANCE FORWARD', colSpan: 2, styles: { halign: 'center' } },
      { content: 'RECEIVED', colSpan: 2, styles: { halign: 'center' } },
      { content: 'DELIVERY', colSpan: 2, styles: { halign: 'center' } },
      { content: 'BALANCE', colSpan: 2, styles: { halign: 'center' } },
      { content: 'HANDLING\nFEE RATE', rowSpan: 2 },
      { content: 'HANDLING\nFEE', rowSpan: 2 },
      { content: 'CYCLES\n(งวด)', rowSpan: 2 },
      { content: 'COLD STORAGE\nRATE', rowSpan: 2 },
      { content: 'COLD STORAGE\nCHARGE', rowSpan: 2 },
      { content: 'TOTAL', rowSpan: 2 },
    ],
    ['VOL.', 'WT(KG)', 'VOL.', 'WT(KG)', 'VOL.', 'WT(KG)', 'VOL.', 'WT(KG)'],
  ];
}

function buildTableBody(lots, grandTotal) {
  const body = [];
  for (const lot of lots) {
    lot.rows.forEach((row, i) => {
      const codeAndName = row.productName && row.productName !== row.productCode
        ? `${row.productCode ?? '-'}  ${row.productName}`
        : (row.productCode ?? row.productName ?? '-');
      const productCell = i === 0
        ? [codeAndName, row.remark].filter(Boolean).join('\n')
        : '';
      body.push([
        i === 0 ? fmtDate(row.receivedDate) : '',
        fmtDate(row.deliveryDate),
        i === 0 ? row.lotNo ?? '-' : '',
        productCell,
        row.weightPerUnit != null ? fmt(row.weightPerUnit) : '-',
        fmtQty(row.balanceForwardVolume),
        fmt(row.balanceForwardWeight),
        fmtQty(row.receivedVolume),
        row.receivedWeight ? fmt(row.receivedWeight) : '-',
        fmtQty(row.deliveryVolume),
        row.deliveryWeight ? fmt(row.deliveryWeight) : '-',
        fmtQty(row.balanceVolume),
        fmt(row.balanceWeight),
        row.rate != null ? fmt(row.rate) : '-',
        row.handlingFee != null ? fmt(row.handlingFee) : '-',
        row.cycleCount ?? '-',
        row.chargeUnit != null ? fmt(row.chargeUnit) : '-',
        row.coldStorageCharge != null ? fmt(row.coldStorageCharge) : '-',
        row.total != null ? fmt(row.total) : '-',
      ]);
    });
    body.push([
      { content: `SUB TOTAL (${lot.lotNo ?? '-'})`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: fmtQty(lot.subtotal.balanceForwardVolume), styles: { fontStyle: 'bold' } },
      { content: fmt(lot.subtotal.balanceForwardWeight), styles: { fontStyle: 'bold' } },
      { content: fmtQty(lot.subtotal.receivedVolume), styles: { fontStyle: 'bold' } },
      { content: fmt(lot.subtotal.receivedWeight), styles: { fontStyle: 'bold' } },
      { content: fmtQty(lot.subtotal.deliveryVolume), styles: { fontStyle: 'bold' } },
      { content: fmt(lot.subtotal.deliveryWeight), styles: { fontStyle: 'bold' } },
      { content: fmtQty(lot.subtotal.balanceVolume), styles: { fontStyle: 'bold' } },
      { content: fmt(lot.subtotal.balanceWeight), styles: { fontStyle: 'bold' } },
      '',
      { content: fmt(lot.subtotal.handlingFee), styles: { fontStyle: 'bold' } },
      '',
      '',
      { content: fmt(lot.subtotal.coldStorageCharge), styles: { fontStyle: 'bold' } },
      { content: fmt(lot.subtotal.total), styles: { fontStyle: 'bold' } },
    ]);
  }
  return body;
}

function buildTableFoot(grandTotal) {
  return [[
    { content: 'GRAND TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    fmtQty(grandTotal.balanceForwardVolume),
    fmt(grandTotal.balanceForwardWeight),
    fmtQty(grandTotal.receivedVolume),
    fmt(grandTotal.receivedWeight),
    fmtQty(grandTotal.deliveryVolume),
    fmt(grandTotal.deliveryWeight),
    fmtQty(grandTotal.balanceVolume),
    fmt(grandTotal.balanceWeight),
    '',
    fmt(grandTotal.handlingFee),
    '',
    '',
    fmt(grandTotal.coldStorageCharge),
    { content: fmt(grandTotal.total), styles: { textColor: [45, 147, 72] } },
  ]];
}

// Generates and downloads a real, vector-text PDF of an invoice draft --
// distinct from the browser's native print-to-PDF (already available via
// the "พิมพ์" button's Save-as-PDF destination): this is a direct one-click
// download that doesn't depend on the viewer picking the right print
// destination, with the company/customer header block repeating on every
// page (drawn per-page via autoTable's didDrawPage hook, mirroring the
// printed template's own repeating <thead> row) rather than only appearing
// once at the top like a naive full-page screenshot would.
export async function exportInvoiceDraftPdf({ draft, lines = [] }) {
  if (!draft) return;

  const [customer, productNameByCode] = await Promise.all([
    fetchCustomerContact(draft.customer_id),
    fetchProductNameByCode(draft.customer_id),
  ]);
  const branding = normalizeDocumentBrandingConfig(getDefaultDocumentBranding());
  const resolvedLines = lines.map((line) => ({
    ...line,
    product_name: productNameByCode.get(line.product_code) ?? line.product_name ?? null,
  }));
  const { lots, grandTotal } = buildInvoiceLotLedger(resolvedLines);
  const isApprovedOrLater = APPROVED_OR_LATER_INVOICE_DRAFT_STATUSES.includes(draft.status);
  const customerName = draft.customer_name ?? customer?.customer_name ?? '-';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerThaiFont(doc);

  const headerArgs = { branding, draft, customerName, customer, isApprovedOrLater };

  autoTable(doc, {
    head: buildTableHead(),
    body: buildTableBody(lots, grandTotal),
    foot: lots.length ? buildTableFoot(grandTotal) : undefined,
    showFoot: 'lastPage',
    startY: HEADER_HEIGHT_MM,
    margin: { top: HEADER_HEIGHT_MM, left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM, bottom: 10 },
    styles: { font: FONT_NAME, fontSize: 6, cellPadding: 1, overflow: 'linebreak', valign: 'middle' },
    headStyles: { font: FONT_NAME, fontSize: 6, fillColor: [241, 253, 244], textColor: [30, 41, 59], fontStyle: 'normal', lineColor: [203, 213, 225], lineWidth: 0.1 },
    footStyles: { font: FONT_NAME, fontSize: 6.5, fillColor: [241, 253, 244], textColor: [30, 41, 59], fontStyle: 'bold' },
    bodyStyles: { lineColor: [229, 231, 235], lineWidth: 0.1 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'left', cellWidth: 18 },
      3: { halign: 'left', cellWidth: 55 },
      4: { halign: 'right', cellWidth: 12 },
    },
    didDrawPage: () => drawHeaderBlock(doc, headerArgs),
    didParseCell: (data) => {
      // Right-align every numeric column (everything from BALANCE FORWARD
      // VOL. onward) except the ones already given an explicit alignment
      // above.
      if (data.section !== 'head' && data.column.index >= 5) {
        data.cell.styles.halign = 'right';
      }
    },
  });

  let finalY = (doc.lastAutoTable?.finalY ?? HEADER_HEIGHT_MM) + 8;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  if (finalY > pageHeight - 35) {
    doc.addPage();
    drawHeaderBlock(doc, headerArgs);
    finalY = HEADER_HEIGHT_MM + 8;
  }

  doc.setFont(FONT_NAME, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('ยอดรวมทั้งสิ้น / NET TOTAL', pageWidth - 80, finalY);
  doc.setTextColor(45, 147, 72);
  doc.text(`${fmt(draft.total_amount)} ${draft.currency ?? 'THB'}`, pageWidth - PAGE_MARGIN_MM, finalY, { align: 'right' });

  finalY += 14;
  const sigLabels = [
    ['ผู้รับบริการ / Receiver'],
    ['ผู้ส่งของ / Delivered By'],
    ['ผู้ตรวจสอบ / Approved By'],
    ['ผู้มีอำนาจกระทำการแทนบริษัท / Authorized Signatory'],
  ];
  const sigWidth = (pageWidth - PAGE_MARGIN_MM * 2) / sigLabels.length;
  doc.setFontSize(7.5);
  sigLabels.forEach(([label], i) => {
    const x = PAGE_MARGIN_MM + i * sigWidth;
    doc.setDrawColor(203, 213, 225);
    doc.line(x, finalY, x + sigWidth - 10, finalY);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x, finalY + 4);
    doc.setTextColor(148, 163, 184);
    doc.text('วันที่ / Date ____________', x, finalY + 8);
  });

  if (!isApprovedOrLater) {
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('เอกสารนี้เป็นร่างเท่านั้น — This is a draft document only', pageWidth / 2, finalY + 16, { align: 'center' });
  }

  doc.save(safeFilename(draft.draft_no));
}

// Exports the simpler "เอกสาร {draft_no}" summary modal (header key/value
// block + the flat "รายละเอียด" details table -- ลำดับ/รหัสสินค้า/ชื่อสินค้า/
// ประเภท/จำนวน/น้ำหนัก/งวด/อัตรา/จำนวนเงิน, one row per invoice draft line)
// as its own one-page-ish PDF. Deliberately NOT the same document as
// exportInvoiceDraftPdf above (that one is the full per-lot balance-ledger
// print layout) -- this mirrors exactly what the view modal itself shows,
// for a quick take-away copy of that same summary.
export async function exportInvoiceDraftDetailPdf({ draft, lines = [] }) {
  if (!draft) return;

  const productNameByCode = await fetchProductNameByCode(draft.customer_id);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(`เอกสาร ${draft.draft_no ?? ''}`, PAGE_MARGIN_MM, y);
  y += 8;

  doc.setFontSize(9);
  const leftX = PAGE_MARGIN_MM;
  const rightX = pageWidth / 2 + 4;
  const fields = [
    ['Draft No', draft.draft_no ?? '-'],
    ['ลูกค้า', draft.customer_name ?? '-'],
    ['สถานะ', draft.status ?? '-'],
    ['วันที่สร้าง', fmtDate(draft.created_at)],
    ['ช่วงเวลา (เริ่ม)', draft.billing_period_start ?? '-'],
    ['ช่วงเวลา (สิ้นสุด)', draft.billing_period_end ?? '-'],
    ['จำนวนรวม', fmt(draft.total_qty)],
    ['น้ำหนักรวม', fmt(draft.total_chargeable_weight)],
    ['มูลค่ารวม', fmt(draft.total_amount)],
  ];
  fields.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? leftX : rightX;
    const row = Math.floor(i / 2);
    doc.setTextColor(100, 116, 139);
    doc.text(`${label}:`, col, y + row * 5.5);
    doc.setTextColor(30, 41, 59);
    doc.text(String(value), col + 32, y + row * 5.5);
  });
  y += Math.ceil(fields.length / 2) * 5.5 + 6;

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('รายละเอียด', PAGE_MARGIN_MM, y);
  y += 3;

  const head = [['ลำดับ', 'รหัสสินค้า', 'ชื่อสินค้า', 'ประเภท', 'จำนวน', 'น้ำหนัก', 'งวด/วัน', 'อัตรา', 'จำนวนเงิน']];
  const body = lines.map((line, idx) => [
    idx + 1,
    line.product_code ?? '-',
    [productNameByCode.get(line.product_code) ?? line.product_name ?? '-', line.line_note].filter(Boolean).join('\n'),
    line.movement_type ?? '-',
    fmt(line.qty),
    fmt(line.chargeable_weight),
    line.storage_days != null ? `${line.storage_days} วัน` : '-',
    line.rate ?? '-',
    fmt(line.amount),
  ]);

  const totalQty = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
  const totalWeight = lines.reduce((sum, line) => sum + (Number(line.chargeable_weight) || 0), 0);
  const totalAmount = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const foot = lines.length ? [[
    { content: 'ยอดรวม', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: fmt(totalQty), styles: { fontStyle: 'bold' } },
    { content: fmt(totalWeight), styles: { fontStyle: 'bold' } },
    '',
    '',
    { content: fmt(totalAmount), styles: { fontStyle: 'bold', textColor: [45, 147, 72] } },
  ]] : undefined;

  autoTable(doc, {
    head,
    body,
    foot,
    showFoot: 'lastPage',
    startY: y,
    margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM, bottom: 10 },
    styles: { font: FONT_NAME, fontSize: 7.5, cellPadding: 1.5, overflow: 'linebreak', valign: 'middle' },
    headStyles: { font: FONT_NAME, fontSize: 7.5, fillColor: [241, 253, 244], textColor: [30, 41, 59], fontStyle: 'bold' },
    footStyles: { font: FONT_NAME, fontSize: 7.5, fillColor: [241, 253, 244], textColor: [30, 41, 59], fontStyle: 'bold' },
    bodyStyles: { lineColor: [229, 231, 235], lineWidth: 0.1 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'left', cellWidth: 30 },
      2: { halign: 'left', cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'right', cellWidth: 18 },
      8: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
    },
  });

  doc.save(safeFilename(`${draft.draft_no ?? 'invoice-draft'}-summary`));
}
