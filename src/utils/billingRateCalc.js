// Pure calculation helpers for the billing rate engine: resolving which
// configured service rate applies to a product/customer, and turning a
// deposit line's storage duration into a billed amount for a given billing
// period. No Supabase calls here — services fetch the raw rows, these
// functions just do the math, so the logic is easy to unit-test/verify
// against a worked example independent of live data.

import { round2 } from './numberFormat.js';

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

// Sums the weight actually on hand for each day in [start, end] (both
// inclusive, YYYY-MM-DD): starts at receivedWeight and steps down by each
// withdrawal event's weight as of its date (an event dated exactly `start`
// is already reflected — i.e. withdrawals take effect the day they
// happened, not the day after). Only exactly-matched withdrawal events
// should be passed in (see computeExitDates-style matching upstream) —
// weight this can't attribute to a specific line should NOT appear here, so
// an unmatched withdrawal biases toward billing more rather than silently
// under-billing.
function sumWeightDays(receivedWeight, events, start, end) {
  const totalDays = diffDaysInclusive(start, end);
  if (totalDays <= 0) return 0;

  const withdrawnBeforeStart = events
    .filter((e) => e.date <= start)
    .reduce((sum, e) => sum + e.weight, 0);
  const weightAtStart = Math.max(0, receivedWeight - withdrawnBeforeStart);

  let weightDays = weightAtStart * totalDays;
  for (const e of events) {
    if (e.date > start && e.date <= end) {
      weightDays -= e.weight * diffDaysInclusive(e.date, end);
    }
  }
  return Math.max(0, weightDays);
}

// depositLines: [{ id, customer_id, customer_product_id, temperature_type,
//   received_weight, receipt_date (YYYY-MM-DD),
//   withdrawal_events: [{ weight, date (YYYY-MM-DD) }] }]
// Returns one computed line per deposit line that has a resolvable STORAGE
// rate and at least one billable day/occurrence within [periodStart, periodEnd].
//
// Storage is billed proportionally to weight-days actually on hand within
// the window (amount = rate x weightDays/period_days), rather than the
// line's full original weight times a whole-period count. This fixes two
// compounding bugs the day/whole-period model had: (1) a line only billed
// its full original weight or 0 ("exited"/not) with no reduction after a
// PARTIAL withdrawal, even though less was actually in storage from that
// day on; and (2) periods = ceil(days/period_days) double-billed any window
// whose day count wasn't an exact multiple of period_days (e.g. a 31-day
// calendar month against a 30-day rate billed 2 whole periods, not ~1.03).
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
    if (!receiptDate || receiptDate > periodEnd) continue;

    const receivedWeight = toNumber(dl.received_weight);

    if (rate.period_days == null) {
      // Charged once, only in the period that contains the receipt date —
      // this is a one-time deposit/handling-style fee, not a recurring
      // storage charge, so it isn't affected by later withdrawals.
      if (receiptDate < periodStart || receiptDate > periodEnd) continue;
      const amount = round2(receivedWeight * toNumber(rate.rate));
      results.push({
        depositLineId: dl.id, customerId: dl.customer_id, rate, periods: 1,
        days: null, weight: receivedWeight, amount,
      });
      continue;
    }

    const start = maxDateStr(receiptDate, periodStart);
    const end = periodEnd;
    if (!start || start > end) continue;

    const days = diffDaysInclusive(start, end);
    if (days <= 0) continue;

    const events = (dl.withdrawal_events ?? [])
      .map((e) => ({ weight: toNumber(e.weight), date: toDateOnly(e.date) }))
      .filter((e) => e.date && e.weight > 0);

    const weightDays = sumWeightDays(receivedWeight, events, start, end);
    if (weightDays <= 0) continue;

    const amount = round2((weightDays / rate.period_days) * toNumber(rate.rate));
    results.push({
      depositLineId: dl.id, customerId: dl.customer_id, rate,
      periods: round2(days / rate.period_days),
      days, weight: round2(weightDays / days), weightDays, amount,
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
    const amount = round2(quantity * toNumber(rate.rate));
    return {
      depositRequestId: sel.depositRequestId,
      customerId: sel.customerId,
      rate,
      quantity,
      amount,
    };
  });
}
