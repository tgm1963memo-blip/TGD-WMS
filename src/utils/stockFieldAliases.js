export function resolveQuantity(row = {}) {
  const value = row.qty_on_hand ?? row.qty_available ?? row.quantity ?? row.qty ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveWeight(row = {}) {
  const value = row.chargeable_weight ?? row.weight ?? row.gross_weight ?? row.net_weight ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveUom(row = {}) {
  return row.uom ?? row.base_uom ?? row.unit ?? null;
}
