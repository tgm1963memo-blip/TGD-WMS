import { movementBalanceKey } from '../utils/movementLedgerExcelUtils.js';

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
      lotNo: line.lot_no || '-',
      customerProduct: line.customer_product ?? line.product_name ?? line.product_id ?? '-',
      code: line.product_code ?? line.code ?? line.product_id ?? '-',
      qty: line.quantity ?? line.received_qty ?? line.expected_qty ?? '-',
    })),
    totalQty: sumQuantity(lines),
    totalWeight: sumWeight(lines),
    preparedBy: document?.handheld_confirmed_by ?? '-',
    approvedBy: document?.web_approved_by ?? '-',
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
      lotNo: line.lot_no || '-',
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

export function mapMovementLedgerToInventoryReportData({ rows = [], filters = {}, summary = null, openingBalances = new Map() }) {
  // Classify each row as inbound or outbound
  const INBOUND_TYPES = ['RECEIVE_CONFIRM', 'RECEIVE', 'INBOUND', 'ADJUSTMENT_IN', 'RETURN'];
  const OUTBOUND_TYPES = ['DISPATCH', 'DELIVERY', 'OUTBOUND', 'ISSUE', 'ADJUSTMENT_OUT'];

  const mappedLines = rows.map((row, index) => {
    const movType = (row.movement_type ?? row.movement_type_raw ?? '').toUpperCase();
    const isInbound = INBOUND_TYPES.some((t) => movType.includes(t));
    const isOutbound = OUTBOUND_TYPES.some((t) => movType.includes(t));
    const qty = Number(row.qty ?? row.quantity ?? 0);
    const weight = Number(row.weight ?? row.chargeable_weight ?? row.gross_weight ?? 0);
    const dateStr = formatDate(row.movement_date ?? row.created_at);

    return {
      id: row.id ?? `row-${index}`,
      _sortKey: row.movement_date ?? row.created_at ?? '',
      // Grouping key for the running balance below — same lot-first logic as
      // the Excel export (see movementBalanceKey), not product_code/
      // customer_product_code: customer withdrawal rows never carry a
      // product_id (see getConfirmedWithdrawalRows), so keying on product
      // fields alone silently split the same lot's inbound/outbound rows
      // into different balances and could show a withdrawal going negative
      // even when the lot had plenty of stock received earlier.
      _balanceKey: movementBalanceKey(row),
      date: dateStr,
      receivedDate: isInbound ? dateStr : '-',
      deliveryDate: isOutbound ? dateStr : '-',
      lotNo: row.lot_no || '-',
      customerProduct: row.customer_product ?? row.product_name ?? row.product_id ?? '-',
      descCode: row.product_code ?? row.customer_product_code ?? '-',
      weightKg: weight || '-',
      balanceForwardVolume: 0,
      balanceForwardWeight: 0,
      receivedVolume: isInbound ? qty : 0,
      receivedWeight: isInbound ? weight : 0,
      deliveryVolume: isOutbound ? qty : 0,
      deliveryWeight: isOutbound ? weight : 0,
      balanceVolume: 0,
      balanceWeight: 0,
      isClosed: false,
      volumeUnit: row.volume_unit ?? row.uom ?? 'กล่อง',
      remark: row.remark ?? row.source_reference ?? '-',
    };
  });

  // Sort by date oldest → newest; on same date put inbound before outbound
  mappedLines.sort((a, b) => {
    if (a._sortKey !== b._sortKey) return a._sortKey < b._sortKey ? -1 : 1;
    const aOut = a.deliveryVolume > 0 ? 1 : 0;
    const bOut = b.deliveryVolume > 0 ? 1 : 0;
    return aOut - bOut;
  });

  // Running balance per lot, seeded from openingBalances (every movement
  // strictly before the report's Date From) so a lot received before the
  // selected period still shows its true remaining stock instead of going
  // negative the moment it's withdrawn from within the period.
  const lotBalances = {}; // lotKey → { vol, weight }
  mappedLines.forEach((line) => {
    const key = line._balanceKey;
    if (!lotBalances[key]) {
      const opening = openingBalances.get(key) ?? { qty: 0, weight: 0 };
      lotBalances[key] = { vol: opening.qty, weight: opening.weight };
    }

    // Balance carried into this row, before applying its own movement
    line.balanceForwardVolume = lotBalances[key].vol;
    line.balanceForwardWeight = lotBalances[key].weight;

    lotBalances[key].vol += line.receivedVolume - line.deliveryVolume;
    lotBalances[key].weight += line.receivedWeight - line.deliveryWeight;

    line.balanceVolume = lotBalances[key].vol;
    line.balanceWeight = lotBalances[key].weight;
    line.isClosed = line.deliveryVolume > 0 && lotBalances[key].vol <= 0;
  });

  const subtotalReceivedVol = mappedLines.reduce((s, l) => s + (Number(l.receivedVolume) || 0), 0);
  const subtotalReceivedWt = mappedLines.reduce((s, l) => s + (Number(l.receivedWeight) || 0), 0);
  const subtotalDeliveryVol = mappedLines.reduce((s, l) => s + (Number(l.deliveryVolume) || 0), 0);
  const subtotalDeliveryWt = mappedLines.reduce((s, l) => s + (Number(l.deliveryWeight) || 0), 0);

  // Sum each distinct lot's opening balance once (not once per row in that lot)
  const totalBalanceForwardVol = Object.keys(lotBalances).reduce(
    (sum, key) => sum + (openingBalances.get(key)?.qty ?? 0), 0);
  const totalBalanceForwardWt = Object.keys(lotBalances).reduce(
    (sum, key) => sum + (openingBalances.get(key)?.weight ?? 0), 0);

  const totalBalanceVol = totalBalanceForwardVol + subtotalReceivedVol - subtotalDeliveryVol;
  const totalBalanceWt = totalBalanceForwardWt + subtotalReceivedWt - subtotalDeliveryWt;

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
    totalBalanceForwardVolume: totalBalanceForwardVol,
    totalBalanceForwardWeight: totalBalanceForwardWt,
  };
}
