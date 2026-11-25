import { useMemo, useState } from 'react';
import { saveLocationGroups, setLocationDisplayNames } from '../../services/warehouseLayoutService.js';
import { formatSideLabel, parseLocationCode } from '../../utils/locationCodeUtils.js';
import {
  ZONE_COLORS,
  applyRowNamePattern,
  findLocationGroup,
  validateLocationGroups,
  zoneColor,
} from '../../utils/locationGroupUtils.js';

// "Zone / ชื่อแถว" panel on a room card in Location setup:
// 1. Zones: named, coloured runs of consecutive rows on one side.
// 2. Bulk row names: apply a pattern such as "A{แถว}" to a zone or a side.
// Both are labels only; stock and location codes are untouched.

const inputStyle = {
  font: 'inherit', fontSize: 13, padding: '6px 8px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
  minHeight: 36, boxSizing: 'border-box',
};

function sidesIn(section) {
  const set = new Set((section.locations ?? []).map((l) => parseLocationCode(l.location_code)?.side).filter(Boolean));
  return ['L', 'R', 'A'].filter((s) => set.has(s));
}

function capacityOf(section, group) {
  return (section.locations ?? [])
    .filter((l) => findLocationGroup([group], parseLocationCode(l.location_code)))
    .reduce((sum, l) => sum + (Number(l.capacity) || 0), 0);
}

export function LocationZonesPanel({ section, onChanged }) {
  const sides = sidesIn(section);
  const [groups, setGroups] = useState(() => (section.groups ?? []).map((g) => ({ ...g })));
  const [savingZones, setSavingZones] = useState(false);
  const [zoneMsg, setZoneMsg] = useState('');
  const [zoneError, setZoneError] = useState('');

  const [target, setTarget] = useState('');
  const [pattern, setPattern] = useState('');
  const [naming, setNaming] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [nameError, setNameError] = useState('');

  function updateGroup(i, field, value) {
    setGroups((prev) => prev.map((g, idx) => (idx === i ? { ...g, [field]: value } : g)));
    setZoneMsg('');
  }

  function addGroup() {
    const used = new Set(groups.map((g) => g.color));
    const color = ZONE_COLORS.find((c) => !used.has(c.key))?.key ?? ZONE_COLORS[0].key;
    setGroups((prev) => [...prev, { name: '', color, side: sides[0] ?? 'L', row_from: 1, row_to: 1 }]);
  }

  async function saveZones() {
    const cleaned = groups.map((g) => ({ ...g, name: String(g.name ?? '').trim(), row_from: Number(g.row_from), row_to: Number(g.row_to) }));
    const problem = validateLocationGroups(cleaned);
    if (problem) { setZoneError(problem); return; }
    setSavingZones(true);
    setZoneError('');
    const { error } = await saveLocationGroups(section.id, cleaned);
    setSavingZones(false);
    if (error) { setZoneError(error.message ?? 'บันทึก Zone ไม่สำเร็จ'); return; }
    setZoneMsg('บันทึก Zone แล้ว');
    onChanged?.();
  }

  // Targets for bulk naming: each saved zone, then each whole side.
  const targets = useMemo(() => [
    ...(section.groups ?? []).map((g) => ({ key: `g:${g.id}`, label: `${g.name} (${g.side}${g.row_from}–${g.side}${g.row_to})`, match: (p) => findLocationGroup([g], p) })),
    ...sides.map((s) => ({ key: `s:${s}`, label: `ทั้ง${formatSideLabel(s)}`, match: (p) => p?.side === s })),
  ], [section.groups, sides]);

  const selectedTarget = targets.find((t) => t.key === target) ?? targets[0] ?? null;
  const targetRows = useMemo(() => {
    if (!selectedTarget) return [];
    return (section.locations ?? [])
      .map((l) => ({ loc: l, parsed: parseLocationCode(l.location_code) }))
      .filter(({ parsed }) => parsed && selectedTarget.match(parsed))
      .sort((a, b) => a.parsed.row - b.parsed.row);
  }, [section.locations, selectedTarget]);

  const previewNames = targetRows.map(({ parsed }) => applyRowNamePattern(pattern, parsed.row, parsed.side));
  const preview = previewNames.length
    ? (previewNames.length > 4 ? `${previewNames.slice(0, 3).join(', ')} … ${previewNames[previewNames.length - 1]}` : previewNames.join(', '))
    : '';

  async function applyNames(clear = false) {
    if (!targetRows.length) return;
    setNaming(true);
    setNameError('');
    setNameMsg('');
    const updates = targetRows.map(({ loc, parsed }) => ({ id: loc.id, displayName: clear ? '' : applyRowNamePattern(pattern, parsed.row, parsed.side) }));
    const { error } = await setLocationDisplayNames(updates);
    setNaming(false);
    if (error) { setNameError(error.message ?? 'ตั้งชื่อแถวไม่สำเร็จ'); return; }
    setNameMsg(clear ? `ล้างชื่อ ${updates.length} แถวแล้ว` : `ตั้งชื่อ ${updates.length} แถวแล้ว`);
    onChanged?.();
  }

  return (
    <div data-testid="location-zones-panel" style={{ background: 'var(--color-surface-muted)', borderTop: '1px solid var(--color-border)', padding: '16px 18px', display: 'grid', gap: 18 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Zone ในห้องนี้</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          กลุ่มแถวที่อยู่ติดกันในฝั่งเดียวกัน มีชื่อและสีของตัวเอง แถวที่ไม่อยู่ใน Zone ไหนก็ยังใช้งานได้ตามปกติ ลบ Zone ได้โดยไม่กระทบสินค้า
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 620 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>สี</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>ชื่อ Zone</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>ฝั่ง</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>แถว</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>ความจุ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '10px 8px', color: 'var(--color-text-muted)' }}>ยังไม่มี Zone</td></tr>
              ) : groups.map((g, i) => (
                <tr key={g.id ?? `new-${i}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <select aria-label="สี Zone" value={g.color} onChange={(e) => updateGroup(i, 'color', e.target.value)}
                      style={{ ...inputStyle, color: zoneColor(g.color).fg, fontWeight: 700 }}>
                      {ZONE_COLORS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input aria-label="ชื่อ Zone" value={g.name} onChange={(e) => updateGroup(i, 'name', e.target.value)}
                      placeholder="เช่น โซน A · OVO" data-testid={`zone-name-${i}`} style={{ ...inputStyle, width: '100%', minWidth: 160 }} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <select aria-label="ฝั่ง" value={g.side} onChange={(e) => updateGroup(i, 'side', e.target.value)} style={inputStyle}>
                      {sides.map((s) => <option key={s} value={s}>{formatSideLabel(s)}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    <input aria-label="จากแถว" type="number" min={0} value={g.row_from} onChange={(e) => updateGroup(i, 'row_from', e.target.value)} style={{ ...inputStyle, width: 64 }} />
                    <span style={{ margin: '0 6px' }}>–</span>
                    <input aria-label="ถึงแถว" type="number" min={0} value={g.row_to} onChange={(e) => updateGroup(i, 'row_to', e.target.value)} style={{ ...inputStyle, width: 64 }} />
                  </td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{capacityOf(section, g)} pallet</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGroups((prev) => prev.filter((_, idx) => idx !== i))}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {zoneError ? <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{zoneError}</div> : null}
        {zoneMsg ? <div style={{ color: 'var(--color-success-text)', fontSize: 13, marginTop: 8 }}>{zoneMsg}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addGroup} disabled={!sides.length}>+ เพิ่ม Zone</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveZones} disabled={savingZones} data-testid="zone-save">
            {savingZones ? 'กำลังบันทึก...' : 'บันทึก Zone'}
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>ตั้งชื่อหลายแถวพร้อมกัน</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          ใช้ {'{แถว}'} แทนเลขแถว เช่น "A{'{แถว}'}" จะได้ A21, A22, ... ชื่อนี้แสดงบนหน้าจอเท่านั้น รหัส Location เดิม (เช่น {section.code}-L-21) ไม่เปลี่ยน
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            ใช้กับ
            <select value={selectedTarget?.key ?? ''} onChange={(e) => setTarget(e.target.value)} style={{ ...inputStyle, minWidth: 220 }} data-testid="row-name-target">
              {targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            รูปแบบชื่อ
            <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="A{แถว}" style={{ ...inputStyle, width: 160 }} data-testid="row-name-pattern" />
          </label>
          <button type="button" className="btn btn-primary btn-sm" disabled={naming || !pattern.trim() || !targetRows.length} onClick={() => applyNames(false)} data-testid="row-name-apply">
            ตั้งชื่อ {targetRows.length} แถว
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={naming || !targetRows.length} onClick={() => applyNames(true)}>
            ล้างชื่อ
          </button>
        </div>
        {pattern.trim() && preview ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }} aria-live="polite">ตัวอย่าง: {preview}</div>
        ) : null}
        {nameError ? <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{nameError}</div> : null}
        {nameMsg ? <div style={{ color: 'var(--color-success-text)', fontSize: 13, marginTop: 8 }}>{nameMsg}</div> : null}
      </div>
    </div>
  );
}
