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

function maxDateStr(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

// Picks the best-matching configured rate for a product/customer + service
// type. Precedence: an exact product-specific rate first, then a
// customer-wide "all items" rate scoped to the same temperature_type, then
// a customer-wide rate with no temperature restriction at all.
//
// asOfDate (optional, default null): when provided, also requires the
// candidate's contract_start_date/contract_end_date (if set) to cover this
// date — a rate configured with a contract window is only resolvable for
// cycles/receipts that actually fall inside it. Left null, every existing
// call site behaves exactly as before contract fields existed (rates with
// no contract window set are unaffected either way, since the check is a
// no-op when both bounds are null).
export function resolveServiceRate(rates = [], { customerId, customerProductId, temperatureType, serviceType, unitBasis = null, asOfDate = null }) {
  const candidates = rates.filter((r) =>
    r.is_active !== false
    && r.service_type === serviceType
    && (!unitBasis || r.unit_basis === unitBasis)
    && (r.customer_id === customerId || (customerProductId && r.customer_product_id === customerProductId))
    && (asOfDate == null
      || ((!r.contract_start_date || asOfDate >= r.contract_start_date)
        && (!r.contract_end_date || asOfDate <= r.contract_end_date))));

  const productSpecific = candidates.find((r) => r.customer_product_id && r.customer_product_id === customerProductId);
  if (productSpecific) return productSpecific;

  const temperatureMatched = candidates.find((r) => !r.customer_product_id && r.temperature_type && r.temperature_type === temperatureType);
  if (temperatureMatched) return temperatureMatched;

  const allItemsGeneric = candidates.find((r) => !r.customer_product_id && !r.temperature_type);
  return allItemsGeneric ?? null;
}

// STORAGE-specific wrapper around resolveServiceRate: tries the deposit
// line's own temperature_type first (so a customer who genuinely configured
// a distinct FREEZE_FROZEN rate still gets it), and only when that finds
// nothing AND the line is FREEZE_FROZEN, falls back to resolving under
// FROZEN instead. Physically a Freeze & Frozen lot sits in the same frozen
// storage as a plain FROZEN one, so it should bill at that rate by default
// rather than showing up as "unrated" just because nobody thought to
// configure a rate under a temperature tier that's really the same room.
export function resolveStorageRateForLine(rates, dl, asOfDate) {
  const direct = resolveServiceRate(rates, {
    customerId: dl.customer_id,
    customerProductId: dl.customer_product_id,
    temperatureType: dl.temperature_type,
    serviceType: 'STORAGE',
    asOfDate,
  });
  if (direct) return direct;
  if (dl.temperature_type !== 'FREEZE_FROZEN') return null;

  return resolveServiceRate(rates, {
    customerId: dl.customer_id,
    customerProductId: dl.customer_product_id,
    temperatureType: 'FROZEN',
    serviceType: 'STORAGE',
    asOfDate,
  });
}

// depositLines: [{ id, customer_id, customer_product_id, temperature_type,
//   received_weight, receipt_date (YYYY-MM-DD),
//   withdrawal_events: [{ weight, date (YYYY-MM-DD) }] }]
// Returns one computed line per FULL storage cycle billed within
// [periodStart, periodEnd] — a deposit line spanning several cycles in one
// window (e.g. a manual quarterly run) produces several result rows, one
// per cycle, each with its own exact weight/period dates; a lot billed via
// the auto per-lot flow always gets exactly one cycle per call, since that
// flow already calls this once per generateLotBillingCycles() window.
//
// Confirmed billing rule ("คิดเต็มรอบทันที ไม่เฉลี่ยตามวัน"): the moment a
// new period_days-sized cycle begins — anchored to the LOT'S OWN
// receipt_date, not to periodStart/periodEnd's calendar boundaries — it is
// billed in full at that cycle's weight-on-hand, with no day-fraction
// discount for a cycle still in progress. This is NOT the old ceil(days_
// in_window / period_days) model this replaced (see git history): that one
// measured whole periods against the ARBITRARY staff-chosen window length,
// so a 31-day calendar month against a 30-day rate wrongly counted 2 whole
// periods just from window length alone, regardless of where the lot's own
// cycle boundaries actually fell. This instead walks the lot's own fixed
// cycle grid and only counts a cycle once its own boundary is reached,
// which is the precise, anchor-correct way to detect "a new round began" —
// a 31-day window still only advances through the lot's cycles that
// genuinely started inside it.
// Applies a rate's free-period/discount/min-charge contract terms to a
// raw computed amount. Returns the adjusted amount plus the individual
// adjustment fields so callers can show/persist exactly why the final
// amount differs from weight x rate x periods — every one of these fields
// is optional/additive on the result row; a rate with none of these terms
// set produces the exact same amount as before they existed.
// free_days is handled by the caller BEFORE this function is invoked (a
// cycle/receipt wholly inside the free window is zeroed out there and never
// reaches this function) — this function only ever sees an amount that's
// already past the free-period check, so it only applies discount/min-charge.
function applyContractAdjustments(rawAmount, rate) {
  const notes = [];
  let amount = rawAmount;
  let discountAmount = 0;
  if (rate.discount_percent != null && rate.discount_percent > 0) {
    discountAmount = round2(amount * (toNumber(rate.discount_percent) / 100));
    amount = round2(amount - discountAmount);
    notes.push(`ส่วนลด ${rate.discount_percent}% (-${discountAmount})`);
  }

  let minChargeApplied = false;
  let minChargeTopupAmount = 0;
  if (rate.min_charge_amount != null && amount < rate.min_charge_amount) {
    minChargeTopupAmount = round2(rate.min_charge_amount - amount);
    amount = round2(rate.min_charge_amount);
    minChargeApplied = true;
    notes.push(`ปรับเป็นค่าฝากขั้นต่ำ ${rate.min_charge_amount} บาท (+${minChargeTopupAmount})`);
  }

  return {
    amount,
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    minChargeApplied: minChargeApplied || undefined,
    minChargeTopupAmount: minChargeApplied ? minChargeTopupAmount : undefined,
    adjustmentNote: notes.length ? notes.join(', ') : undefined,
  };
}

export function computeStorageInvoiceLines({ depositLines = [], rates = [], periodStart, periodEnd }) {
  const results = [];

  for (const dl of depositLines) {
    const receiptDate = toDateOnly(dl.receipt_date);
    if (!receiptDate || receiptDate > periodEnd) continue;

    // asOfDate anchors the contract-window check to the lot's own receipt
    // date — a rate whose contract_start_date/contract_end_date doesn't
    // cover the date this lot actually arrived isn't usable for it at all,
    // for the whole time it's billed under this rate row. (A rate renewal
    // mid-way through a long-stored lot's life — i.e. a contract expiring
    // while a lot is still on cycle 4 of 6 — isn't modeled here; that would
    // need per-cycle re-resolution, which isn't built yet since there's no
    // confirmed need for it.)
    const rate = resolveStorageRateForLine(rates, dl, receiptDate);
    if (!rate) continue;

    const receivedWeight = toNumber(dl.received_weight);

    if (rate.period_days == null) {
      // Charged once, only in the period that contains the receipt date —
      // this is a one-time deposit/handling-style fee, not a recurring
      // storage charge, so it isn't affected by later withdrawals.
      if (receiptDate < periodStart || receiptDate > periodEnd) continue;
      if (rate.free_days != null && rate.free_days > 0) {
        results.push({
          depositLineId: dl.id, customerId: dl.customer_id, rate, periods: 1,
          days: null, weight: receivedWeight, amount: 0,
          freePeriodApplied: true, adjustmentNote: 'อยู่ในช่วงฟรีค่าฝาก (free_days)',
        });
        continue;
      }
      const rawAmount = round2(receivedWeight * toNumber(rate.rate));
      const adjusted = applyContractAdjustments(rawAmount, rate);
      results.push({
        depositLineId: dl.id, customerId: dl.customer_id, rate, periods: 1,
        days: null, weight: receivedWeight, ...adjusted,
      });
      continue;
    }

    const windowStart = maxDateStr(receiptDate, periodStart);
    if (!windowStart || windowStart > periodEnd) continue;

    const events = (dl.withdrawal_events ?? [])
      .map((e) => ({ weight: toNumber(e.weight), date: toDateOnly(e.date) }))
      .filter((e) => e.date && e.weight > 0);

    // Walk the lot's own cycle grid starting from the first cycle that
    // GENUINELY BEGINS on/after periodStart -- not "whichever cycle
    // windowStart falls into" (an earlier version of this line picked up
    // a cycle that started in an EARLIER period but was still in progress
    // when this period opened). "เต็มรอบทันที" (bill a cycle in full the
    // moment it begins, confirmed business rule -- see the first test in
    // billing-rate-calc.test.js) already means that earlier period's own
    // draft billed this same cycle in full too, so re-including it here
    // double-charges it. Confirmed real gap: OVO/FROZEN had 124 storage
    // cycles counted in BOTH the July and August 2026 drafts, ~94,665.93
    // THB billed twice. Each cycle is now billed by exactly the one period
    // it starts in -- still in full the instant it begins, and still able
    // to extend past periodEnd if that's where its period_days grid cell
    // naturally lands (เต็มรอบทันที itself is unchanged).
    //
    // Clamped at 0: when the lot's own receipt date falls ON or AFTER
    // periodStart (the ordinary case -- most lots are received during the
    // very month being billed), daysBetween(receiptDate, periodStart) is
    // negative, and an unclamped Math.ceil() of a negative number rounds
    // toward zero -- landing on -1 rather than 0 -- which walked the cycle
    // grid one full period_days BACKWARD from receiptDate, billing a
    // phantom cycle that started before the goods physically arrived.
    // Confirmed real gap: OVO/FROZEN lots received mid-August (e.g.
    // tracking FR260820050, received 2026-08-20) were billed exactly 2x
    // -- once for a phantom cycle starting 2026-08-05, a receipt date that
    // never happened, plus once for the real cycle starting 2026-08-20.
    let cycleIndex = Math.max(0, Math.ceil(daysBetween(receiptDate, periodStart) / rate.period_days));
    let cycleStart = addDays(receiptDate, cycleIndex * rate.period_days);

    while (cycleStart <= periodEnd) {
      // Strictly BEFORE cycleStart, not on-or-before: a withdrawal dated
      // exactly on a cycle's first day still occupied storage for that
      // cycle (it left sometime during that day, not before it began) -
      // using <= here undercounted every lot with a withdrawal landing
      // exactly on a later cycle's boundary, silently dropping that whole
      // cycle's charge for whatever portion was still present.
      const withdrawnBeforeCycleStart = events
        .filter((e) => e.date < cycleStart)
        .reduce((sum, e) => sum + e.weight, 0);
      const weightAtCycleStart = round2(Math.max(0, receivedWeight - withdrawnBeforeCycleStart));

      if (weightAtCycleStart <= 0) break; // fully withdrawn before this cycle even began

      const cycleEnd = addDays(cycleStart, rate.period_days - 1);

      // A cycle that starts before the lot's free-day window has elapsed is
      // billed as fully free — not skipped, so the report still shows one
      // traceable row per cycle with amount 0 and the reason why.
      if (rate.free_days != null && rate.free_days > 0 && cycleStart < addDays(receiptDate, rate.free_days)) {
        results.push({
          depositLineId: dl.id, customerId: dl.customer_id, rate, periods: 1,
          days: rate.period_days, weight: weightAtCycleStart, weightDays: null, amount: 0,
          periodStart: cycleStart, periodEnd: cycleEnd,
          freePeriodApplied: true, adjustmentNote: 'อยู่ในช่วงฟรีค่าฝาก (free_days)',
        });
      } else {
        const rawAmount = round2(weightAtCycleStart * toNumber(rate.rate));
        const adjusted = applyContractAdjustments(rawAmount, rate);
        results.push({
          depositLineId: dl.id, customerId: dl.customer_id, rate, periods: 1,
          days: rate.period_days, weight: weightAtCycleStart, weightDays: null,
          periodStart: cycleStart, periodEnd: cycleEnd, ...adjusted,
        });
      }

      cycleIndex += 1;
      cycleStart = addDays(receiptDate, cycleIndex * rate.period_days);
    }
  }

  return results;
}

// Splits the time since a lot's last billed date into consecutive N-day
// cycles anchored to the lot's OWN receipt date (not a calendar month
// boundary) — a lot received on the 30th bills in 30-day-aligned windows
// (e.g. day 30 through day 13 next month for a 15-day rate), matching how
// `computeStorageInvoiceLines` already treats period_days as a rolling day
// count, not a calendar half-month split.
//
// billedThroughDate is the last date already charged for this lot (from a
// prior auto-billing run's persisted line, or a one-time staff-entered
// seed — see tgd_lot_billing_cutoff_overrides). Cycles resume the day
// after it. A lot with NO billedThroughDate at all (never billed under
// auto mode, no seed set) must not be passed here — the caller has to
// treat that as "needs setup" and require a seed first, since silently
// starting from the lot's receipt date risks double-billing a lot that
// was already charged under the old manual date-range flow.
//
// The final cycle is clipped to billThroughDate even if that's short of a
// full period_days window (a still-in-progress cycle gets billed for the
// elapsed days so far, consistent with how a manual period's trailing
// partial window already prorates via weightDays) — the next run will
// pick up from there once billedThroughDate reflects that partial charge.
export function generateLotBillingCycles({ receiptDate, periodDays, billedThroughDate, billThroughDate }) {
  const anchor = toDateOnly(receiptDate);
  const through = toDateOnly(billThroughDate);
  const seeded = toDateOnly(billedThroughDate);
  const periodDaysInt = Math.max(1, Math.round(toNumber(periodDays, 0)));
  if (!anchor || !through || !seeded) return [];

  let cursor = addDays(seeded, 1);
  if (cursor < anchor) cursor = anchor;
  if (cursor > through) return [];

  const cycles = [];
  while (cursor <= through) {
    const cycleIndex = Math.floor(daysBetween(anchor, cursor) / periodDaysInt);
    const gridEnd = addDays(anchor, (cycleIndex + 1) * periodDaysInt - 1);
    const end = gridEnd < through ? gridEnd : through;
    cycles.push({ start: cursor, end });
    cursor = addDays(end, 1);
  }
  return cycles;
}

// Turns a customer's selected per-request auxiliary services (container
// reefer plug-in, overnight labor, etc. — see
// tgd_customer_deposit_request_services / tgd_customer_withdrawal_request_services)
// into billed amounts. Not weight-based: amount = rate x quantity, capped at
// the rate's max_quantity if one is configured (e.g. reefer plug-in billed
// by the hour, capped at 12 hours per occurrence). sourceRequestId is either
// a deposit or withdrawal request id — this function is request-type
// agnostic, it's purely a traceability pass-through, never matched against
// either table here.
export function computeAuxiliaryServiceLines({ selections = [] }) {
  return selections.map((sel) => {
    const rate = sel.rate ?? {};
    const cap = rate.max_quantity != null ? Number(rate.max_quantity) : null;
    const quantity = cap != null ? Math.min(toNumber(sel.quantity, 1), cap) : toNumber(sel.quantity, 1);
    const amount = round2(quantity * toNumber(rate.rate));
    return {
      sourceRequestId: sel.sourceRequestId,
      customerId: sel.customerId,
      rate,
      quantity,
      amount,
    };
  });
}

// One-time, weight-based fee charged only when a lot is FIRST received —
// e.g. HANDLING_IN (ค่าบริการจัดการแรกเข้า), confirmed against a real
// customer's accounting spreadsheet to be weight x a flat per-kg rate,
// billed once in whichever period contains the lot's own receipt_date and
// never again afterward (a lot still in storage next month has no new
// receipt_date, so it simply isn't considered here again). Mirrors the
// one-time-fee branch of computeStorageInvoiceLines, but for a different
// service_type and independent of any STORAGE rate configuration.
//
// A deposit line with no matching rate for this serviceType is silently
// skipped (not surfaced as "unmatched") — unlike STORAGE, most customers
// legitimately have no HANDLING_IN (or other one-time service) rate
// configured at all, so treating its absence as an error would be noisy;
// only STORAGE's absence indicates a genuine billing gap.
export function computeHandlingFeeLines({ depositLines = [], rates = [], periodStart, periodEnd, serviceType = 'HANDLING_IN' }) {
  const results = [];

  for (const dl of depositLines) {
    const receiptDate = toDateOnly(dl.receipt_date);
    if (!receiptDate || receiptDate < periodStart || receiptDate > periodEnd) continue;

    const rate = resolveServiceRate(rates, {
      customerId: dl.customer_id,
      customerProductId: dl.customer_product_id,
      temperatureType: dl.temperature_type,
      serviceType,
      asOfDate: receiptDate,
    });
    if (!rate) continue;

    const receivedWeight = toNumber(dl.received_weight);
    const amount = round2(receivedWeight * toNumber(rate.rate));
    results.push({
      depositLineId: dl.id, customerId: dl.customer_id, rate,
      weight: receivedWeight, amount, receiptDate,
    });
  }

  return results;
}
