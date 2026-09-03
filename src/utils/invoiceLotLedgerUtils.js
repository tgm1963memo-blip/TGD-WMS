import { round2 } from './numberFormat.js';

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isInboundType(movementType) {
  const t = String(movementType ?? '').toUpperCase();
  return t === 'RECEIVE_CONFIRM' || t === 'STORAGE_OPENING_BALANCE' || t.includes('RECEIVE') || t.includes('INBOUND');
}

// Reshapes invoice draft lines (one row per movement/storage charge, see
// tgd_billing_invoice_draft_lines) into a THAI MAX-style per-lot ledger:
// balance forward -> received -> delivery -> balance, walked chronologically
// per lot, with a subtotal per lot and a grand total across all lots.
//
// Our storage-charge engine (computeStorageInvoiceLines) resolves ONE
// amount per lot for the whole billing period — it does not bill in
// repeating sub-periods the way a source system's own ledger might display.
// Rather than invent day-counts we can't back with a real computed charge,
// that single amount is folded onto the lot's last event row instead of
// being split across synthetic sub-period rows.
export function buildInvoiceLotLedger(lines = []) {
  const groupsByKey = new Map();
  const order = [];

  for (const line of lines) {
    // Group by the real deposit line when a row carries one -- lot_no is
    // free text some customers type as a date/description ("10/08/2026 ต้น
    // ใส่กล่อง") rather than a unique identifier, so two genuinely different
    // physical deposits (different receipt dates, different tracking codes)
    // can share the exact same lot_no::product_code string. Grouping by
    // that string alone merged their independent, individually-consistent
    // cycle histories into one row whose combined weights/date-ranges
    // looked like overlapping/duplicate billing even though each deposit's
    // own cycles were correct on their own (confirmed real case: 3 cycles
    // 400->390->380kg for one deposit + 2 cycles 1000->990kg for another,
    // sharing a lot_no, merged into a nonsensical-looking 5-cycle row).
    // Movement-based lines (no deposit_line_id) still fall back to the old key.
    const key = line.deposit_line_id
      ? `dep:${line.deposit_line_id}`
      : `lot:${line.lot_no ?? ''}::${line.product_code ?? ''}`;
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, []);
      order.push(key);
    }
    groupsByKey.get(key).push(line);
  }

  const lots = order.map((key) => {
    const groupLines = groupsByKey.get(key);
    const first = groupLines[0];

    const storageLines = groupLines.filter((l) => l.movement_type === 'STORAGE');
    const eventLines = groupLines
      .filter((l) => l.movement_type !== 'STORAGE')
      .slice()
      .sort((a, b) => new Date(a.movement_date ?? 0) - new Date(b.movement_date ?? 0));

    const openingLine = eventLines.find((l) => l.movement_type === 'STORAGE_OPENING_BALANCE');
    const movementLines = eventLines.filter((l) => l !== openingLine);

    // A lot billed entirely through the period-based STORAGE flow (no
    // separate RECEIVE_CONFIRM/DISPATCH movement lines at all -- the normal
    // case for a manual period draft) has no movement_date anywhere to pull
    // from; every STORAGE line only carries billing_period_start/end (the
    // CYCLE's own dates, not a movement event). The lot's earliest cycle's
    // billing_period_start is receiptDate exactly when that first-ever
    // cycle is included in this draft (see computeStorageInvoiceLines --
    // cycleIndex 0 starts exactly at receiptDate), and still a reasonable
    // "received" reference otherwise (the start of what this draft covers
    // for the lot). The latest cycle's billing_period_end is shown as
    // DELIVERY DATE for the same lots -- it's the end of the last billed
    // cycle, not necessarily a real physical withdrawal event, since a
    // storage cycle billed in full the moment it starts ("เต็มรอบทันที")
    // doesn't require the goods to actually leave by its own end date.
    const sortedStorageLines = storageLines
      .slice()
      .sort((a, b) => new Date(a.billing_period_start ?? 0) - new Date(b.billing_period_start ?? 0));

    const receivedDate = openingLine?.movement_date
      ?? movementLines.find((l) => isInboundType(l.movement_type))?.movement_date
      ?? first.movement_date
      ?? sortedStorageLines[0]?.billing_period_start
      ?? null;

    const storageCycleEndDate = movementLines.length === 0
      ? sortedStorageLines[sortedStorageLines.length - 1]?.billing_period_end ?? null
      : null;

    const weightPerUnitSource = groupLines.find((l) => toNum(l.qty) > 0);
    const weightPerUnit = weightPerUnitSource
      ? round2(toNum(weightPerUnitSource.chargeable_weight) / toNum(weightPerUnitSource.qty))
      : null;

    let balanceVolume = openingLine ? toNum(openingLine.qty) : 0;
    let balanceWeight = openingLine ? toNum(openingLine.chargeable_weight) : 0;

    const rows = [];

    function pushRow({ deliveryDate, receivedVolume, receivedWeight, deliveryVolume, deliveryWeight, rate, charge, remark }) {
      rows.push({
        receivedDate,
        deliveryDate: deliveryDate ?? null,
        lotNo: first.lot_no,
        productCode: first.product_code,
        productName: first.product_name,
        weightPerUnit,
        balanceForwardVolume: balanceVolume - receivedVolume + deliveryVolume,
        balanceForwardWeight: balanceWeight - receivedWeight + deliveryWeight,
        receivedVolume,
        receivedWeight,
        deliveryVolume,
        deliveryWeight,
        balanceVolume,
        balanceWeight,
        uom: first.uom || 'KG',
        rate: rate ?? null,
        handlingFee: 0,
        chargeUnit: null,
        cycleCount: null,
        coldStorageCharge: 0,
        total: round2(toNum(charge)),
        remark: remark ?? null,
        _charge: toNum(charge),
      });
    }

    if (openingLine) {
      pushRow({ deliveryDate: null, receivedVolume: 0, receivedWeight: 0, deliveryVolume: 0, deliveryWeight: 0 });
    }

    for (const line of movementLines) {
      const qty = toNum(line.qty);
      const weight = toNum(line.chargeable_weight);
      const inbound = isInboundType(line.movement_type);

      if (inbound) {
        balanceVolume += qty;
        balanceWeight += weight;
        pushRow({
          deliveryDate: null,
          receivedVolume: qty, receivedWeight: weight, deliveryVolume: 0, deliveryWeight: 0,
          rate: line.rate, charge: line.amount, remark: line.source_document_no,
        });
        rows[rows.length - 1].handlingFee = round2(toNum(line.amount));
      } else {
        balanceVolume -= qty;
        balanceWeight -= weight;
        pushRow({
          deliveryDate: line.movement_date,
          receivedVolume: 0, receivedWeight: 0, deliveryVolume: qty, deliveryWeight: weight,
          rate: line.rate, charge: line.amount, remark: line.source_document_no,
        });
        rows[rows.length - 1].handlingFee = round2(toNum(line.amount));
      }
    }

    // A lot billed entirely through the period-based STORAGE flow has no
    // discrete received/delivery event to report -- each STORAGE line is
    // only a cycle's own weight-on-hand snapshot, not a movement. Leaving
    // BALANCE FORWARD/RECEIVED/DELIVERY/BALANCE at a flat 0.00 reads as
    // "nothing here" even though real weight is being carried and billed,
    // and multiple cycles landing in one draft (e.g. a period spanning
    // several 15-day cycles) can each snapshot a DIFFERENT weight if a
    // withdrawal or additional deposit happened between them -- picking
    // just one cycle's number arbitrarily doesn't reconcile against the
    // others. Instead: BALANCE FORWARD is the first cycle's weight in this
    // period (what was on hand when the period's coverage starts), BALANCE
    // is the last cycle's weight (on hand as of the selected end date), and
    // RECEIVED/DELIVERY are the sum of weight increases/decreases between
    // consecutive cycles in between -- so forward + received - delivery
    // always reconciles exactly to the ending balance, matching a real
    // period-summary ledger instead of one arbitrary snapshot.
    const lastStorageWeight = sortedStorageLines.length
      ? toNum(sortedStorageLines[sortedStorageLines.length - 1].chargeable_weight)
      : 0;
    let periodReceivedWeight = 0;
    let periodDeliveryWeight = 0;
    for (let i = 1; i < sortedStorageLines.length; i += 1) {
      const delta = toNum(sortedStorageLines[i].chargeable_weight) - toNum(sortedStorageLines[i - 1].chargeable_weight);
      if (delta > 0) periodReceivedWeight += delta;
      else periodDeliveryWeight += -delta;
    }

    if (rows.length === 0) {
      balanceVolume = 0;
      balanceWeight = lastStorageWeight;
      pushRow({
        deliveryDate: storageCycleEndDate,
        receivedVolume: 0, receivedWeight: round2(periodReceivedWeight),
        deliveryVolume: 0, deliveryWeight: round2(periodDeliveryWeight),
      });
    }

    const totalStorageCharge = round2(storageLines.reduce((s, l) => s + toNum(l.amount), 0));
    const storageRate = storageLines.find((l) => l.rate != null)?.rate ?? null;
    // Cycle-detail text already generated per STORAGE line at draft-creation
    // time (buildInvoiceDraftLineFromStorageLine's line_note — the period
    // days, exact date range, and chargeable weight the customer already
    // sees on the draft-view table) -- surface the same text here so the
    // printed invoice carries the same detail instead of only the summed
    // charge with no explanation of how it was derived.
    // Show only the LAST cycle's own note -- a lot that hasn't been billed
    // in a while can catch up many cycles at once in a single draft (real
    // case: 11 cycles for one lot), and dumping every cycle's own sentence
    // onto one row was an unreadable wall of text repeating the same
    // "ค่าฝาก 1 งวด (...)" phrasing 11 times. The row's BALANCE FORWARD/
    // RECEIVED/DELIVERY/BALANCE numbers above already summarize the whole
    // span; the note only needs to explain the cycle actually anchoring
    // this row's charge (the last one, matching the ending balance).
    const storageNote = sortedStorageLines[sortedStorageLines.length - 1]?.line_note ?? null;
    if (storageLines.length > 0) {
      const lastRow = rows[rows.length - 1];
      lastRow.chargeUnit = storageRate;
      lastRow.cycleCount = sortedStorageLines.length;
      lastRow.coldStorageCharge = totalStorageCharge;
      lastRow.total = round2(lastRow.handlingFee + totalStorageCharge);
      lastRow.remark = [lastRow.remark, storageNote].filter(Boolean).join(' / ') || null;
    }

    const subtotal = {
      balanceForwardVolume: rows[0].balanceForwardVolume,
      balanceForwardWeight: rows[0].balanceForwardWeight,
      receivedVolume: round2(rows.reduce((s, r) => s + r.receivedVolume, 0)),
      receivedWeight: round2(rows.reduce((s, r) => s + r.receivedWeight, 0)),
      deliveryVolume: round2(rows.reduce((s, r) => s + r.deliveryVolume, 0)),
      deliveryWeight: round2(rows.reduce((s, r) => s + r.deliveryWeight, 0)),
      balanceVolume: rows[rows.length - 1].balanceVolume,
      balanceWeight: rows[rows.length - 1].balanceWeight,
      handlingFee: round2(rows.reduce((s, r) => s + r.handlingFee, 0)),
      coldStorageCharge: round2(rows.reduce((s, r) => s + r.coldStorageCharge, 0)),
      total: round2(rows.reduce((s, r) => s + r.total, 0)),
    };

    return { key, lotNo: first.lot_no, productCode: first.product_code, productName: first.product_name, rows, subtotal };
  });

  const sumField = (field) => round2(lots.reduce((s, l) => s + l.subtotal[field], 0));
  const grandTotal = {
    balanceForwardVolume: sumField('balanceForwardVolume'),
    balanceForwardWeight: sumField('balanceForwardWeight'),
    receivedVolume: sumField('receivedVolume'),
    receivedWeight: sumField('receivedWeight'),
    deliveryVolume: sumField('deliveryVolume'),
    deliveryWeight: sumField('deliveryWeight'),
    balanceVolume: sumField('balanceVolume'),
    balanceWeight: sumField('balanceWeight'),
    handlingFee: sumField('handlingFee'),
    coldStorageCharge: sumField('coldStorageCharge'),
    total: sumField('total'),
  };

  return { lots, grandTotal };
}
