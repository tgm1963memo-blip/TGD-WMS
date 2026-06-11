import { resolveQuantity } from './stockFieldAliases.js';

export const BILLING_STATUS_FOUNDATION = Object.freeze({
  UNREVIEWED: 'UNREVIEWED',
  READY_FOR_PREVIEW: 'READY_FOR_PREVIEW',
  EXCLUDED: 'EXCLUDED',
  NEEDS_WEIGHT_REVIEW: 'NEEDS_WEIGHT_REVIEW',
});

export function resolveWeightPerUnit(row = {}, product = {}) {
  const explicit = row.weight_per_unit ?? product.weight_per_unit ?? product.weight_kg ?? null;
  const parsed = Number(explicit);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolvePalletWeight(row = {}, pallet = {}) {
  const explicit = row.pallet_weight ?? pallet.pallet_weight ?? pallet.weight ?? null;
  const parsed = Number(explicit);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveMovementWeights(row = {}, context = {}) {
  const qty = resolveQuantity(row);
  const weightPerUnit = resolveWeightPerUnit(row, context.product);
  const palletWeight = resolvePalletWeight(row, context.pallet);

  const explicitGross = Number(row.gross_weight ?? row.weight ?? 0);
  const explicitNet = Number(row.net_weight ?? 0);
  const explicitChargeable = Number(row.chargeable_weight ?? 0);

  let grossWeight = Number.isFinite(explicitGross) && explicitGross > 0 ? explicitGross : 0;
  let netWeight = Number.isFinite(explicitNet) && explicitNet > 0 ? explicitNet : 0;

  if (grossWeight <= 0 && palletWeight) {
    grossWeight = palletWeight;
  }

  if (grossWeight <= 0 && weightPerUnit && qty > 0) {
    grossWeight = qty * weightPerUnit;
  }

  if (netWeight <= 0 && grossWeight > 0) {
    netWeight = grossWeight;
  }

  let chargeableWeight = Number.isFinite(explicitChargeable) && explicitChargeable > 0
    ? explicitChargeable
    : Math.max(grossWeight, netWeight, 0);

  const billingStatus = chargeableWeight > 0
    ? BILLING_STATUS_FOUNDATION.READY_FOR_PREVIEW
    : BILLING_STATUS_FOUNDATION.NEEDS_WEIGHT_REVIEW;

  return {
    net_weight: netWeight,
    gross_weight: grossWeight,
    chargeable_weight: chargeableWeight,
    weight_per_unit: weightPerUnit,
    pallet_weight: palletWeight,
    billing_status: row.billing_status ?? billingStatus,
  };
}
