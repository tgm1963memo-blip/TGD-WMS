import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { listInventoryLocations } from '../../services/inventoryLocationService.js';
import { buildPalletStickerItems, printA5Stickers, suggestPalletCount } from '../../utils/stickerPrint.jsx';

// Shared "พิมพ์ A5" flow for every screen that prints pallet stickers.
//
// entries: [{ lineId, baseItem, boxesPerPallet }]
//   baseItem: line-level sticker fields incl. trackingCode, lotBoxes, lotWeight
//   boxesPerPallet: the product's usual boxes per pallet (may be null)
//
// Lines that already have pallets placed print one sheet per real pallet.
// For lines with none yet, a dialog asks how many pallets (pre-filled from
// boxes / boxesPerPallet) before printing.

function splitPreview(lotBoxes, count, perPallet) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  const per = Math.max(1, Math.floor(Number(perPallet) || 1));
  let left = Number(lotBoxes) || 0;
  const parts = [];
  for (let i = 1; i <= n; i += 1) {
    const q = i < n ? Math.min(per, Math.max(0, left)) : Math.max(0, left);
    left -= q;
    parts.push(`${i}/${n} = ${q}`);
  }
  return parts.join(', ');
}

export function useA5StickerPrint() {
  const [pending, setPending] = useState(null); // { ready: items[], manual: [{ entry, count, boxesPerPallet }], note }
  const [busy, setBusy] = useState(false);

  async function requestPrint(entries = []) {
    const valid = entries.filter((e) => e?.baseItem);
    if (!valid.length || busy) return;
    setBusy(true);
    const lineIds = valid.map((e) => e.lineId).filter(Boolean);
    const { data: allocationsByLine, error } = lineIds.length
      ? await listInventoryLocations(lineIds)
      : { data: new Map(), error: null };
    setBusy(false);

    const ready = [];
    const manual = [];
    for (const entry of valid) {
      const active = (allocationsByLine?.get(entry.lineId) ?? []).filter((a) => a.active);
      if (active.length > 0) {
        ready.push(...buildPalletStickerItems(entry.baseItem, active));
      } else {
        const lotBoxes = Number(entry.baseItem.lotBoxes) || 0;
        const count = suggestPalletCount(lotBoxes, entry.boxesPerPallet);
        const boxesPerPallet = Number(entry.boxesPerPallet) || Math.max(1, Math.ceil(lotBoxes / count));
        manual.push({ entry, count, boxesPerPallet });
      }
    }

    if (manual.length === 0) {
      printA5Stickers(ready);
      return;
    }
    setPending({
      ready,
      manual,
      note: error ? 'อ่านข้อมูลพาเลทไม่สำเร็จ ระบบจึงให้กรอกจำนวนพาเลทเองทุกรายการ' : '',
    });
  }

  function updateManual(index, field, value) {
    setPending((p) => ({
      ...p,
      manual: p.manual.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    }));
  }

  function confirmPrint() {
    if (!pending) return;
    const items = [
      ...pending.ready,
      ...pending.manual.flatMap((m) => buildPalletStickerItems(m.entry.baseItem, [], { count: m.count, boxesPerPallet: m.boxesPerPallet })),
    ];
    setPending(null);
    printA5Stickers(items);
  }

  const totalSheets = pending
    ? pending.ready.length + pending.manual.reduce((sum, m) => sum + Math.max(1, Math.floor(Number(m.count) || 1)), 0)
    : 0;

  const dialog = pending ? (
    <Modal isOpen onClose={() => setPending(null)} title="พิมพ์สติ๊กเกอร์ A5" size="md">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          รายการด้านล่างยังไม่ได้ระบุ Location จึงยังไม่รู้จำนวนพาเลทจริง กรอกจำนวนพาเลทและกล่องต่อพาเลท
          ระบบจะพิมพ์ 1 แผ่นต่อพาเลท (แผ่นสุดท้ายรับเศษ) และพิมพ์ช่อง Location เป็น "-"
          {pending.ready.length > 0 ? ` · รายการที่มี Location แล้วจะพิมพ์ตามพาเลทจริง ${pending.ready.length} แผ่น` : ''}
        </div>
        {pending.note && (
          <div style={{ fontSize: 13, color: 'var(--color-warning)', background: 'var(--color-warning-soft)', borderRadius: 8, padding: '8px 12px' }}>{pending.note}</div>
        )}
        {pending.manual.map((m, i) => (
          <div key={m.entry.lineId ?? i} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>
              {m.entry.baseItem.trackingCode ?? '-'}
              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                {m.entry.baseItem.productName ?? ''} · รวม {Number(m.entry.baseItem.lotBoxes) || 0} กล่อง
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                จำนวนพาเลททั้งหมด
                <input
                  className="form-control" type="number" min={1} inputMode="numeric"
                  value={m.count}
                  onChange={(e) => updateManual(i, 'count', e.target.value)}
                  data-testid={`a5-pallet-count-${i}`}
                  style={{ width: 140 }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                กล่องต่อพาเลท
                <input
                  className="form-control" type="number" min={1} inputMode="numeric"
                  value={m.boxesPerPallet}
                  onChange={(e) => updateManual(i, 'boxesPerPallet', e.target.value)}
                  data-testid={`a5-boxes-per-pallet-${i}`}
                  style={{ width: 140 }}
                />
              </label>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }} aria-live="polite">
              แบ่งเป็น: {splitPreview(m.entry.baseItem.lotBoxes, m.count, m.boxesPerPallet)} กล่อง
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>ยกเลิก</button>
          <button type="button" className="btn btn-primary" onClick={confirmPrint} data-testid="a5-print-confirm">
            พิมพ์ {totalSheets} แผ่น
          </button>
        </div>
      </div>
    </Modal>
  ) : null;

  return { requestPrint, dialog, busy };
}
