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
