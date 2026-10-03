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
    // for the lot). Each cycle's own billing_period_end is shown as its
    // row's DELIVERY DATE -- it's the end of that billed cycle, not
    // necessarily a real physical withdrawal event, since a
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
        trackingCode: first.tracking_code ?? null,
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
        chargedWeight: 0,
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
        rows[rows.length - 1].chargedWeight = weight;
      } else {
        balanceVolume -= qty;
        balanceWeight -= weight;
        pushRow({
          deliveryDate: line.movement_date,
          receivedVolume: 0, receivedWeight: 0, deliveryVolume: qty, deliveryWeight: weight,
          rate: line.rate, charge: line.amount, remark: line.source_document_no,
        });
        rows[rows.length - 1].handlingFee = round2(toNum(line.amount));
        rows[rows.length - 1].chargedWeight = weight;
      }
    }

    // A lot billed entirely through the period-based STORAGE flow has no
    // discrete received/delivery event -- each STORAGE line is one cycle's
    // own weight-on-hand snapshot. Print one row per cycle so each row's
    // weight, dates, note and charge are its own: folding them into one row
    // with only the last cycle's note made e.g. "CYCLES 2" sit next to a
    // "ค่าฝาก 1 งวด ... 2,870 กก." remark while the charge was really
    // (4,620 + 2,870) x rate (confirmed real case: BID-20261002-0042, lot
    // C2-05265911). BALANCE FORWARD is the previous cycle's weight and
    // RECEIVED/DELIVERY the increase/decrease since it, so each row still
    // reconciles forward + received - delivery = balance.
    const perCycleRows = rows.length === 0 && sortedStorageLines.length > 0;
    if (perCycleRows) {
      let previousWeight = null;
      for (const storageLine of sortedStorageLines) {
        const weight = toNum(storageLine.chargeable_weight);
        const delta = previousWeight == null ? 0 : weight - previousWeight;
        balanceVolume = 0;
        balanceWeight = weight;
        pushRow({
          deliveryDate: storageLine.billing_period_end ?? null,
          receivedVolume: 0, receivedWeight: delta > 0 ? round2(delta) : 0,
          deliveryVolume: 0, deliveryWeight: delta < 0 ? round2(-delta) : 0,
          remark: storageLine.line_note ?? null,
        });
        const row = rows[rows.length - 1];
        row.chargeUnit = storageLine.rate ?? null;
        row.cycleCount = 1;
        row.coldStorageCharge = round2(toNum(storageLine.amount));
        // Weight actually charged for this cycle -- summed across rows/lots
        // it equals the draft header's total_chargeable_weight.
        row.chargedWeight = weight;
        row.total = row.coldStorageCharge;
        previousWeight = weight;
      }
    } else if (rows.length === 0) {
      pushRow({ deliveryDate: null, receivedVolume: 0, receivedWeight: 0, deliveryVolume: 0, deliveryWeight: 0 });
    }

    // Storage cycles on a lot that also has movement lines (or an opening
    // balance) are folded onto its last event row, showing the last cycle's
    // note -- a lot catching up many cycles at once (real case: 11) would
    // otherwise repeat the same "ค่าฝาก 1 งวด (...)" sentence 11 times.
    if (storageLines.length > 0 && !perCycleRows) {
      const lastRow = rows[rows.length - 1];
      const storageNote = sortedStorageLines[sortedStorageLines.length - 1]?.line_note ?? null;
      const totalStorageCharge = round2(storageLines.reduce((s, l) => s + toNum(l.amount), 0));
      lastRow.chargeUnit = storageLines.find((l) => l.rate != null)?.rate ?? null;
      lastRow.cycleCount = sortedStorageLines.length;
      lastRow.coldStorageCharge = totalStorageCharge;
      lastRow.chargedWeight = round2(lastRow.chargedWeight
        + storageLines.reduce((s, l) => s + toNum(l.chargeable_weight), 0));
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
      cycleCount: rows.reduce((s, r) => s + (r.cycleCount ?? 0), 0) || null,
      coldStorageCharge: round2(rows.reduce((s, r) => s + r.coldStorageCharge, 0)),
      chargedWeight: round2(rows.reduce((s, r) => s + r.chargedWeight, 0)),
      total: round2(rows.reduce((s, r) => s + r.total, 0)),
    };

    return {
      key, lotNo: first.lot_no, productCode: first.product_code, productName: first.product_name,
      trackingCode: first.tracking_code ?? null, rows, subtotal,
    };
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
    chargedWeight: sumField('chargedWeight'),
    total: sumField('total'),
  };

  return { lots, grandTotal };
}
