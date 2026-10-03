import { round2 } from './numberFormat.js';

export const UNASSIGNED_LOCATION_LABEL = 'ยังไม่กำหนด Location';

const byNaturalText = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'th', { numeric: true });

// Splits one stock-balance line into one row per active pallet location
// (lot x location, 1:1) for the Excel export, instead of one row with every
// pallet joined into a single cell. Pallet allocations usually record boxes
// only (weight NULL), so a pallet's kg is derived from the lot's own kg per
// box; the last pallet row takes the rounding remainder so the lot's rows
// always add back up to exactly its balance. Any balance not on an active
// pallet becomes one extra "ยังไม่กำหนด Location" row.
//
// allocations: listInventoryLocations rows ({ palletCode, remainingBoxes,
// remainingWeight, active }). Returns [{ location, boxes, weight }].
export function splitBalanceByLocation(totalBoxes, totalWeight, allocations = []) {
  const boxes = Number(totalBoxes ?? 0);
  const weight = Number(totalWeight ?? 0);
  const kgPerBox = boxes > 0 ? weight / boxes : 0;

  const pallets = allocations
    .filter((a) => a.active && Number(a.remainingBoxes ?? 0) > 0)
    .sort((a, b) => byNaturalText(a.palletCode, b.palletCode));

  const rows = pallets.map((a) => {
    const palletBoxes = Number(a.remainingBoxes);
    const palletWeight = a.remainingWeight != null ? Number(a.remainingWeight) : palletBoxes * kgPerBox;
    return { location: a.palletCode, boxes: palletBoxes, weight: round2(palletWeight) };
  });

  const palletBoxes = rows.reduce((s, r) => s + r.boxes, 0);
  const remainderBoxes = boxes - palletBoxes;

  if (remainderBoxes > 0 || rows.length === 0) {
    const allocatedWeight = rows.reduce((s, r) => s + r.weight, 0);
    rows.push({
      location: UNASSIGNED_LOCATION_LABEL,
      boxes: Math.max(0, remainderBoxes),
      weight: round2(Math.max(0, weight - allocatedWeight)),
    });
  } else if (remainderBoxes === 0) {
    // Fully on pallets: true up the last row so rounded kg sums to the lot.
    const allocatedWeight = rows.reduce((s, r) => s + r.weight, 0);
    const last = rows[rows.length - 1];
    last.weight = round2(last.weight + (weight - allocatedWeight));
  }

  return rows;
}
