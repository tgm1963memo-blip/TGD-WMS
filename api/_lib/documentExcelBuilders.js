// Self-contained Excel builders for the deposit/withdrawal report attached
// to customer confirmation emails (api/process-email-queue.js). Deliberately
// NOT importing the frontend src/utils/customer*ExcelUtils.js versions:
// those pull in a chain of UI-focused modules (product/lot matching
// helpers, etc.) never written with "must also run correctly under a bare
// Node serverless function" in mind, and a future edit to any of them could
// silently break this function's import at deploy time and stop every
// customer notification email from sending. A little duplication here is
// the deliberate, safer tradeoff for this critical path. Prefix this
// directory with "_" so Vercel doesn't deploy it as its own API route.

import * as XLSX from 'xlsx';

function fmtExcelDate(v) {
  if (!v) return '-';
  const s = String(v).split('T')[0];
  const parts = s.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s;
}

function buildRows(kind, header, lines) {
  const customerName = header.customer_name ?? header.customer?.customer_name ?? header.customer?.name ?? '-';
  const customerAddress = header.customer_address ?? header.customer?.address ?? '-';
  const contactPhone = header.contact_phone ?? header.customer?.phone ?? '-';
  const contactFax = header.contact_fax ?? header.customer?.fax ?? '-';

  const isWithdrawal = kind === 'CUSTOMER_WITHDRAWAL_REQUEST';
  const docNo = isWithdrawal ? (header.withdrawal_no ?? '-') : (header.request_no ?? '-');
  const docDate = isWithdrawal
    ? (header.requested_dispatch_date ?? header.created_at?.split('T')[0] ?? '-')
    : (header.expected_arrival_date ?? header.created_at?.split('T')[0] ?? '-');

  const rows = [
    ['เลขที่เอกสาร', docNo],
    ['ลูกค้า', customerName],
    ['ที่อยู่', customerAddress],
    ['โทร', contactPhone],
    ['แฟกซ์', contactFax],
    ['วันที่', fmtExcelDate(docDate)],
  ];

  if (isWithdrawal) {
    rows.push(
      ['ปลายทาง', header.destination ?? '-'],
      ['ทะเบียนรถ', header.vehicle_registration ?? '-'],
      ['ผู้ติดต่อรับสินค้า', header.pickup_contact ?? '-'],
    );
  } else {
    rows.push(
      ['ทะเบียนรถ', header.vehicle_registration ?? '-'],
      ['ผู้ติดต่อ', header.contact_name ?? '-'],
    );
  }
  rows.push(['หมายเหตุ', header.note ?? '-'], []);

  rows.push(['#', 'TRACKING NO', 'LOT NO', 'ITEM CODE', 'CUSTOMER PRODUCT', 'MFG DATE', 'EXP DATE', 'T.WEIGHT KG', 'BOX', 'REMARK']);

  let totalBoxes = 0;
  let totalWeight = 0;

  lines.forEach((line, idx) => {
    const boxes = isWithdrawal
      ? (line.picked_boxes ?? line.requested_boxes ?? null)
      : (line.actual_boxes ?? line.expected_boxes ?? null);
    const weight = isWithdrawal
      ? (line.picked_weight ?? line.requested_weight ?? null)
      : (line.actual_weight ?? line.expected_weight ?? null);
    if (boxes != null) totalBoxes += Number(boxes) || 0;
    if (weight != null) totalWeight += Number(weight) || 0;

    rows.push([
      idx + 1,
      line.tracking_code ?? '-',
      (isWithdrawal ? (line.lot_no ?? line.source_lot_no) : line.lot_no) ?? '-',
      line.customer_product_code ?? line.internal_product_code ?? '-',
      line.product_name ?? '-',
      fmtExcelDate(line.mfg_date),
      fmtExcelDate(line.exp_date),
      weight ?? '-',
      boxes ?? '-',
      [line.note, line.admin_note ?? line.actual_note].filter(Boolean).join(' / ') || '-',
    ]);
  });

  rows.push(['', '', '', '', '', '', 'TOTAL', totalWeight || '-', totalBoxes || '-', '']);

  return { rows, docNo };
}

// Returns a Buffer (xlsx), or null if the workbook can't be built —
// callers must treat a null return as "send without an attachment", never
// as a reason to fail the whole email.
export function buildDocumentExcelBuffer(documentType, header, lines) {
  if (!header) return null;
  const { rows } = buildRows(documentType, header, lines ?? []);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, documentType === 'CUSTOMER_WITHDRAWAL_REQUEST' ? 'Withdrawal' : 'Deposit');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
