import { useEffect, useMemo, useState } from 'react';
import { getLocationGroups } from '../../services/locationGroupService.js';
import { zoneColor } from '../../utils/locationGroupUtils.js';

// "Pick a zone, then a row" for every location picker (handheld receiving /
// location update, deposit detail, stock count).
//
// useZonePicker(room) gives the zones of the chosen room and the active one.
// narrowSides / narrowRows apply that zone to the picker's own side/row lists,
// so a picker with no zone selected (or a room without zones) works as before.

// Shared by every picker on the page; refreshed after 2 minutes so zones an
// admin just created show up without reloading the app.
const CACHE_MS = 2 * 60 * 1000;
let cache = null;
let cacheAt = 0;

export function useZonePicker(room) {
  const [groups, setGroups] = useState(cache ?? []);
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    if (cache && Date.now() - cacheAt < CACHE_MS) return undefined;
    let current = true;
    getLocationGroups().then(({ data }) => {
      cache = data ?? [];
      cacheAt = Date.now();
      if (current) setGroups(cache);
    });
    return () => { current = false; };
  }, []);

  // A zone belongs to one room; switching rooms clears the choice.
  useEffect(() => { setGroupId(''); }, [room]);

  const roomGroups = useMemo(
    () => groups.filter((g) => room && String(g.zone_code) === String(room)),
    [groups, room],
  );
  const activeGroup = roomGroups.find((g) => g.id === groupId) ?? null;

  return { roomGroups, activeGroup, groupId, setGroupId };
}

export function narrowSides(sides, activeGroup) {
  if (!activeGroup) return sides;
  return sides.filter((s) => s === activeGroup.side);
}

export function narrowRows(rows, side, activeGroup) {
  if (!activeGroup || side !== activeGroup.side) return rows;
  return rows.filter((r) => Number(r) >= Number(activeGroup.row_from) && Number(r) <= Number(activeGroup.row_to));
}

// Test hook: reset the shared zone cache between tests.
export function resetZonePickerCache() {
  cache = null;
  cacheAt = 0;
}

// Chips for the room's zones plus "ทุกแถว". Hidden when the room has none.
// onPick(group|null) lets the picker preset the side and clear the row.
export function ZoneChips({ roomGroups, groupId, onPick, size = 'md' }) {
  if (!roomGroups.length) return null;
  const pad = size === 'lg' ? '10px 14px' : '6px 12px';
  const font = size === 'lg' ? 14 : 13;
  const minHeight = size === 'lg' ? 44 : 34;
  const chip = (active, fg, bg) => ({
    padding: pad, fontSize: font, fontWeight: 700, minHeight, borderRadius: 999, cursor: 'pointer',
    border: `1.5px solid ${active ? fg : 'var(--color-border)'}`,
    background: active ? bg : 'var(--color-surface)',
    color: active ? fg : 'var(--color-text)',
    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  });
  return (
    <div role="group" aria-label="เลือก Zone" data-testid="zone-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
      <button type="button" aria-pressed={!groupId} onClick={() => onPick(null)} style={chip(!groupId, 'var(--color-text)', 'var(--color-surface-muted)')}>
        ทุกแถว
      </button>
      {roomGroups.map((g) => {
        const c = zoneColor(g.color);
        const active = g.id === groupId;
        return (
          <button
            key={g.id}
            type="button"
            aria-pressed={active}
            title={`${g.name} · ${g.side}${g.row_from}–${g.side}${g.row_to}`}
            onClick={() => onPick(g)}
            data-testid={`zone-chip-${g.id}`}
            style={chip(active, c.fg, c.bg)}
          >
            <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c.fg, marginRight: 6, verticalAlign: '-1px' }} />
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
