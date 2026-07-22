import { downloadExcelRows, readExcelFile } from './excelFileUtils.js';
import { normalizeCatalogBarcode } from './customerProductExcelUtils.js';
import {
  getMatchedDepositLine,
  WITHDRAWAL_IDENTIFIER_TYPES,
} from './customerWithdrawalLineDefaults.js';

export const CUSTOMER_WITHDRAWAL_LINE_EXCEL_HEADERS = [
  'customer_product_code',
  'identifier_type',
  'identifier_value',
  'requested_boxes',
  'requested_weight',
  'picking_rule',
  'note',
  'available_boxes',
  'available_weight',
];

// Remaining balance for a deposit line, same fallback rule
// getWithdrawalBalanceInfo/getMatchedDepositLine use: actual_* is the netted
// remaining balance and 0 is meaningful there, so only fall back to
// expected_* when actual_* itself is missing.
function depositLineBalance(dl, field) {
  const actual = field === 'boxes' ? dl.actual_boxes : dl.actual_weight;
  const expected = field === 'boxes' ? dl.expected_boxes : dl.expected_weight;
  const a = actual != null ? Number(actual) : null;
  if (a != null && Number.isFinite(a)) return a;
  const e = expected != null ? Number(expected) : null;
  return e != null && Number.isFinite(e) ? e : 0;
}

function mapWithdrawalLineToExcelRow(line = {}) {
  return {
    customer_product_code: line.customer_product_code ?? '',
    identifier_type: line.identifier_type ?? '',
    identifier_value: line.identifier_value ?? '',
    requested_boxes: line.requested_boxes ?? '',
    requested_weight: line.requested_weight ?? '',
    picking_rule: line.picking_rule ?? '',
    note: line.note ?? '',
    available_boxes: '',
    available_weight: '',
  };
}

export function downloadCustomerWithdrawalLineTemplate(allDepositLines = [], filename = 'customer-withdrawal-lines-template.xlsx') {
  const withBalance = (allDepositLines ?? []).filter((dl) =>
    depositLineBalance(dl, 'boxes') > 0 || depositLineBalance(dl, 'weight') > 0,
  );

  const rows = withBalance.length > 0
    ? withBalance.map((dl) => {
        let identifierType = WITHDRAWAL_IDENTIFIER_TYPES.TRACKING_CODE;
        let identifierValue = dl.tracking_code ?? '';
        if (dl.lot_no) {
          identifierType = WITHDRAWAL_IDENTIFIER_TYPES.LOT;
          identifierValue = dl.lot_no;
        } else if (dl.actual_note) {
          identifierType = WITHDRAWAL_IDENTIFIER_TYPES.NOTE;
          identifierValue = dl.actual_note;
        }
        return {
          customer_product_code: dl.customer_product_code ?? '',
          identifier_type: identifierType,
          identifier_value: identifierValue,
          requested_boxes: '',
          requested_weight: '',
          picking_rule: 'FEFO',
          note: '',
          available_boxes: depositLineBalance(dl, 'boxes') || '',
          available_weight: depositLineBalance(dl, 'weight') || '',
        };
      })
    : [{
        customer_product_code: 'SAMPLE-001',
        identifier_type: 'LOT',
        identifier_value: 'LOT-SAMPLE',
        requested_boxes: '10',
        requested_weight: '100',
        picking_rule: 'FEFO',
        note: 'ตัวอย่างหมายเหตุ',
        available_boxes: '',
        available_weight: '',
      }];

  downloadExcelRows(rows, CUSTOMER_WITHDRAWAL_LINE_EXCEL_HEADERS, filename, 'WithdrawalLines');
}

export function exportCustomerWithdrawalLinesExcel(lines = [], filename = 'customer-withdrawal-lines.xlsx') {
  downloadExcelRows(
    lines.map(mapWithdrawalLineToExcelRow),
    CUSTOMER_WITHDRAWAL_LINE_EXCEL_HEADERS,
    filename,
    'WithdrawalLines',
  );
}

const VALID_IDENTIFIER_TYPES = new Set(Object.values(WITHDRAWAL_IDENTIFIER_TYPES));

export function mapImportedRowsToWithdrawalLines(rows, catalogProducts = [], allDepositLines = [], startKey = 1) {
  const catalogByCode = new Map(
    catalogProducts.map((product) => [String(product.customer_product_code ?? '').trim().toUpperCase(), product]),
  );

  const lines = [];
  const errors = [];

  rows.forEach((row) => {
    const customerProductCode = String(row.customer_product_code ?? '').trim();
    const catalog = catalogByCode.get(customerProductCode.toUpperCase());

    if (!customerProductCode) {
      errors.push(`Row ${row.__row}: customer_product_code is required.`);
      return;
    }
    if (!catalog) {
      errors.push(`Row ${row.__row}: product code "${customerProductCode}" is not in catalog.`);
      return;
    }

    const identifierType = String(row.identifier_type ?? '').trim().toUpperCase();
    if (!VALID_IDENTIFIER_TYPES.has(identifierType)) {
      errors.push(`Row ${row.__row}: identifier_type must be one of ${[...VALID_IDENTIFIER_TYPES].join(', ')}.`);
      return;
    }

    const identifierValue = String(row.identifier_value ?? '').trim();
    if (!identifierValue) {
      errors.push(`Row ${row.__row}: identifier_value is required.`);
      return;
    }

    const requestedBoxes = String(row.requested_boxes ?? '').trim();
    const requestedWeight = String(row.requested_weight ?? '').trim();
    if ((!requestedBoxes || Number(requestedBoxes) <= 0) && (!requestedWeight || Number(requestedWeight) <= 0)) {
      errors.push(`Row ${row.__row}: requested_boxes or requested_weight is required.`);
      return;
    }

    const draftLine = {
      key: startKey + lines.length,
      catalog_product_id: catalog.id,
      customer_product_code: catalog.customer_product_code ?? customerProductCode,
      product_code: normalizeCatalogBarcode(catalog),
      product_name: catalog.product_name ?? '',
      temperature_type: catalog.temperature_type ?? 'FROZEN',
      argent_type: catalog.argent_type ?? 'NON_ARGENT',
      identifier_type: identifierType,
      identifier_value: identifierValue,
      lot_no: identifierType === WITHDRAWAL_IDENTIFIER_TYPES.LOT ? identifierValue : '',
      mfg_date: identifierType === WITHDRAWAL_IDENTIFIER_TYPES.MFG_DATE ? identifierValue : '',
      exp_date: identifierType === WITHDRAWAL_IDENTIFIER_TYPES.EXP_DATE ? identifierValue : '',
      source_deposit_request_id: '',
      source_deposit_request_line_id: '',
      withdrawal_qty_mode: requestedWeight && !requestedBoxes ? 'WEIGHT' : 'BOXES',
      requested_qty: '',
      requested_boxes: requestedBoxes,
      requested_weight: requestedWeight,
      picking_rule: String(row.picking_rule ?? '').trim() || 'FEFO',
      note: String(row.note ?? '').trim(),
    };

    const matched = getMatchedDepositLine(draftLine, allDepositLines);
    if (!matched) {
      errors.push(`Row ${row.__row}: ${identifierType} "${identifierValue}" not found or already fully withdrawn for ${draftLine.product_name || customerProductCode}.`);
      return;
    }

    lines.push({
      ...draftLine,
      lot_no: identifierType === WITHDRAWAL_IDENTIFIER_TYPES.LOT ? identifierValue : (matched.lot_no ?? ''),
      mfg_date: draftLine.mfg_date || matched.mfg_date || '',
      exp_date: draftLine.exp_date || matched.exp_date || '',
      source_deposit_request_id: matched.deposit_request_id ?? '',
      source_deposit_request_line_id: matched.id ?? '',
    });
  });

  return { lines, errors };
}

const REQUIRED_IMPORT_HEADERS = ['customer_product_code', 'identifier_type', 'identifier_value'];

export async function parseCustomerWithdrawalLineImportFile(file) {
  const { headers, rows } = await readExcelFile(file);
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const missingHeaders = REQUIRED_IMPORT_HEADERS.filter(
    (header) => !normalizedHeaders.includes(header.trim().toLowerCase()),
  );
  if (missingHeaders.length) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingHeaders.join(', ')}`],
    };
  }

  return {
    rows: rows.map((row, index) => ({ ...row, __row: index + 2 })),
    errors: [],
  };
}
