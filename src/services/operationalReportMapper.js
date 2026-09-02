import { movementBalanceKey, sortRowsByProductThenLot } from '../utils/movementLedgerExcelUtils.js';

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
      // picked_weight is the confirmed/actual amount once recorded — it can
      // differ from what was originally requested, so it must take
      // priority (see the same fix applied to the customer withdrawal
      // print document and balance-lock RPC this session).
      totalWeightKg: line.picked_weight ?? line.requested_weight ?? line.weight ?? '-',
      balanceTotal: line.balance_total ?? line.available_qty ?? '-',
    })),
    totalWeightKg: sumWeight(lines),
    balanceTotal: lines.reduce((total, line) => total + (Number(line.balance_total) || 0), 0),
    remark: document.remark ?? document.note ?? '-',
    startTime: document.start_time ?? '-',
    finishTime: document.finish_time ?? '-',
  };
}

export function mapMovementLedgerToInventoryReportData({ rows = [], filters = {}, summary = null, openingBalances = new Map(), sortMode = 'date', authoritativeTotals = null }) {
  // Classify each row as inbound or outbound
  const INBOUND_TYPES = ['RECEIVE_CONFIRM', 'RECEIVE', 'INBOUND', 'ADJUSTMENT_IN', 'RETURN'];
  const OUTBOUND_TYPES = ['DISPATCH', 'DELIVERY', 'OUTBOUND', 'ISSUE', 'ADJUSTMENT_OUT'];
  const isGrouped = sortMode !== 'date';
  const groupBy = sortMode === 'productTrackingCode' ? 'trackingCode' : 'lot';

  // Always establish chronological order first — this is what keeps each
  // lot's running balance mathematically correct below, regardless of
  // whether the final display order ends up grouped by product/lot.
  const dateSortedRows = [...rows].sort((a, b) => {
    const aTime = new Date(a.movement_date ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.movement_date ?? b.created_at ?? 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    const movTypeA = (a.movement_type ?? a.movement_type_raw ?? '').toUpperCase();
    const movTypeB = (b.movement_type ?? b.movement_type_raw ?? '').toUpperCase();
    const aOut = OUTBOUND_TYPES.some((t) => movTypeA.includes(t)) ? 1 : 0;
    const bOut = OUTBOUND_TYPES.some((t) => movTypeB.includes(t)) ? 1 : 0;
    return aOut - bOut;
  });

  const orderedRows = isGrouped
    ? sortRowsByProductThenLot(dateSortedRows, groupBy)
    : dateSortedRows;

  const mappedLines = orderedRows.map((row, index) => {
    const movType = (row.movement_type ?? row.movement_type_raw ?? '').toUpperCase();
    const isInbound = INBOUND_TYPES.some((t) => movType.includes(t));
    const isOutbound = OUTBOUND_TYPES.some((t) => movType.includes(t));
    const qty = Number(row.qty ?? row.quantity ?? 0);
    const weight = Number(row.weight ?? row.chargeable_weight ?? row.gross_weight ?? 0);
    const dateStr = formatDate(row.movement_date ?? row.created_at);

    return {
      id: row.id ?? `row-${index}`,
      // Grouping key for the running balance below — same lot-first logic as
      // the Excel export (see movementBalanceKey): product_id/product_code
      // resolve inconsistently across deposit/withdrawal/stock_movement rows
      // (see getConfirmedWithdrawalRows), so keying on product fields alone
      // risks silently splitting the same lot's inbound/outbound rows into
      // different balances and could show a withdrawal going negative even
      // when the lot had plenty of stock received earlier.
      _balanceKey: movementBalanceKey(row, groupBy),
      date: dateStr,
      receivedDate: isInbound ? dateStr : '-',
      deliveryDate: isOutbound ? dateStr : '-',
      lotNo: row.lot_no || '-',
      customerProduct: row.customer_product ?? row.product_name ?? row.product_id ?? '-',
      descCode: row.product_code ?? row.customer_product_code ?? '-',
      trackingCode: row.tracking_code ?? '-',
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

  // When grouped by product-then-lot (or product-then-tracking-code),
  // collapse a repeated product's name/code down to the first row of its
  // block (which can span several lots/tracking codes) and mark each
  // group's last row so the print template can draw a divider there —
  // purely adjacency-based, so this is a no-op in plain chronological order
  // (sortMode 'date'), where adjacent rows essentially never share a
  // product+lot/tracking code.
  mappedLines.forEach((line, index) => {
    if (!isGrouped) {
      line._showProductCell = true;
      line._isLastOfLotGroup = false;
      return;
    }
    const prev = mappedLines[index - 1];
    const next = mappedLines[index + 1];
    const sameProductAsPrev = prev && prev.customerProduct === line.customerProduct && prev.descCode === line.descCode;
    const sameGroupAsNext = next && next.customerProduct === line.customerProduct && next.descCode === line.descCode
      && (groupBy === 'trackingCode' ? next.trackingCode === line.trackingCode : next.lotNo === line.lotNo);
    line._showProductCell = !sameProductAsPrev;
    line._isLastOfLotGroup = !sameGroupAsNext;
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

    // Floored at 0 to match tgd_get_customer_stock_balance (the same RPC
    // behind the stock balance page), which never reports a negative
    // remaining balance either — without this floor, a lot whose recorded
    // withdrawals exceed what it actually received would drift the running
    // total negative here while the balance page clamped it at 0, so the
    // two screens' "remaining" figures could never agree for that lot.
    lotBalances[key].vol = Math.max(0, lotBalances[key].vol + line.receivedVolume - line.deliveryVolume);
    const nextWeight = lotBalances[key].weight + line.receivedWeight - line.deliveryWeight;
    // Once volume hits (or drops below) zero, the lot is fully depleted —
    // any leftover weight is measurement drift between the deposit's and
    // the withdrawal's independent scale readings, not real physical
    // stock. A real reported row: 4 boxes delivered against 4 remaining
    // (volume correctly hits 0, marked CLOSED below) but weight settled at
    // a phantom 0.10kg instead of 0. Same rule as addMovement in
    // movementLedgerExcelUtils.js (the Excel export's/on-screen ledger's
    // balance tracker) — kept as a separate copy here rather than a shared
    // import because this mapper classifies inbound/outbound with its own
    // INBOUND_TYPES/OUTBOUND_TYPES lists, not addMovement's isInbound.
    lotBalances[key].weight = lotBalances[key].vol <= 0 ? 0 : Math.max(0, nextWeight);

    line.balanceVolume = lotBalances[key].vol;
    line.balanceWeight = lotBalances[key].weight;
    line.isClosed = line.deliveryVolume > 0 && lotBalances[key].vol <= 0;
  });

  const subtotalReceivedVol = mappedLines.reduce((s, l) => s + (Number(l.receivedVolume) || 0), 0);
  const subtotalReceivedWt = mappedLines.reduce((s, l) => s + (Number(l.receivedWeight) || 0), 0);
  const subtotalDeliveryVol = mappedLines.reduce((s, l) => s + (Number(l.deliveryVolume) || 0), 0);
  const subtotalDeliveryWt = mappedLines.reduce((s, l) => s + (Number(l.deliveryWeight) || 0), 0);

  // Deliberately the plain sum of every row's own balanceForwardVolume/
  // Weight -- NOT each distinct lot's true opening balance counted once.
  // This is intentional: the printed report's per-page SUB TOTAL ยอดยกมา
  // (see InventoryMovementReportTemplate.jsx) is itself a plain per-page
  // row sum, so a lot with several rows on one page re-adds its running
  // balance once per row there too. Confirmed wanted over the alternative
  // (each lot counted once, which makes ยอดยกมา satisfy
  // ยอดยกมา+รับเข้า-จ่ายออก=คงเหลือ but no longer equals the sum of what's
  // printed on each page): TOTAL must equal the sum of every page's own
  // SUB TOTAL exactly, and each SUB TOTAL must equal the sum of its own
  // visible rows exactly -- both hold here because `pages` is just a
  // partition of `mappedLines` with no rows dropped or duplicated, so
  // summing every row directly here is mathematically identical to
  // summing every page's own row-sum. The trade-off: this ยอดยกมา figure
  // no longer represents true non-duplicated opening stock, and the
  // accounting identity above will generally NOT hold at the TOTAL row
  // once any lot has more than one row in the period -- confirmed
  // accepted in exchange for a self-checking printed document.
  const totalBalanceForwardVol = mappedLines.reduce((sum, l) => sum + (Number(l.balanceForwardVolume) || 0), 0);
  const totalBalanceForwardWt = mappedLines.reduce((sum, l) => sum + (Number(l.balanceForwardWeight) || 0), 0);

  // Grand total is the sum of each lot's own final balance (lotBalances,
  // already floored at 0 per lot above) — NOT forward + received - delivered
  // recomputed flat. That flat formula ignores the per-lot floor entirely,
  // so a lot whose recorded withdrawals exceeded what it received (clamped
  // to 0 in lotBalances, same as the stock balance page's RPC) still
  // subtracted its true negative amount from this total, understating it
  // relative to every other total in this report and to the balance page.
  //
  // authoritativeTotals (from getAuthoritativeBalanceTotals, which ports the
  // stock balance RPC's exact per-line/FIFO-pool algorithm) overrides this
  // when supplied, so the report's grand total matches the balance page
  // exactly rather than approximating it via lot_no-grouped movement rows —
  // the two group withdrawn quantity differently whenever a LOT spans
  // multiple deposit lines (tracking codes), which lot_no-only grouping
  // can't fully replicate.
  // The lotBalances-only fallback (used when authoritativeTotals isn't
  // supplied) has the same untouched-lot gap as ยอดยกมา above: a lot with
  // no movement row this period never gets a lotBalances entry, so its
  // carried-forward balance would otherwise silently drop out of the
  // fallback closing total too. Add it back in for every openingBalances
  // entry lotBalances doesn't already cover -- mirrors the equivalent fix
  // already in place for the Excel export's own balance total (see
  // computeGrandTotals in movementLedgerExcelUtils.js).
  let untouchedLotVol = 0;
  let untouchedLotWt = 0;
  openingBalances.forEach((opening, key) => {
    if (!lotBalances[key]) {
      untouchedLotVol += Number(opening?.qty) || 0;
      untouchedLotWt += Number(opening?.weight) || 0;
    }
  });
  const totalBalanceVol = authoritativeTotals?.totalBoxes
    ?? (Object.values(lotBalances).reduce((sum, b) => sum + b.vol, 0) + untouchedLotVol);
  const totalBalanceWt = authoritativeTotals?.totalWeight
    ?? (Object.values(lotBalances).reduce((sum, b) => sum + b.weight, 0) + untouchedLotWt);

  // received/delivered must stay period-scoped plain sums over this report's
  // date-filtered rows — NOT authoritativeTotals.totalReceivedBoxes/Weight
  // or totalDeliveredBoxes/Weight. Those come from getAuthoritativeBalanceTotals,
  // which is built on the stock-balance RPC's own base_lines CTE, and that
  // RPC's final SELECT filters `WHERE balance > 0` (see
  // tgd_get_customer_stock_balance/tgd_get_all_customer_stock_balances) —
  // correct for its actual purpose (current stock on hand), but it means
  // ANY lot that reached a zero balance by asOfDate is excluded from the
  // result set ENTIRELY, taking its whole received_weight/withdrawn_weight
  // with it. A lot carried in from before this period and fully dispatched
  // during it (very ordinary — every "CLOSED" withdrawal does this) vanishes
  // from the authoritative total's รับเข้า/จ่ายออก contribution completely,
  // even though its movements are still correctly present in this report's
  // own rows. Confirmed real gap: a real OVO August report showed จ่ายออก
  // undercounted by ~135,840 กก. — almost exactly equal to ยอดยกมา, i.e.
  // nearly every closed-out lot's delivery was dropped from this total
  // while still counted in ยอดยกมา/คงเหลือ, breaking ยอดยกมา+รับเข้า-จ่ายออก=คงเหลือ.
  // Only totalBalanceVol/totalBalanceWt above may still come from
  // authoritativeTotals -- a zero-balance lot legitimately contributes 0
  // there either way, so that override is harmless (and is what keeps this
  // report's คงเหลือ matching the stock balance page exactly, its original
  // intent).
  const totalReceivedVol = summary?.totalInboundQty ?? subtotalReceivedVol;
  const totalReceivedWt = subtotalReceivedWt;
  const totalDeliveryVol = summary?.totalOutboundQty ?? subtotalDeliveryVol;
  const totalDeliveryWt = subtotalDeliveryWt;

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
    totalReceived: totalReceivedVol,
    totalReceivedWeight: totalReceivedWt,
    totalDelivery: totalDeliveryVol,
    totalDeliveryWeight: totalDeliveryWt,
    totalBalanceVolume: totalBalanceVol,
    totalBalanceWeight: totalBalanceWt,
    totalBalanceForwardVolume: totalBalanceForwardVol,
    totalBalanceForwardWeight: totalBalanceForwardWt,
  };
}
