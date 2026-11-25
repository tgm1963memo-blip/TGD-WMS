import { formatRowLabel, parseLocationCode } from './locationCodeUtils.js';

// Zones inside a room (tgd_location_groups) and custom row names
// (tgd_locations.display_name). Both are display only: location_code stays
// the system identity used by sticker QR codes and movement history.

// Text colours meet 4.5:1 on their own tint and on white.
export const ZONE_COLORS = [
  { key: 'blue', label: 'น้ำเงิน', fg: '#1d4ed8', bg: '#e6efff' },
  { key: 'green', label: 'เขียว', fg: '#0b6e4c', bg: '#e2f5ec' },
  { key: 'purple', label: 'ม่วง', fg: '#7e22ce', bg: '#f3e8ff' },
  { key: 'orange', label: 'ส้ม', fg: '#9a4a00', bg: '#fff1dc' },
  { key: 'teal', label: 'เขียวน้ำทะเล', fg: '#0f6b63', bg: '#dff5f2' },
  { key: 'rose', label: 'ชมพู', fg: '#be123c', bg: '#ffe4ea' },
];

export function zoneColor(key) {
  return ZONE_COLORS.find((c) => c.key === key) ?? ZONE_COLORS[0];
}

// The zone a parsed location {side, row} falls in, within one room's groups.
export function findLocationGroup(groups = [], parsed) {
  if (!parsed) return null;
  return groups.find((g) => g.side === parsed.side && parsed.row >= Number(g.row_from) && parsed.row <= Number(g.row_to)) ?? null;
}

// "A30" when the row has a custom name, otherwise "แถว 30" / "ทางเดิน 30" / "รอจ่าย".
export function rowDisplayLabel(location) {
  const custom = String(location?.display_name ?? location?.displayName ?? '').trim();
  if (custom) return custom;
  const parsed = parseLocationCode(location?.location_code ?? location?.code);
  return parsed ? formatRowLabel(parsed.row, parsed.side) : (location?.location_code ?? location?.code ?? '-');
}

// For pickers: "A30 (แถว 30)" so staff still see the physical row number.
export function rowOptionLabel(row, side, displayName) {
  const base = formatRowLabel(row, side);
  const custom = String(displayName ?? '').trim();
  return custom ? `${custom} (${base})` : base;
}

// Returns a Thai error message, or '' when the zones are valid.
export function validateLocationGroups(groups = []) {
  for (const g of groups) {
    if (!String(g.name ?? '').trim()) return 'กรุณาตั้งชื่อ Zone ให้ครบ';
    const from = Number(g.row_from);
    const to = Number(g.row_to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
      return `แถวของ "${g.name}" ไม่ถูกต้อง (แถวเริ่มต้องไม่มากกว่าแถวสุดท้าย)`;
    }
  }
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const a = groups[i];
      const b = groups[j];
      if (a.side === b.side && Number(a.row_from) <= Number(b.row_to) && Number(b.row_from) <= Number(a.row_to)) {
        return `"${a.name}" กับ "${b.name}" มีแถวทับกัน`;
      }
    }
  }
  return '';
}

// Pattern like "A{แถว}" -> "A30". {แถว}/{row} = row number, {ฝั่ง}/{side} = L/R/A.
// A pattern without a row token gets the row number appended so names stay unique.
export function applyRowNamePattern(pattern, row, side) {
  const p = String(pattern ?? '').trim();
  if (!p) return '';
  const hasRow = /\{(แถว|row)\}/i.test(p);
  const name = p.replace(/\{(แถว|row)\}/gi, String(row)).replace(/\{(ฝั่ง|side)\}/gi, String(side ?? ''));
  return hasRow ? name : `${name}${row}`;
}

// Zone names for any text holding location codes: a row code (41-L-30), a
// pallet code (41-L-30-05), a picker label ("41 · 41-L-30") or several
// pallets joined with commas. groups need zone_code (see getLocationGroups).
// Returns unique zone names joined with ", ", or '' when none match.
const LOCATION_CODE_IN_TEXT = /([A-Za-z0-9]+)-([LRA])-(\d+)/gi;

export function zoneNamesForLocationText(groups = [], text = '') {
  if (!groups.length || !text) return '';
  const names = [];
  for (const m of String(text).matchAll(LOCATION_CODE_IN_TEXT)) {
    const room = m[1];
    const parsed = { side: m[2].toUpperCase(), row: Number(m[3]) };
    const group = findLocationGroup(groups.filter((g) => String(g.zone_code) === String(room)), parsed);
    if (group && !names.includes(group.name)) names.push(group.name);
  }
  return names.join(', ');
}
