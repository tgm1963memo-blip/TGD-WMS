import { supabase } from './supabaseClient.js';

// Sticker print history (tgd_sticker_print_logs). Logging never blocks or
// fails a print: errors are swallowed, and screens showing the history
// listen for STICKER_PRINTED_EVENT to refresh.
//
// A module cache of rows per tracking code lets the print functions warn
// about a reprint synchronously (the print popup has to open inside the
// click, so there is no time to ask the server first). Screens that print
// load the rows ahead of time with loadStickerPrintRows().

export const STICKER_PRINTED_EVENT = 'tgd:sticker-printed';

const ROW_COLUMNS = 'id, printed_at, printed_by_email, sticker_format, tracking_code, pallet_index, pallet_total, location_code, boxes, source_path';
const rowsByCode = new Map();

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

// The same sticker = same format and FR code, plus the same pallet n/N (A5)
// or the same location (thermal, one per placed pallet).
export function stickerPrintKey(row) {
  if (!row?.tracking_code) return null;
  if (row.sticker_format === 'A5') return `A5|${row.tracking_code}|${row.pallet_index ?? ''}/${row.pallet_total ?? ''}`;
  return `THERMAL|${row.tracking_code}|${row.location_code ?? ''}`;
}

function cacheRows(rows) {
  for (const row of rows) {
    if (!row.tracking_code) continue;
    const list = rowsByCode.get(row.tracking_code) ?? [];
    list.push(row);
    rowsByCode.set(row.tracking_code, list);
  }
}

export function resetStickerPrintCache() {
  rowsByCode.clear();
}

// Stickers in `items` that were printed before, from the cache:
// [{ trackingCode, label, count, lastAt, lastBy }], one per distinct sticker.
export function findStickerReprints(format, items = []) {
  const seen = new Set();
  const out = [];
  for (const row of buildStickerPrintLogRows(format, items)) {
    const key = stickerPrintKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const earlier = (rowsByCode.get(row.tracking_code) ?? []).filter((r) => stickerPrintKey(r) === key);
    if (!earlier.length) continue;
    const last = earlier.reduce((a, b) => (String(b.printed_at) > String(a.printed_at) ? b : a));
    out.push({
      trackingCode: row.tracking_code,
      label: format === 'A5'
        ? `${row.tracking_code} พาเลท ${row.pallet_index ?? '-'}/${row.pallet_total ?? '-'}`
        : `${row.tracking_code}${row.location_code ? ` (${row.location_code})` : ''}`,
      count: earlier.length,
      lastAt: last.printed_at,
      lastBy: last.printed_by_email ?? null,
    });
  }
  return out;
}

// format: 'THERMAL' | 'A5'. items: the sticker items just sent to print.
export async function logStickerPrints(format, items = []) {
  if (!supabase || !items.length) return { error: null };
  try {
    const sourcePath = typeof window !== 'undefined' ? window.location?.pathname ?? null : null;
    const { data, error } = await supabase
      .from('tgd_sticker_print_logs')
      .insert(buildStickerPrintLogRows(format, items, sourcePath))
      .select(ROW_COLUMNS);
    if (!error) {
      cacheRows(data ?? []);
      if (typeof window !== 'undefined') {
        const codes = [...new Set(items.map((i) => i.trackingCode).filter(Boolean))];
        window.dispatchEvent(new CustomEvent(STICKER_PRINTED_EVENT, { detail: { trackingCodes: codes } }));
      }
    }
    return { error: error ?? null };
  } catch (error) {
    return { error };
  }
}

// Reads every print row for these FR codes and refreshes the cache.
export async function loadStickerPrintRows(trackingCodes = []) {
  const codes = [...new Set(trackingCodes.filter((c) => c && c !== '-'))];
  if (!supabase || !codes.length) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from('tgd_sticker_print_logs')
      .select(ROW_COLUMNS)
      .in('tracking_code', codes)
      .order('printed_at', { ascending: false })
      .limit(5000);
    if (error) return { data: [], error };
    for (const code of codes) rowsByCode.delete(code);
    cacheRows(data ?? []);
    return { data: data ?? [], error: null };
  } catch (error) {
    return { data: [], error };
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
  const { data, error } = await loadStickerPrintRows(trackingCodes);
  return { data: summarizeStickerPrintLogs(data), error };
}

// Report page. filters: { from, to (YYYY-MM-DD, inclusive), trackingCode,
// printedBy, format }. Marks each row `isReprint` when the same sticker was
// printed earlier within the result.
export async function listStickerPrintLogs({ from, to, trackingCode, printedBy, format } = {}) {
  if (!supabase) return { data: [], error: null, truncated: false };
  const LIMIT = 5000;
  try {
    let query = supabase.from('tgd_sticker_print_logs').select(ROW_COLUMNS).order('printed_at', { ascending: true }).limit(LIMIT);
    if (from) query = query.gte('printed_at', new Date(`${from}T00:00:00`).toISOString());
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      query = query.lt('printed_at', end.toISOString());
    }
    if (trackingCode?.trim()) query = query.ilike('tracking_code', `%${trackingCode.trim()}%`);
    if (printedBy?.trim()) query = query.ilike('printed_by_email', `%${printedBy.trim()}%`);
    if (format) query = query.eq('sticker_format', format);
    const { data, error } = await query;
    if (error) return { data: [], error, truncated: false };
    return { data: markReprints(data ?? []), error: null, truncated: (data ?? []).length >= LIMIT };
  } catch (error) {
    return { data: [], error, truncated: false };
  }
}

// rows sorted oldest first.
export function markReprints(rows = []) {
  const seen = new Set();
  return rows.map((row) => {
    const key = stickerPrintKey(row);
    const isReprint = key != null && seen.has(key);
    if (key) seen.add(key);
    return { ...row, isReprint };
  });
}
