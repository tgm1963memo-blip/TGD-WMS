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
    const key = `${line.lot_no ?? ''}::${line.product_code ?? ''}`;
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

    const receivedDate = openingLine?.movement_date
      ?? movementLines.find((l) => isInboundType(l.movement_type))?.movement_date
      ?? first.movement_date
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

    if (rows.length === 0) {
      pushRow({ deliveryDate: null, receivedVolume: 0, receivedWeight: 0, deliveryVolume: 0, deliveryWeight: 0 });
    }

    const totalStorageCharge = round2(storageLines.reduce((s, l) => s + toNum(l.amount), 0));
    const storageRate = storageLines.find((l) => l.rate != null)?.rate ?? null;
    if (storageLines.length > 0) {
      const lastRow = rows[rows.length - 1];
      lastRow.chargeUnit = storageRate;
      lastRow.coldStorageCharge = totalStorageCharge;
      lastRow.total = round2(lastRow.handlingFee + totalStorageCharge);
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
