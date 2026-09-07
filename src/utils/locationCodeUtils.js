// Single source of truth for the warehouse location code format
// {room}-{side}-{row} (e.g. "42-L-01") -- room = zone_code, side = L/R,
// row = a shelf row that physically holds ~12-16 pallets loosely (no
// separate level/bay identity anymore; see the 20260905090000 migration
// that collapsed the old 5-segment {room}-{side}-{row}-{level}-{bay}
// scheme down to this one and consolidated every level*bay location within
// a row into a single row-level record). Previously duplicated as four
// independent regex copies (src/services/warehouseLayoutService.js,
// src/features/dashboard/WarehouseLayoutWidget.jsx, two copies in
// src/features/handheld/HandheldPage.jsx, and
// src/components/customer/CustomerDepositDetailModal.jsx) -- now all four
// import from here instead.

export function parseLocationCode(code) {
  const m = /^(.+)-([LR])-(\d+)$/i.exec(code ?? '');
  return m ? { room: m[1], side: m[2].toUpperCase(), row: Number(m[3]) } : null;
}

export function buildLocationCode(room, side, row) {
  return `${room}-${side}-${String(row).padStart(2, '0')}`;
}
