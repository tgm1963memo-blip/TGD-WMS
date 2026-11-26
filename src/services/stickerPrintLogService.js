import { supabase } from './supabaseClient.js';

// Sticker print history (tgd_sticker_print_logs). Logging never blocks or
// fails a print: errors are swallowed, and screens showing the history
// listen for STICKER_PRINTED_EVENT to refresh.

export const STICKER_PRINTED_EVENT = 'tgd:sticker-printed';

function toNumberOrNull(value) {
  const n = Number(value);
  return value == null || value === '' || !Number.isFinite(n) ? null : n;
}

export function buildStickerPrintLogRows(format, items = [], sourcePath = null) {
  return items.map((item) => ({
    sticker_format: format,
    tracking_code: item.trackingCode && item.trackingCode !== '-' ? item.trackingCode : null,
    pallet_index: toNumberOrNull(item.palletIndex),
    pallet_total: toNumberOrNull(item.palletTotal),
    location_code: item.locationCode && item.locationCode !== '-' ? item.locationCode : null,
    boxes: toNumberOrNull(item.boxes),
    source_path: sourcePath,
  }));
}

// format: 'THERMAL' | 'A5'. items: the sticker items just sent to print.
export async function logStickerPrints(format, items = []) {
  if (!supabase || !items.length) return { error: null };
  try {
    const sourcePath = typeof window !== 'undefined' ? window.location?.pathname ?? null : null;
    const { error } = await supabase.from('tgd_sticker_print_logs').insert(buildStickerPrintLogRows(format, items, sourcePath));
    if (!error && typeof window !== 'undefined') {
      const codes = [...new Set(items.map((i) => i.trackingCode).filter(Boolean))];
      window.dispatchEvent(new CustomEvent(STICKER_PRINTED_EVENT, { detail: { trackingCodes: codes } }));
    }
    return { error: error ?? null };
  } catch (error) {
    return { error };
  }
}

// Summary per tracking code: { count, lastAt, lastBy, lastFormat }.
export function summarizeStickerPrintLogs(rows = []) {
  const byCode = new Map();
  for (const row of rows) {
    if (!row.tracking_code) continue;
    const prev = byCode.get(row.tracking_code);
    if (!prev) {
      byCode.set(row.tracking_code, { count: 1, lastAt: row.printed_at, lastBy: row.printed_by_email ?? null, lastFormat: row.sticker_format });
    } else {
      prev.count += 1;
      if (String(row.printed_at) > String(prev.lastAt)) {
        prev.lastAt = row.printed_at;
        prev.lastBy = row.printed_by_email ?? null;
        prev.lastFormat = row.sticker_format;
      }
    }
  }
  return byCode;
}

export async function getStickerPrintSummary(trackingCodes = []) {
  const codes = [...new Set(trackingCodes.filter(Boolean))];
  if (!supabase || !codes.length) return { data: new Map(), error: null };
  try {
    const { data, error } = await supabase
      .from('tgd_sticker_print_logs')
      .select('tracking_code, printed_at, printed_by_email, sticker_format')
      .in('tracking_code', codes)
      .order('printed_at', { ascending: false })
      .limit(2000);
    if (error) return { data: new Map(), error };
    return { data: summarizeStickerPrintLogs(data ?? []), error: null };
  } catch (error) {
    return { data: new Map(), error };
  }
}
