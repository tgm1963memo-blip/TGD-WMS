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
  // Classify each row as inbound or outbound
  const INBOUND_TYPES = ['RECEIVE_CONFIRM', 'RECEIVE', 'INBOUND', 'ADJUSTMENT_IN', 'RETURN'];
  const OUTBOUND_TYPES = ['DISPATCH', 'DELIVERY', 'OUTBOUND', 'ISSUE', 'ADJUSTMENT_OUT'];

  const mappedLines = rows.map((row, index) => {
    const movType = (row.movement_type ?? row.movement_type_raw ?? '').toUpperCase();
    const isInbound = INBOUND_TYPES.some((t) => movType.includes(t));
    const isOutbound = OUTBOUND_TYPES.some((t) => movType.includes(t));
    const qty = Number(row.qty ?? row.quantity ?? 0);
    const weight = Number(row.weight ?? row.chargeable_weight ?? row.gross_weight ?? 0);

    return {
      id: row.id ?? `row-${index}`,
      date: formatDate(row.movement_date ?? row.created_at),
      receivedDate: isInbound ? formatDate(row.movement_date ?? row.created_at) : '-',
      deliveryDate: isOutbound ? formatDate(row.movement_date ?? row.created_at) : '-',
      lotNo: row.lot_no ?? row.lot_id ?? '-',
      customerProduct: row.customer_product ?? row.product_name ?? row.product_id ?? '-',
      descCode: row.product_code ?? row.customer_product_code ?? '-',
      weightKg: weight || '-',
      // Balance forward (opening) — from view if available, else 0
      balanceForwardVolume: row.balance_forward_vol ?? row.opening_balance_vol ?? 0,
      balanceForwardWeight: row.balance_forward_weight ?? row.opening_balance_weight ?? 0,
      // Received section
      receivedVolume: isInbound ? qty : 0,
      receivedWeight: isInbound ? weight : 0,
      // Delivery section
      deliveryVolume: isOutbound ? qty : 0,
      deliveryWeight: isOutbound ? weight : 0,
      // Balance (closing) — from view if available, else calculate
      balanceVolume: row.balance_vol ?? row.closing_balance_vol ?? (isInbound ? qty : -qty),
      balanceWeight: row.balance_weight ?? row.closing_balance_weight ?? (isInbound ? weight : -weight),
      volumeUnit: row.volume_unit ?? row.uom ?? 'Box',
      remark: row.remark ?? row.source_reference ?? '-',
    };
  });

  const subtotalReceivedVol = mappedLines.reduce((s, l) => s + (Number(l.receivedVolume) || 0), 0);
  const subtotalReceivedWt = mappedLines.reduce((s, l) => s + (Number(l.receivedWeight) || 0), 0);
  const subtotalDeliveryVol = mappedLines.reduce((s, l) => s + (Number(l.deliveryVolume) || 0), 0);
  const subtotalDeliveryWt = mappedLines.reduce((s, l) => s + (Number(l.deliveryWeight) || 0), 0);
  const totalBalanceVol = subtotalReceivedVol - subtotalDeliveryVol;
  const totalBalanceWt = subtotalReceivedWt - subtotalDeliveryWt;

  return {
    customer: filters.customer_name ?? filters.customer_id ?? summary?.customerName ?? '-',
    address: filters.customer_address ?? '-',
    reportMonth: filters.report_month ?? '-',
    dateFrom: formatDate(filters.date_from ?? filters.from_date),
    dateTo: formatDate(filters.date_to ?? filters.to_date),
    issuedDate: formatDate(new Date().toISOString()),
    lines: mappedLines,
    subtotalReceived: subtotalReceivedVol,
    subtotalDelivery: subtotalDeliveryVol,
    subtotalWeight: subtotalReceivedWt + subtotalDeliveryWt,
    totalReceived: summary?.totalInboundQty ?? subtotalReceivedVol,
    totalReceivedWeight: subtotalReceivedWt,
    totalDelivery: summary?.totalOutboundQty ?? subtotalDeliveryVol,
    totalDeliveryWeight: subtotalDeliveryWt,
    totalBalanceVolume: totalBalanceVol,
    totalBalanceWeight: totalBalanceWt,
    totalBalanceForwardVolume: 0,
    totalBalanceForwardWeight: 0,
  };
}
