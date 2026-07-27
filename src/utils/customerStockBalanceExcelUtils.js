import { downloadExcelRows } from './excelFileUtils.js';

export const CUSTOMER_STOCK_BALANCE_EXCEL_HEADERS = [
  'request_no',
  'received_date',
  'customer_product_code',
  'product_name',
  'temperature_type',
  'lot_no',
  'tracking_code',
  'mfg_date',
  'exp_date',
  'remaining_boxes',
  'remaining_weight',
  'customer_note',
  'admin_note',
];

function toDateOnly(iso) {
  if (!iso) return '';
  return String(iso).split('T')[0];
}

export function mapStockBalanceLineToExcelRow(line = {}) {
  return {
    request_no: line.request?.request_no ?? '',
    received_date: toDateOnly(line.request?.last_action_at ?? line.request?.expected_arrival_date),
    customer_product_code: line.customer_product_code ?? '',
    product_name: line.product_name ?? '',
    temperature_type: line.temperature_type ?? '',
    lot_no: line.lot_no ?? '',
    tracking_code: line.tracking_code ?? '',
    mfg_date: toDateOnly(line.mfg_date),
    exp_date: toDateOnly(line.exp_date),
    remaining_boxes: line.actual_boxes ?? line.expected_boxes ?? '',
    remaining_weight: line.actual_weight ?? line.expected_weight ?? '',
    customer_note: line.note ?? '',
    admin_note: line.actual_note ?? '',
  };
}

export function exportCustomerStockBalanceExcel(lines = [], filename = 'customer-stock-balance.xlsx') {
  downloadExcelRows(
    lines.map(mapStockBalanceLineToExcelRow),
    CUSTOMER_STOCK_BALANCE_EXCEL_HEADERS,
    filename,
    'StockBalance',
  );
}
