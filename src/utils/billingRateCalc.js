// Pure calculation helpers for the billing rate engine: resolving which
// configured service rate applies to a product/customer, and turning a
// deposit line's storage duration into a billed amount for a given billing
// period. No Supabase calls here — services fetch the raw rows, these
// functions just do the math, so the logic is easy to unit-test/verify
// against a worked example independent of live data.

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDateOnly(value) {
  if (!value) return null;
  const s = String(value).split('T')[0];
  return s || null;
}

function diffDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000) + 1;
}

function maxDateStr(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function minDateStr(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

// Picks the best-matching configured rate for a product/customer + service
// type. Precedence: an exact product-specific rate first, then a
// customer-wide "all items" rate scoped to the same temperature_type, then
// a customer-wide rate with no temperature restriction at all.
export function resolveServiceRate(rates = [], { customerId, customerProductId, temperatureType, serviceType, unitBasis = null }) {
  const candidates = rates.filter((r) =>
    r.is_active !== false
    && r.service_type === serviceType
    && (!unitBasis || r.unit_basis === unitBasis)
    && (r.customer_id === customerId || (customerProductId && r.customer_product_id === customerProductId)));

  const productSpecific = candidates.find((r) => r.customer_product_id && r.customer_product_id === customerProductId);
  if (productSpecific) return productSpecific;

  const temperatureMatched = candidates.find((r) => !r.customer_product_id && r.temperature_type && r.temperature_type === temperatureType);
  if (temperatureMatched) return temperatureMatched;

  const allItemsGeneric = candidates.find((r) => !r.customer_product_id && !r.temperature_type);
  return allItemsGeneric ?? null;
}

// depositLines: [{ id, customer_id, customer_product_id, temperature_type,
//   received_weight, receipt_date (YYYY-MM-DD), exit_date (YYYY-MM-DD or
//   null if still in storage as of "now") }]
// Returns one computed line per deposit line that has a resolvable STORAGE
// rate and at least one billable day/occurrence within [periodStart, periodEnd].
export function computeStorageInvoiceLines({ depositLines = [], rates = [], periodStart, periodEnd }) {
  const results = [];

  for (const dl of depositLines) {
    const rate = resolveServiceRate(rates, {
      customerId: dl.customer_id,
      customerProductId: dl.customer_product_id,
      temperatureType: dl.temperature_type,
      serviceType: 'STORAGE',
    });
    if (!rate) continue;

    const receiptDate = toDateOnly(dl.receipt_date);
    const exitDate = toDateOnly(dl.exit_date);
    if (!receiptDate || receiptDate > periodEnd) continue;
    if (exitDate && exitDate < periodStart) continue;

    if (rate.period_days == null) {
      // Charged once, only in the period that contains the receipt date —
      // this is a one-time deposit/handling-style fee, not a recurring one.
      if (receiptDate < periodStart || receiptDate > periodEnd) continue;
      const amount = toNumber(dl.received_weight) * toNumber(rate.rate);
      results.push({
        depositLineId: dl.id, customerId: dl.customer_id, rate, periods: 1,
        days: null, weight: toNumber(dl.received_weight), amount,
      });
      continue;
    }

    const effectiveEnd = minDateStr(exitDate ?? periodEnd, periodEnd);
    const start = maxDateStr(receiptDate, periodStart);
    const end = minDateStr(effectiveEnd, periodEnd);
    if (!start || !end || end < start) continue;

    const days = diffDaysInclusive(start, end);
    if (days <= 0) continue;
    const periods = Math.ceil(days / rate.period_days);
    const amount = toNumber(dl.received_weight) * toNumber(rate.rate) * periods;
    results.push({
      depositLineId: dl.id, customerId: dl.customer_id, rate, periods,
      days, weight: toNumber(dl.received_weight), amount,
    });
  }

  return results;
}

// Turns a customer's selected per-request auxiliary services (container
// reefer plug-in, overnight flat fee, etc. — see
// tgd_customer_deposit_request_services) into billed amounts. Not
// weight-based: amount = rate x quantity, capped at the rate's
// max_quantity if one is configured (e.g. reefer plug-in billed by the
// hour, capped at 12 hours per occurrence).
export function computeAuxiliaryServiceLines({ selections = [] }) {
  return selections.map((sel) => {
    const rate = sel.rate ?? {};
    const cap = rate.max_quantity != null ? Number(rate.max_quantity) : null;
    const quantity = cap != null ? Math.min(toNumber(sel.quantity, 1), cap) : toNumber(sel.quantity, 1);
    const amount = quantity * toNumber(rate.rate);
    return {
      depositRequestId: sel.depositRequestId,
      customerId: sel.customerId,
      rate,
      quantity,
      amount,
    };
  });
}
