import {
  createEmptyDepositLine,
  DEPOSIT_LINE_DEFAULT_COUNT,
} from './customerDepositLineDefaults.js';

function toFormValue(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value);
}

export function resolveCatalogProductId(line, catalogProducts = []) {
  if (line?.product_id) return line.product_id;

  const customerCode = String(line?.customer_product_code ?? '').trim().toLowerCase();
  const internalCode = String(line?.internal_product_code ?? '').trim().toLowerCase();

  const matched = catalogProducts.find((product) => {
    const productCustomerCode = String(product.customer_product_code ?? '').trim().toLowerCase();
    const productInternalCode = String(product.internal_product_code ?? '').trim().toLowerCase();
    return (
      (customerCode && productCustomerCode === customerCode)
      || (internalCode && productInternalCode === internalCode)
    );
  });

  return matched?.id ?? (customerCode || internalCode ? '__manual__' : '');
}

export function mapDepositHeaderForCopy(source) {
  return {
    expected_arrival_date: source?.expected_arrival_date ?? '',
    note: source?.note ?? '',
    contact_name: source?.contact_name ?? '',
    contact_phone: source?.contact_phone ?? '',
  };
}

export function mapDepositLinesForCopy(sourceLines = [], catalogProducts = []) {
  const copied = sourceLines.map((line, index) => ({
    key: index + 1,
    catalog_product_id: resolveCatalogProductId(line, catalogProducts),
    customer_product_code: line.customer_product_code ?? '',
    product_code: line.internal_product_code ?? '',
    product_name: line.product_name ?? '',
    lot_no: line.lot_no ?? '',
    expected_qty: toFormValue(line.expected_qty),
    expected_boxes: toFormValue(line.expected_boxes),
    expected_weight: toFormValue(line.expected_weight),
    temperature_type: line.temperature_type ?? 'FROZEN',
  }));

  if (!copied.length) {
    return Array.from({ length: DEPOSIT_LINE_DEFAULT_COUNT }, (_, index) => createEmptyDepositLine(index + 1));
  }

  const targetCount = Math.max(DEPOSIT_LINE_DEFAULT_COUNT, copied.length);
  const padded = [...copied];

  for (let index = copied.length; index < targetCount; index += 1) {
    padded.push(createEmptyDepositLine(index + 1));
  }

  return padded;
}

export function mapWithdrawalFormForCopy(source, sourceLines = [], catalogProducts = []) {
  const firstLine = sourceLines[0] ?? {};

  return {
    catalog_product_id: resolveCatalogProductId(firstLine, catalogProducts),
    requested_dispatch_date: source?.requested_dispatch_date ?? '',
    source_deposit_request_id: firstLine.source_customer_deposit_request_id ?? '',
    lot_no: firstLine.source_lot_no ?? '',
    customer_product_code: firstLine.customer_product_code ?? '',
    internal_product_code: firstLine.internal_product_code ?? '',
    product_name: firstLine.product_name ?? '',
    requested_qty: toFormValue(firstLine.requested_qty),
    requested_boxes: toFormValue(firstLine.requested_boxes),
    requested_weight: toFormValue(firstLine.requested_weight),
    picking_rule: firstLine.picking_rule ?? 'FEFO',
    delivery_type: source?.delivery_type ?? 'PICKUP',
    pickup_contact: source?.pickup_contact ?? '',
    destination: source?.destination ?? '',
    note: source?.note ?? '',
  };
}

export function mapWithdrawalLinesForCopy(sourceLines = []) {
  return sourceLines.map((line) => ({
    sourceDepositRequestId: line.source_customer_deposit_request_id ?? null,
    sourceLotNo: line.source_lot_no ?? '',
    customerProductCode: line.customer_product_code ?? '',
    internalProductCode: line.internal_product_code ?? '',
    productName: line.product_name ?? '',
    requestedQty: line.requested_qty ?? '',
    requestedBoxes: line.requested_boxes ?? '',
    requestedWeight: line.requested_weight ?? '',
    pickingRule: line.picking_rule ?? 'FEFO',
    note: line.note ?? '',
  }));
}

export function buildCustomerRequestCopyPath(basePath, sourceId) {
  return `${basePath}?copyFrom=${encodeURIComponent(sourceId)}`;
}
