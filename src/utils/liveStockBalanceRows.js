// Shared shape for the reports that used to read the separately-maintained
// per-location stock ledger table (customer storage balance, storage aging,
// monthly storage billing summary) and showed different numbers than the
// live "ยอดคงเหลือ" pages because that ledger silently drops/never-updates
// on several real code paths (unresolved catalog product on deposit,
// unresolved lot on withdrawal, post-confirmation admin corrections to
// product/lot/location — see the investigation behind this fix).
//
// getAllCustomerStockBalances() computes the balance fresh from
// tgd_customer_deposit_request_lines / tgd_customer_withdrawal_request_lines
// on every read, so it can't drift by construction — this turns its rows
// into the flat shape these report pages need, with a customer name looked
// up client-side (the RPC only returns customer_id).
//
// Trade-off accepted for this fix: deposit lines aren't tied to a physical
// warehouse location/pallet in this schema, so there is no location/pallet/
// warehouse column here — reports that used to show one now omit it rather
// than show stale/incorrect location data.
export function toLiveStockBalanceRows(lines = [], customers = []) {
  const customerById = new Map(customers.map((c) => [c.id, c]));

  return lines.map((line) => {
    const customerId = line.request?.customer_id ?? line.customer_id ?? null;
    const customer = customerId ? customerById.get(customerId) : null;

    return {
      deposit_line_id: line.id ?? null,
      customer_id: customerId,
      customer_name: customer?.customer_name ?? customer?.customer_code ?? null,
      product_code: line.customer_product_code ?? null,
      product_name: line.product_name ?? null,
      lot_no: line.lot_no ?? null,
      tracking_code: line.tracking_code ?? null,
      temperature_type: line.temperature_type ?? null,
      qty_boxes: Number(line.actual_boxes ?? 0),
      qty_weight: Number(line.actual_weight ?? 0),
      uom: 'กล่อง',
      request_no: line.request?.request_no ?? null,
      received_at: line.request?.last_action_at ?? line.request?.expected_arrival_date ?? null,
      mfg_date: line.mfg_date ?? null,
      exp_date: line.exp_date ?? null,
      note: line.note ?? null,
      actual_note: line.actual_note ?? null,
    };
  });
}
