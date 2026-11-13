export const TEMPERATURE_TYPE_LABELS = {
  CHILLED: 'Chilled — แช่เย็น',
  FROZEN: 'Frozen — แช่แข็ง',
  FREEZE: 'Freeze — ฝากฟรีส',
  FREEZE_FROZEN: 'Freeze&Frozen — ฟรีสและฝากแช่',
};

export const TEMPERATURE_TYPE_SHORT_LABELS = {
  CHILLED: 'แช่เย็น',
  FROZEN: 'แช่แข็ง',
  FREEZE: 'ฝากฟรีส',
  FREEZE_FROZEN: 'ฟรีสและฝากแช่',
};

export function getTemperatureTypeLabel(value) {
  if (!value) return '-';
  return TEMPERATURE_TYPE_LABELS[value] ?? value;
}

export function getTemperatureTypeShortLabel(value) {
  if (!value) return '-';
  return TEMPERATURE_TYPE_SHORT_LABELS[value] ?? value;
}

// Stock-balance pages show what is physically in the room, not the service
// that was billed on the way in: FREEZE and Freeze&Frozen lots were frozen
// on receipt and sit in storage as frozen goods, so they are presented as
// FROZEN there (badge, grouping, temperature filter, Excel). Billing,
// deposit and withdrawal documents keep the original value.
const STOCK_BALANCE_FROZEN_TYPES = new Set(['FREEZE', 'FREEZE_FROZEN']);

export function toStockBalanceTemperatureType(value) {
  return STOCK_BALANCE_FROZEN_TYPES.has(value) ? 'FROZEN' : value;
}
