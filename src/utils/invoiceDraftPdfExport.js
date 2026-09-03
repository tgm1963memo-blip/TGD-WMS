import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildInvoiceLotLedger } from './invoiceLotLedgerUtils.js';
import { formatFixed2 } from './numberFormat.js';
import { getDefaultDocumentBranding, normalizeDocumentBrandingConfig } from '../config/documentBrandingConfig.js';
import { APPROVED_OR_LATER_INVOICE_DRAFT_STATUSES } from './billingInvoiceDraftUtils.js';
import { NOTO_SANS_THAI_REGULAR_BASE64 } from '../assets/fonts/NotoSansThaiRegularBase64.js';
import { supabase } from '../services/supabaseClient.js';

// jsPDF's built-in fonts (Helvetica etc.) have no Thai glyphs at all, so
// every Thai character would render as a blank box without embedding a real
// Thai-covering font file first. See src/assets/fonts/NotoSansThaiRegularBase64.js
// for where this comes from.
const FONT_FILE = 'NotoSansThai-Regular.ttf';
const FONT_NAME = 'NotoSansThai';

function registerThaiFont(doc) {
  doc.addFileToVFS(FONT_FILE, NOTO_SANS_THAI_REGULAR_BASE64);
  doc.addFont(FONT_FILE, FONT_NAME, 'normal');
  // Only the regular weight is embedded (see NotoSansThaiRegularBase64.js) --
  // autoTable's SUB TOTAL/GRAND TOTAL rows and a few emphasized cells below
  // request fontStyle 'bold'. Without a 'bold' variant registered too, jsPDF
  // can't find one for this font and silently falls back to a font with no
  // Thai glyphs at all, rendering blank boxes instead of a warning -- so
  // register the same regular file under the 'bold' slot too. Visually it's
  // not genuinely heavier, but it keeps every Thai character rendering
  // correctly, which matters far more than true bold weight here.
  doc.addFont(FONT_FILE, FONT_NAME, 'bold');
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
      { content: 'DESC', rowSpan: 2 },
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
      const productCell = i === 0
        ? [row.productName ?? row.productCode ?? '-', row.remark].filter(Boolean).join('\n')
        : '';
      body.push([
        i === 0 ? fmtDate(row.receivedDate) : '',
        fmtDate(row.deliveryDate),
        i === 0 ? row.lotNo ?? '-' : '',
        productCell,
        i === 0 ? row.productCode ?? '-' : '',
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
      { content: `SUB TOTAL (${lot.lotNo ?? '-'})`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
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
    { content: 'GRAND TOTAL', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
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

  const customer = await fetchCustomerContact(draft.customer_id);
  const branding = normalizeDocumentBrandingConfig(getDefaultDocumentBranding());
  const { lots, grandTotal } = buildInvoiceLotLedger(lines);
  const isApprovedOrLater = APPROVED_OR_LATER_INVOICE_DRAFT_STATUSES.includes(draft.status);
  const customerName = draft.customer_name ?? customer?.customer_name ?? '-';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerThaiFont(doc);

  const headerArgs = { branding, draft, customerName, customer, isApprovedOrLater };

  autoTable(doc, {
    head: buildTableHead(),
    body: buildTableBody(lots, grandTotal),
    foot: lots.length ? buildTableFoot(grandTotal) : undefined,
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
      3: { halign: 'left', cellWidth: 42 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 12 },
    },
    didDrawPage: () => drawHeaderBlock(doc, headerArgs),
    didParseCell: (data) => {
      // Right-align every numeric column (everything from WT/UNIT onward)
      // except the ones already given an explicit alignment above.
      if (data.section !== 'head' && data.column.index >= 6) {
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
