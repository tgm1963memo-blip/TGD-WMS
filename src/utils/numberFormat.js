// Shared numeric rounding/formatting so every calculation result — weights,
// rates, invoice amounts — is rounded to 2dp at computation time (avoiding
// float drift like 12.339999999999998) and always displayed with exactly 2
// decimals (never 0, never 3+), instead of each file inventing its own
// toLocaleString()/toFixed() call with a different (or missing) precision.

export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function formatFixed2(value, { emptyDisplay = '-' } = {}) {
  if (value == null || value === '') return emptyDisplay;
  const n = Number(value);
  if (!Number.isFinite(n)) return emptyDisplay;
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
