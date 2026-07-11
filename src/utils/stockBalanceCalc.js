// Ports tgd_get_customer_stock_balance's exact matching/pooling algorithm
// (supabase/migrations/20260708100019_fix_stock_balance_lot_fanout_overcount.sql)
// into JS, so report code that needs the *same* remaining-balance number the
// stock balance page shows doesn't have to re-derive it with different
// (and provably inconsistent) logic.
//
// Per deposit line, withdrawn quantity = "exact" matches (a withdrawal line
// with a direct source_customer_deposit_request_line_id link, or — lacking
// that — a matching tracking_code) plus a FIFO "pool share" of withdrawal
// lines that have neither (matched only by lot_no + customer_product_code,
// distributed across sibling deposit lines in line_no order, earliest lines
// absorbing the pool first). Balance is received minus withdrawn, floored
// at 0 — never negative, matching GREATEST(0, ...) in the RPC.
//
// depositLines: [{ id, customer_id, lot_no, customer_product_code, line_no,
//   tracking_code, received_boxes, received_weight }]
// withdrawalLines: [{ customer_id, source_customer_deposit_request_line_id,
//   tracking_code, lot_no, source_lot_no, customer_product_code,
//   picked_boxes, picked_weight }]
//
// Returns Map<deposit_line_id, { boxes, weight }> — the floored balance
// remaining for each deposit line.
export function computeDepositLineBalances(depositLines = [], withdrawalLines = []) {
  const depositById = new Map(depositLines.map((dl) => [dl.id, dl]));
  const depositByTrackingCode = new Map();
  for (const dl of depositLines) {
    if (dl.tracking_code) depositByTrackingCode.set(dl.tracking_code, dl);
  }

  const exactWithdrawnByLine = new Map(); // deposit_line_id -> { boxes, weight }
  const ambiguousLines = [];

  for (const wl of withdrawalLines) {
    let matchedDepositLineId = null;
    if (wl.source_customer_deposit_request_line_id) {
      const direct = depositById.get(wl.source_customer_deposit_request_line_id);
      if (direct && direct.customer_id === wl.customer_id) matchedDepositLineId = direct.id;
    } else if (wl.tracking_code) {
      const match = depositByTrackingCode.get(wl.tracking_code);
      if (match && match.customer_id === wl.customer_id) matchedDepositLineId = match.id;
    }

    if (matchedDepositLineId != null) {
      const acc = exactWithdrawnByLine.get(matchedDepositLineId) ?? { boxes: 0, weight: 0 };
      acc.boxes += Number(wl.picked_boxes ?? 0);
      acc.weight += Number(wl.picked_weight ?? 0);
      exactWithdrawnByLine.set(matchedDepositLineId, acc);
    } else if (!wl.source_customer_deposit_request_line_id && !wl.tracking_code) {
      // Only truly ambiguous lines (no direct link AND no tracking code)
      // join the lot-level pool — mirrors the RPC's ambiguous_pool CTE
      // filter exactly.
      ambiguousLines.push(wl);
    }
    // A line with a tracking_code that matches no known deposit line, or a
    // source link pointing at a deposit line outside this dataset's scope,
    // contributes to neither bucket — same as the RPC (its JOINs simply
    // wouldn't match either).
  }

  const poolByKey = new Map(); // "customerId|lotNo|productCode" -> { boxes, weight }
  for (const wl of ambiguousLines) {
    const lotNo = (wl.source_lot_no && String(wl.source_lot_no).trim()) || wl.lot_no || '';
    const key = `${wl.customer_id ?? ''}|${lotNo}|${wl.customer_product_code ?? ''}`;
    const acc = poolByKey.get(key) ?? { boxes: 0, weight: 0 };
    acc.boxes += Number(wl.picked_boxes ?? 0);
    acc.weight += Number(wl.picked_weight ?? 0);
    poolByKey.set(key, acc);
  }

  // Group deposit lines the same way (customer + lot + product), ordered
  // by line_no — this ordering is what makes the pool distribution FIFO.
  const groups = new Map();
  for (const dl of depositLines) {
    const key = `${dl.customer_id ?? ''}|${dl.lot_no ?? ''}|${dl.customer_product_code ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(dl);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => (Number(a.line_no ?? 0) - Number(b.line_no ?? 0)) || String(a.id).localeCompare(String(b.id)));
  }

  const poolShareByLine = new Map(); // deposit_line_id -> { boxes, weight }
  for (const [key, arr] of groups.entries()) {
    const pool = poolByKey.get(key) ?? { boxes: 0, weight: 0 };
    let cumBoxes = 0;
    let cumWeight = 0;
    for (const dl of arr) {
      const beforeBoxes = cumBoxes;
      const beforeWeight = cumWeight;
      cumBoxes += Number(dl.received_boxes ?? 0);
      cumWeight += Number(dl.received_weight ?? 0);
      poolShareByLine.set(dl.id, {
        boxes: Math.min(Number(dl.received_boxes ?? 0), Math.max(0, pool.boxes - beforeBoxes)),
        weight: Math.min(Number(dl.received_weight ?? 0), Math.max(0, pool.weight - beforeWeight)),
      });
    }
  }

  const balances = new Map();
  for (const dl of depositLines) {
    const exact = exactWithdrawnByLine.get(dl.id) ?? { boxes: 0, weight: 0 };
    const pool = poolShareByLine.get(dl.id) ?? { boxes: 0, weight: 0 };
    const withdrawnBoxes = exact.boxes + pool.boxes;
    const withdrawnWeight = exact.weight + pool.weight;
    balances.set(dl.id, {
      boxes: Math.max(0, Number(dl.received_boxes ?? 0) - withdrawnBoxes),
      weight: Math.max(0, Number(dl.received_weight ?? 0) - withdrawnWeight),
    });
  }

  return balances;
}
