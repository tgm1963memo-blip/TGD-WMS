function formatDate(value) {
  if (!value) return '-';
  const text = String(value);
  return text.includes('T') ? text.split('T')[0] : text;
}

function sumQuantity(lines, keys = ['quantity', 'received_qty', 'expected_qty']) {
  return (lines ?? []).reduce((total, line) => {
    const qty = keys.map((key) => Number(line?.[key])).find((value) => Number.isFinite(value) && value > 0);
    return total + (qty ?? 0);
  }, 0);
}

function sumWeight(lines) {
  return (lines ?? []).reduce((total, line) => total + (Number(line?.weight) || 0), 0);
}

export function mapReceivingDocumentToReportData(document) {
  const lines = document?.tgd_receiving_lines ?? [];
  return {
    customerName: document?.customer_name ?? document?.customer_id ?? '-',
    address: document?.customer_address ?? document?.delivery_address ?? '-',
    attention: document?.attention ?? document?.contact_name ?? '-',
    receiveDate: formatDate(document?.receive_date ?? document?.expected_receive_date ?? document?.created_at),
    arrivalTime: document?.arrival_time ?? '-',
    startTime: document?.start_time ?? '-',
    finishTime: document?.finish_time ?? '-',
    goodsTemp: document?.goods_temp ?? '-',
    truckTemp: document?.truck_temp ?? document?.container_temp ?? '-',
    truckNo: document?.truck_no ?? document?.container_no ?? '-',
    sealNo: document?.seal_no ?? '-',
    receiveFrom: document?.receive_from ?? document?.source_no ?? '-',
    remark: document?.remark ?? document?.note ?? '-',
    documentNo: document?.document_no ?? document?.receiving_no ?? document?.id ?? '-',
    lines: lines.map((line, index) => ({
      id: line.id ?? `line-${index}`,
      lotNo: line.lot_no ?? line.lot_id ?? '-',
      customerProduct: line.customer_product ?? line.product_name ?? line.product_id ?? '-',
      code: line.product_code ?? line.code ?? line.product_id ?? '-',
      qty: line.quantity ?? line.received_qty ?? line.expected_qty ?? '-',
    })),
    totalQty: sumQuantity(lines),
    totalWeight: sumWeight(lines),
  };
}

export function mapOutboundDetailToDeliverySlipData(detail) {
  const document = detail?.document ?? {};
  const lines = detail?.lines ?? [];
  return {
    customerName: document.customer_name ?? document.customer_id ?? '-',
    address: document.customer_address ?? '-',
    deliveryTo: document.delivery_to ?? document.ship_to ?? '-',
    roomTemperature: document.room_temp ?? '-',
    truckTemperature: document.truck_temp ?? '-',
    documentNo: document.document_no ?? document.id ?? '-',
    documentDate: formatDate(document.requested_ship_date ?? document.created_at),
    lines: lines.map((line, index) => ({
      id: line.id ?? `line-${index}`,
      lotNo: line.lot_no ?? line.lot_id ?? '-',
      location: line.location_id ?? line.from_location_id ?? '-',
      customerProduct: line.customer_product ?? line.product_name ?? line.product_id ?? '-',
      itemCode: line.product_code ?? line.product_id ?? '-',
      batchNo: line.batch_no ?? '-',
      totalWeightKg: line.requested_weight ?? line.picked_weight ?? line.weight ?? '-',
      balanceTotal: line.balance_total ?? line.available_qty ?? '-',
    })),
    totalWeightKg: sumWeight(lines),
    balanceTotal: lines.reduce((total, line) => total + (Number(line.balance_total) || 0), 0),
    remark: document.remark ?? document.note ?? '-',
    startTime: document.start_time ?? '-',
    finishTime: document.finish_time ?? '-',
  };
}

export function mapMovementLedgerToInventoryReportData({ rows = [], filters = {}, summary = null }) {
  const mappedLines = rows.map((row, index) => ({
    id: row.id ?? `row-${index}`,
    date: formatDate(row.movement_date ?? row.created_at),
    receivedDate: formatDate(row.received_date ?? row.inbound_date),
    deliveryDate: formatDate(row.delivery_date ?? row.outbound_date),
    lotNo: row.lot_no ?? row.lot_id ?? '-',
    customerProduct: row.customer_product ?? row.product_name ?? row.product_id ?? '-',
    descCode: row.product_code ?? row.product_id ?? '-',
    weightKg: row.weight ?? row.weight_kg ?? '-',
    balanceForward: row.balance_forward ?? row.opening_balance ?? '-',
    received: row.received_qty ?? row.inbound_qty ?? '-',
    delivery: row.delivery_qty ?? row.outbound_qty ?? '-',
    balance: row.balance_qty ?? row.closing_balance ?? '-',
    volumeUnit: row.volume_unit ?? row.uom ?? '-',
    remark: row.remark ?? '-',
  }));

  const subtotalReceived = mappedLines.reduce((total, line) => total + (Number(line.received) || 0), 0);
  const subtotalDelivery = mappedLines.reduce((total, line) => total + (Number(line.delivery) || 0), 0);
  const subtotalWeight = mappedLines.reduce((total, line) => total + (Number(line.weightKg) || 0), 0);

  return {
    customer: filters.customer_name ?? filters.customer_id ?? summary?.customerName ?? '-',
    address: filters.customer_address ?? '-',
    reportMonth: filters.report_month ?? '-',
    dateFrom: formatDate(filters.date_from ?? filters.from_date),
    dateTo: formatDate(filters.date_to ?? filters.to_date),
    issuedDate: formatDate(new Date().toISOString()),
    lines: mappedLines,
    subtotalReceived,
    subtotalDelivery,
    subtotalWeight,
    totalReceived: summary?.totalInboundQty ?? subtotalReceived,
    totalDelivery: summary?.totalOutboundQty ?? subtotalDelivery,
    totalWeight: subtotalWeight,
  };
}
