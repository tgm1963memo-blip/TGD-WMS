import { supabase } from './supabaseClient.js';
import { getDepositInventoryLines } from './customerDepositRequestService.js';

// Warehouse-wide "stock with no location yet" for the dashboard.
//
// A deposit line is in stock while its remaining balance (received minus
// non-cancelled withdrawals, see getDepositInventoryLines) is above zero. Its
// unlocated part is what was received but never put on a pallet in
// tgd_customer_deposit_line_locations, capped at what is still in stock, so a
// lot that was withdrawn straight from the dock does not count as unlocated.
// The percentage is unlocated boxes over all boxes still in stock.

const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 150;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function computeUnlocatedStock({ lines = [], allocations = [], customersById = new Map() }) {
  const allocatedByLine = new Map();
  for (const a of allocations) {
    if (!a?.line_id) continue;
    const current = allocatedByLine.get(a.line_id) ?? { boxes: 0, weight: 0 };
    current.boxes += toNumber(a.boxes);
    current.weight += toNumber(a.weight);
    allocatedByLine.set(a.line_id, current);
  }

  let totalBoxes = 0;
  let boxes = 0;
  let weight = 0;
  const items = [];

  for (const line of lines) {
    const inStockBoxes = toNumber(line.actual_boxes);
    const inStockWeight = toNumber(line.actual_weight);
    if (inStockBoxes <= 0 && inStockWeight <= 0) continue;
    totalBoxes += inStockBoxes;

    const allocated = allocatedByLine.get(line.id) ?? { boxes: 0, weight: 0 };
    const rawBoxes = toNumber(line.raw_actual_boxes ?? line.actual_boxes);
    const rawWeight = toNumber(line.raw_actual_weight ?? line.actual_weight);
    const unlocatedBoxes = Math.min(inStockBoxes, Math.max(0, rawBoxes - allocated.boxes));
    const unlocatedWeight = Math.min(inStockWeight, Math.max(0, rawWeight - allocated.weight));
    // Weight-only lines (no box count) still count when nothing was allocated.
    const isUnlocated = unlocatedBoxes > 0 || (rawBoxes === 0 && unlocatedWeight > 0);
    if (!isUnlocated) continue;

    boxes += unlocatedBoxes;
    weight += unlocatedWeight;
    const request = line.request ?? {};
    const customer = customersById.get(request.customer_id) ?? null;
    items.push({
      lineId: line.id,
      depositRequestId: line.deposit_request_id ?? request.id ?? null,
      requestNo: request.request_no ?? null,
      customerId: request.customer_id ?? null,
      customerName: customer?.customer_name ?? customer?.customer_code ?? '-',
      trackingCode: line.tracking_code ?? null,
      productName: line.product_name ?? null,
      productCode: line.customer_product_code ?? null,
      unlocatedBoxes,
      unlocatedWeight: round2(unlocatedWeight),
      inStockBoxes,
      linePct: inStockBoxes > 0 ? Math.round((unlocatedBoxes / inStockBoxes) * 100) : 100,
      receivedAt: request.reviewed_at ?? request.expected_arrival_date ?? null,
      // For printing A5 stickers from the dashboard.
      lotNo: line.lot_no ?? null,
      mfgDate: line.mfg_date ?? null,
      expDate: line.exp_date ?? null,
      lotBoxes: rawBoxes,
      lotWeight: round2(rawWeight),
    });
  }

  // Oldest receipts first: they have waited longest for a location.
  items.sort((a, b) => String(a.receivedAt ?? '').localeCompare(String(b.receivedAt ?? '')) || String(a.trackingCode ?? '').localeCompare(String(b.trackingCode ?? '')));

  return {
    lots: items.length,
    boxes,
    weight: round2(weight),
    totalBoxes,
    pct: totalBoxes > 0 ? round2((boxes / totalBoxes) * 100) : 0,
    items,
  };
}

async function fetchAllocationsForLines(lineIds) {
  const rows = [];
  for (let i = 0; i < lineIds.length; i += IN_CHUNK_SIZE) {
    const chunk = lineIds.slice(i, i + IN_CHUNK_SIZE);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('tgd_customer_deposit_line_locations')
        .select('id, line_id, boxes, weight')
        .in('line_id', chunk)
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { data: rows, error };
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return { data: rows, error: null };
}

export async function getUnlocatedStockSummary() {
  if (!supabase) return { data: computeUnlocatedStock({}), error: null };

  const linesResult = await getDepositInventoryLines();
  if (linesResult.error) return { data: null, error: linesResult.error };
  const lines = (linesResult.data ?? []).filter((l) => toNumber(l.actual_boxes) > 0 || toNumber(l.actual_weight) > 0);

  const [allocationResult, customerResult] = await Promise.all([
    fetchAllocationsForLines(lines.map((l) => l.id)),
    supabase.from('tgd_customers').select('id, customer_code, customer_name'),
  ]);
  // A partial allocation read would make placed stock look unplaced, so
  // report an error instead of a number that is too high.
  if (allocationResult.error) return { data: null, error: allocationResult.error };

  const customersById = new Map((customerResult.data ?? []).map((c) => [c.id, c]));
  return { data: computeUnlocatedStock({ lines, allocations: allocationResult.data, customersById }), error: null };
}
