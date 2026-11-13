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
// that was billed on the way in: a Freeze&Frozen lot was frozen on receipt
// and sits in storage as frozen goods, so it is presented as FROZEN there
// (badge, grouping, temperature filter, Excel). Billing, deposit and
// withdrawal documents keep the original FREEZE_FROZEN value.
export function toStockBalanceTemperatureType(value) {
  return value === 'FREEZE_FROZEN' ? 'FROZEN' : value;
}
