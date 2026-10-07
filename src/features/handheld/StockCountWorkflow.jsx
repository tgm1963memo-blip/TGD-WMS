import { useEffect, useMemo, useRef, useState } from 'react';
import { C, TopBar, triggerSuccessFeedback, useCameraScanner } from './handheldUi.jsx';
import { useHandheldAuth } from './HandheldContext.jsx';
import { getActiveLocations } from '../../services/warehouseLayoutService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { resolveCountPhotoUrls } from '../../services/customerDocumentAttachmentService.js';
import {
  getLocationCountExpected,
  getOpenLocationCountSession,
  isLocationCountVariance,
  listLocationCountLines,
  recordLocationCountRow,
  setLocationCountStatus,
  startLocationCount,
} from '../../services/locationCountService.js';
import { buildPalletCode, formatRowLabel, parseLocationCode } from '../../utils/locationCodeUtils.js';
import { formatFixed2 } from '../../utils/numberFormat.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

// Per-pallet choice while counting a row.
//   match   -> counted = system quantity
//   diff    -> counted = what staff typed
//   missing -> counted = 0
export function buildCountResults(pallets, entries, extras) {
  const results = pallets.map((p) => {
    const entry = entries[p.allocation_id] ?? {};
    if (entry.mode === 'match') {
      return { allocation_id: p.allocation_id, counted_boxes: Number(p.expected_boxes ?? 0), counted_weight: Number(p.expected_weight ?? 0), note: entry.note || null };
    }
    if (entry.mode === 'diff') {
      return { allocation_id: p.allocation_id, counted_boxes: Number(entry.boxes || 0), counted_weight: Number(entry.weight || 0), note: entry.note || null };
    }
    return { allocation_id: p.allocation_id, counted_boxes: 0, counted_weight: 0, note: entry.note || null };
  });
  extras.forEach((x) => {
    results.push({
      tracking_code: x.trackingCode || null,
      product_name: x.productName || null,
      counted_boxes: Number(x.boxes || 0),
      counted_weight: Number(x.weight || 0),
      note: x.note || null,
    });
  });
  return results;
}

function draftKey(sessionId, locationId) {
  return `tgd_stock_count_draft_${sessionId}_${locationId}`;
}
function readDraft(sessionId, locationId) {
  try {
    const raw = localStorage.getItem(draftKey(sessionId, locationId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeDraft(sessionId, locationId, draft) {
  try { localStorage.setItem(draftKey(sessionId, locationId), JSON.stringify(draft)); } catch { /* storage unavailable */ }
}
function clearDraft(sessionId, locationId) {
  try { localStorage.removeItem(draftKey(sessionId, locationId)); } catch { /* storage unavailable */ }
}

const qtyInputStyle = {
  width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1.5px solid ${C.border}`,
  borderRadius: 12, padding: '12px 10px', fontSize: 20, fontWeight: 800, textAlign: 'center', outline: 'none',
};
const selectStyle = {
  width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1.5px solid ${C.border}`, borderRadius: 12,
  padding: '10px 8px', fontSize: 15, fontWeight: 700, color: C.text, outline: 'none', minHeight: 48,
};

function rowStatus(lines) {
  if (!lines?.length) return 'COUNTED_EMPTY';
  return lines.some(isLocationCountVariance) ? 'VARIANCE' : 'MATCH';
}

function PalletCard({ pallet, locationCode, photo, entry, onChange, highlighted, onZoom, cardRef }) {
  const mode = entry?.mode;
  const kgPerBox = Number(pallet.kg_per_box || 0);
  const setMode = (next) => {
    if (next === 'diff') {
      onChange({ ...entry, mode: 'diff', boxes: entry?.boxes ?? String(pallet.expected_boxes ?? ''), weight: entry?.weight ?? String(pallet.expected_weight ?? '') });
    } else {
      onChange({ ...entry, mode: next });
    }
  };
  const btn = (key, label, color) => ({
    flex: 1, minHeight: 52, borderRadius: 14, fontSize: 15, fontWeight: 900, cursor: 'pointer',
    border: `2px solid ${mode === key ? color : C.border}`,
    background: mode === key ? color : C.surface,
    color: mode === key ? '#fff' : C.text,
  });

  return (
    <div ref={cardRef} data-testid="stock-count-pallet-card"
      style={{
        background: C.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 16,
        border: `2px solid ${highlighted ? C.gold : mode ? (mode === 'match' ? C.greenBorder : '#fcd34d') : C.border}`,
        boxShadow: highlighted ? '0 0 0 4px rgba(212,175,55,0.35)' : C.shadow,
      }}>
      <button type="button" onClick={() => photo && onZoom(photo.url)} disabled={!photo}
        style={{ display: 'block', width: '100%', height: 200, padding: 0, border: 'none', background: C.borderLight, cursor: photo ? 'zoom-in' : 'default', position: 'relative' }}>
        {photo ? (
          <img src={photo.url} alt={pallet.product_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#fff' }} />
        ) : (
          <div style={{ color: C.muted, fontSize: 14, fontWeight: 700 }}>📦 ยังไม่มีรูปสินค้า</div>
        )}
        {photo && (
          <span style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(9,17,28,0.75)', color: '#fff', borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
            {photo.source === 'PACKAGING' ? 'รูป Packaging' : 'รูปตอนรับเข้า'}
          </span>
        )}
        <span style={{ position: 'absolute', right: 10, top: 10, background: C.primary, color: C.gold, borderRadius: 10, padding: '4px 10px', fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>
          {buildPalletCode(locationCode, pallet.pallet_no)}
        </span>
      </button>

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text, overflowWrap: 'anywhere' }}>{pallet.product_name ?? '-'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, fontSize: 12, fontWeight: 700, color: C.textSec }}>
          {pallet.customer_product_code && <span style={{ background: C.blueLight, borderRadius: 8, padding: '3px 8px' }}>รหัส {pallet.customer_product_code}</span>}
          {pallet.lot_no && <span style={{ background: C.blueLight, borderRadius: 8, padding: '3px 8px' }}>LOT {pallet.lot_no}</span>}
          {pallet.tracking_code && <span style={{ background: C.blueLight, borderRadius: 8, padding: '3px 8px', fontFamily: 'monospace' }}>{pallet.tracking_code}</span>}
        </div>
        {pallet.customer_name && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{pallet.customer_name}</div>}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '12px 0', padding: '10px 12px', background: C.inputBg, borderRadius: 12 }}>
          <span style={{ fontSize: 12, color: C.textSec, fontWeight: 700 }}>ในระบบ</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: C.text }}>{pallet.expected_boxes != null ? Number(pallet.expected_boxes).toLocaleString() : '-'}</span>
          <span style={{ fontSize: 13, color: C.textSec, fontWeight: 700 }}>กล่อง</span>
          <span style={{ fontSize: 13, color: C.muted, marginLeft: 'auto' }}>{formatFixed2(pallet.expected_weight ?? 0)} กก.</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btn('match', C.green)} onClick={() => setMode('match')}>✓ ตรง</button>
          <button type="button" style={btn('diff', C.amber)} onClick={() => setMode('diff')}>✎ ไม่ตรง</button>
          <button type="button" style={btn('missing', C.red)} onClick={() => setMode('missing')}>✕ ไม่พบ</button>
        </div>

        {mode === 'diff' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <label>
              <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>นับได้ (กล่อง)</div>
              <input type="number" inputMode="numeric" min="0" value={entry?.boxes ?? ''} style={qtyInputStyle}
                onChange={(e) => {
                  const boxes = e.target.value;
                  const weight = kgPerBox > 0 && boxes !== '' ? String(Math.round(Number(boxes) * kgPerBox * 100) / 100) : entry?.weight ?? '';
                  onChange({ ...entry, boxes, weight });
                }} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>น้ำหนัก (กก.)</div>
              <input type="number" inputMode="decimal" min="0" value={entry?.weight ?? ''} style={qtyInputStyle}
                onChange={(e) => onChange({ ...entry, weight: e.target.value })} />
            </label>
          </div>
        )}

        {mode && mode !== 'match' && (
          <input type="text" value={entry?.note ?? ''} placeholder="หมายเหตุ (ถ้ามี) เช่น กล่องแตก, อยู่ผิดแถว"
            onChange={(e) => onChange({ ...entry, note: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 14, outline: 'none' }} />
        )}
      </div>
    </div>
  );
}

export function StockCountWorkflow({ onBack }) {
  const { activeProfile } = useHandheldAuth();
  const isOnline = useOnlineStatus();
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [countedLines, setCountedLines] = useState([]);
  const [products, setProducts] = useState(null);
  const [zone, setZone] = useState('');
  const [side, setSide] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [currentLocation, setCurrentLocation] = useState(null);
  const [pallets, setPallets] = useState([]);
  const [palletsLoading, setPalletsLoading] = useState(false);
  const [photos, setPhotos] = useState({});
  const [entries, setEntries] = useState({});
  const [extras, setExtras] = useState([]);
  const [extraForm, setExtraForm] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [zoomUrl, setZoomUrl] = useState(null);
  const cardRefs = useRef({});
  const photoCache = useRef({});

  const parsedLocations = useMemo(() => locations
    .map((l) => ({ ...l, parsed: parseLocationCode(l.code) }))
    .filter((l) => l.parsed), [locations]);
  const zones = useMemo(() => [...new Set(parsedLocations.map((l) => l.parsed.room))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true })), [parsedLocations]);
  const sides = useMemo(() => [...new Set(parsedLocations.filter((l) => l.parsed.room === zone).map((l) => l.parsed.side))].sort(), [parsedLocations, zone]);
  const rowsInSide = useMemo(() => parsedLocations
    .filter((l) => l.parsed.room === zone && l.parsed.side === side)
    .sort((a, b) => a.parsed.row - b.parsed.row), [parsedLocations, zone, side]);
  const linesByLocation = useMemo(() => {
    const map = new Map();
    countedLines.forEach((l) => {
      if (!map.has(l.location_id)) map.set(l.location_id, []);
      map.get(l.location_id).push(l);
    });
    return map;
  }, [countedLines]);
  const countedLocationIds = useMemo(() => new Set(countedLines.map((l) => l.location_id)), [countedLines]);
  // Rows saved this visit -- covers a row saved with nothing on it, which
  // leaves no count lines behind.
  const [savedLocationIds, setSavedLocationIds] = useState(new Set());
  const isCounted = (id) => countedLocationIds.has(id) || savedLocationIds.has(id);
  const countedTotal = parsedLocations.filter((l) => isCounted(l.id)).length;

  async function refreshCountedLines(sessionId) {
    const result = await listLocationCountLines(sessionId);
    if (!result.error) setCountedLines(result.data ?? []);
  }

  useEffect(() => {
    getActiveLocations().then(({ data }) => setLocations(data ?? []));
    getOpenLocationCountSession().then(({ data, error: e }) => {
      setSession(data ?? null);
      setSessionLoading(false);
      if (e) setError(e.message ?? 'โหลดรอบนับไม่สำเร็จ');
      if (data?.id) refreshCountedLines(data.id);
    });
  }, []);

  useEffect(() => {
    if (!zone && zones.length === 1) setZone(zones[0]);
  }, [zones, zone]);
  useEffect(() => {
    if (zone && !side && sides.length === 1) setSide(sides[0]);
  }, [zone, sides, side]);

  // Persist the in-progress row so a dropped signal / closed tab doesn't lose it.
  useEffect(() => {
    if (!session?.id || !currentLocation?.id) return;
    writeDraft(session.id, currentLocation.id, { entries, extras });
  }, [entries, extras, session?.id, currentLocation?.id]);

  const { trigger: openScanner, el: scannerEl } = useCameraScanner((value) => handleScan(value));

  async function handleStart() {
    setBusy(true); setError('');
    const { data, error: e } = await startLocationCount(activeProfile?.id ?? null);
    setBusy(false);
    if (e) { setError(e.message ?? 'เริ่มรอบนับไม่สำเร็จ'); return; }
    setSession(data);
    refreshCountedLines(data.id);
  }

  async function ensureProducts() {
    if (products) return products;
    const { data } = await listCustomerProducts({});
    const loaded = data ?? [];
    setProducts(loaded);
    return loaded;
  }

  async function openLocation(location) {
    setCurrentLocation(location);
    setPallets([]); setPhotos({}); setError(''); setMessage(''); setHighlightId(null); setExtraForm(null);
    const draft = session?.id ? readDraft(session.id, location.id) : null;
    const saved = linesByLocation.get(location.id) ?? [];
    // Re-opening a saved row shows what was recorded, unless a newer draft exists.
    const savedEntries = {};
    saved.filter((l) => l.allocation_id).forEach((l) => {
      savedEntries[l.allocation_id] = l.result === 'MATCH'
        ? { mode: 'match', note: l.note ?? '' }
        : l.result === 'MISSING'
          ? { mode: 'missing', note: l.note ?? '' }
          : { mode: 'diff', boxes: String(l.counted_boxes ?? ''), weight: String(l.counted_weight ?? ''), note: l.note ?? '' };
    });
    const savedExtras = saved.filter((l) => !l.allocation_id).map((l, i) => ({
      key: `saved-${i}`, trackingCode: l.tracking_code ?? '', productName: l.product_name ?? '',
      boxes: String(l.counted_boxes ?? ''), weight: String(l.counted_weight ?? ''), note: l.note ?? '',
    }));
    setEntries(draft?.entries ?? savedEntries);
    setExtras(draft?.extras ?? savedExtras);

    setPalletsLoading(true);
    const { data, error: e } = await getLocationCountExpected(location.id);
    setPalletsLoading(false);
    if (e) { setError(e.message ?? 'โหลดรายการพาเลทไม่สำเร็จ'); return; }
    setPallets(data);

    const missingPhotoItems = data.filter((p) => p.deposit_line_id && !(p.deposit_line_id in photoCache.current));
    if (missingPhotoItems.length) {
      const catalog = await ensureProducts();
      const { data: resolved } = await resolveCountPhotoUrls(missingPhotoItems, catalog);
      missingPhotoItems.forEach((p) => { photoCache.current[p.deposit_line_id] = resolved?.[p.deposit_line_id] ?? null; });
    }
    const next = {};
    data.forEach((p) => { if (photoCache.current[p.deposit_line_id]) next[p.deposit_line_id] = photoCache.current[p.deposit_line_id]; });
    setPhotos(next);
  }

  function closeLocation() {
    setCurrentLocation(null);
    setPallets([]);
    setEntries({});
    setExtras([]);
  }

  function handleScan(value) {
    const code = String(value ?? '').trim().toLowerCase();
    if (!code) return;
    const match = pallets.find((p) => (p.tracking_code ?? '').toLowerCase() === code);
    if (match) {
      triggerSuccessFeedback();
      setHighlightId(match.allocation_id);
      cardRefs.current[match.allocation_id]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      if (!entries[match.allocation_id]?.mode) {
        setEntries((prev) => ({ ...prev, [match.allocation_id]: { ...prev[match.allocation_id], mode: 'match' } }));
      }
      return;
    }
    setExtraForm({ trackingCode: String(value).trim(), productName: '', boxes: '', weight: '', note: '' });
    setMessage(`ไม่พบ ${String(value).trim()} ในแถวนี้ — บันทึกเป็นพาเลทที่ไม่อยู่ในระบบได้ด้านล่าง`);
  }

  const doneCount = pallets.filter((p) => entries[p.allocation_id]?.mode).length;
  const allDone = doneCount === pallets.length;

  async function handleSaveRow() {
    if (!allDone) {
      const firstPending = pallets.find((p) => !entries[p.allocation_id]?.mode);
      if (firstPending) {
        setHighlightId(firstPending.allocation_id);
        cardRefs.current[firstPending.allocation_id]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
      setError(`ยังไม่ได้นับอีก ${pallets.length - doneCount} พาเลท`);
      return;
    }
    if (!isOnline) { setError('ออฟไลน์อยู่ — ข้อมูลที่กรอกถูกเก็บไว้ในเครื่องแล้ว กรุณาบันทึกอีกครั้งเมื่อมีสัญญาณ'); return; }
    setBusy(true); setError('');
    const results = buildCountResults(pallets, entries, extras);
    const { error: e } = await recordLocationCountRow(session.id, currentLocation.id, results, activeProfile?.id ?? null);
    setBusy(false);
    if (e) { setError(e.message ?? 'บันทึกไม่สำเร็จ'); return; }
    triggerSuccessFeedback();
    clearDraft(session.id, currentLocation.id);
    setSavedLocationIds((prev) => new Set(prev).add(currentLocation.id));
    await refreshCountedLines(session.id);
    const savedCode = currentLocation.code;
    closeLocation();
    setMessage(`บันทึก ${savedCode} แล้ว`);
  }

  async function handleSubmitSession() {
    const remaining = parsedLocations.length - countedTotal;
    const confirmText = remaining > 0
      ? `ยังไม่ได้นับอีก ${remaining} Location — ยืนยันส่งผลการนับ ${session.count_no}?`
      : `ยืนยันส่งผลการนับ ${session.count_no}?`;
    if (!window.confirm(confirmText)) return;
    setBusy(true); setError('');
    const { error: e } = await setLocationCountStatus(session.id, 'SUBMITTED', { actorProfileId: activeProfile?.id ?? null });
    setBusy(false);
    if (e) { setError(e.message ?? 'ส่งผลการนับไม่สำเร็จ'); return; }
    setMessage(`ส่งผลการนับ ${session.count_no} แล้ว — แอดมินตรวจได้ที่เมนู "นับสต็อก"`);
    setSession(null);
    setCountedLines([]);
    setSavedLocationIds(new Set());
  }

  const nextUncounted = rowsInSide.find((l) => !isCounted(l.id));

  const page = (children) => (
    // Fixed-height page with its own scrolling body, like the other Scan
    // Center screens -- the handheld layout doesn't scroll the document.
    <div style={{ background: C.bg, height: '100dvh', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
      <div data-testid="handheld-stock-count" style={{ width: '100%', maxWidth: 720, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
      {scannerEl}
      {zoomUrl && (
        <button type="button" onClick={() => setZoomUrl(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(9,17,28,0.95)', border: 'none', padding: 16, cursor: 'zoom-out' }}>
          <img src={zoomUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </button>
      )}
    </div>
  );

  const banner = (
    <>
      {error && <div style={{ padding: '12px 16px', background: C.redLight, borderRadius: 14, color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{error}</div>}
      {message && <div style={{ padding: '12px 16px', background: C.greenLight, borderRadius: 14, color: C.green, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{message}</div>}
      {!isOnline && <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 14, color: '#92400e', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>ออฟไลน์ — กรอกต่อได้ ข้อมูลเก็บไว้ในเครื่อง แต่ต้องมีสัญญาณตอนกดบันทึก</div>}
    </>
  );

  // ── Row screen ──────────────────────────────────────────────
  if (currentLocation) {
    return page(
      <>
        <TopBar title={`นับ ${currentLocation.code}`} subtitle={`${session?.count_no ?? ''} · นับแล้ว ${doneCount}/${pallets.length} พาเลท`} onBack={closeLocation} />
        <div data-testid="stock-count-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 12px 140px' }}>
          {banner}
          <button type="button" onClick={openScanner}
            style={{ width: '100%', minHeight: 52, borderRadius: 16, border: `2px dashed ${C.border}`, background: C.surface, fontSize: 15, fontWeight: 800, color: C.text, cursor: 'pointer', marginBottom: 16 }}>
            📷 สแกน QR บนกล่อง เพื่อหาพาเลท
          </button>

          {palletsLoading && <div style={{ color: C.muted, textAlign: 'center', padding: 24 }}>กำลังโหลดพาเลท...</div>}
          {!palletsLoading && pallets.length === 0 && (
            <div style={{ background: C.surface, borderRadius: 16, padding: 20, textAlign: 'center', color: C.textSec, fontWeight: 700, marginBottom: 16 }}>
              ในระบบไม่มีสินค้าที่แถวนี้ — ถ้าเจอของ ให้เพิ่มเป็นพาเลทที่ไม่อยู่ในระบบ
            </div>
          )}

          {pallets.map((p) => (
            <PalletCard key={p.allocation_id} pallet={p} locationCode={currentLocation.code}
              photo={photos[p.deposit_line_id]} entry={entries[p.allocation_id]}
              highlighted={highlightId === p.allocation_id} onZoom={setZoomUrl}
              cardRef={(el) => { cardRefs.current[p.allocation_id] = el; }}
              onChange={(next) => { setError(''); setEntries((prev) => ({ ...prev, [p.allocation_id]: next })); }} />
          ))}

          {extras.map((x) => (
            <div key={x.key} style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: 16, padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, color: '#92400e', fontSize: 13 }}>พาเลทที่ไม่อยู่ในระบบ</div>
                <div style={{ fontWeight: 800, color: C.text, overflowWrap: 'anywhere' }}>{x.productName || x.trackingCode || '-'}</div>
                <div style={{ fontSize: 12, color: C.textSec }}>{x.trackingCode && x.productName ? `${x.trackingCode} · ` : ''}{x.boxes || 0} กล่อง{x.weight ? ` · ${x.weight} กก.` : ''}{x.note ? ` · ${x.note}` : ''}</div>
              </div>
              <button type="button" aria-label="ลบ" onClick={() => setExtras((prev) => prev.filter((e) => e.key !== x.key))}
                style={{ border: 'none', background: 'transparent', fontSize: 20, color: C.red, cursor: 'pointer' }}>✕</button>
            </div>
          ))}

          {extraForm ? (
            <div style={{ background: C.surface, border: `2px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>+ พาเลทที่ไม่อยู่ในระบบ</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input type="text" placeholder="รหัสติดตาม (ถ้ามี)" value={extraForm.trackingCode} onChange={(e) => setExtraForm({ ...extraForm, trackingCode: e.target.value })} style={{ ...selectStyle, fontWeight: 600 }} />
                <input type="text" placeholder="ชื่อสินค้า" value={extraForm.productName} onChange={(e) => setExtraForm({ ...extraForm, productName: e.target.value })} style={{ ...selectStyle, fontWeight: 600 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input type="number" inputMode="numeric" min="0" placeholder="กล่อง" value={extraForm.boxes} onChange={(e) => setExtraForm({ ...extraForm, boxes: e.target.value })} style={qtyInputStyle} />
                  <input type="number" inputMode="decimal" min="0" placeholder="กก." value={extraForm.weight} onChange={(e) => setExtraForm({ ...extraForm, weight: e.target.value })} style={qtyInputStyle} />
                </div>
                <input type="text" placeholder="หมายเหตุ" value={extraForm.note} onChange={(e) => setExtraForm({ ...extraForm, note: e.target.value })} style={{ ...selectStyle, fontWeight: 600 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setExtraForm(null)} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, fontWeight: 800, cursor: 'pointer' }}>ยกเลิก</button>
                  <button type="button" disabled={!(extraForm.trackingCode.trim() || extraForm.productName.trim()) || !(Number(extraForm.boxes) > 0 || Number(extraForm.weight) > 0)}
                    onClick={() => { setExtras((prev) => [...prev, { ...extraForm, key: `x-${Date.now()}` }]); setExtraForm(null); setMessage(''); }}
                    style={{ flex: 2, minHeight: 48, borderRadius: 12, border: 'none', background: C.primary, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>เพิ่ม</button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setExtraForm({ trackingCode: '', productName: '', boxes: '', weight: '', note: '' })}
              style={{ width: '100%', minHeight: 48, borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.surface, fontWeight: 800, color: C.textSec, cursor: 'pointer' }}>
              + พบพาเลทที่ไม่อยู่ในระบบ
            </button>
          )}
        </div>

        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 720, boxSizing: 'border-box', background: C.surface, borderTop: `1px solid ${C.borderLight}`, padding: '14px 12px 24px', boxShadow: '0 -10px 40px rgba(0,0,0,0.08)' }}>
          <button type="button" disabled={busy || palletsLoading} onClick={handleSaveRow} data-testid="stock-count-save-row"
            style={{ width: '100%', padding: 18, borderRadius: 18, border: 'none', fontSize: 18, fontWeight: 900, cursor: 'pointer', color: '#fff', background: allDone ? C.green : C.muted }}>
            {busy ? '⏳ กำลังบันทึก...' : `บันทึกแถวนี้ (${doneCount}/${pallets.length})`}
          </button>
        </div>
      </>,
    );
  }

  // ── Home screen ─────────────────────────────────────────────
  return page(
    <>
      <TopBar title="นับสต็อก" subtitle={session ? `${session.count_no} · นับแล้ว ${countedTotal}/${parsedLocations.length} Location` : 'เดินนับทีละแถว'} onBack={onBack} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 12px 32px' }}>
        {banner}
        {sessionLoading ? (
          <div style={{ color: C.muted, textAlign: 'center', padding: 24 }}>กำลังโหลด...</div>
        ) : !session ? (
          <div style={{ background: C.surface, borderRadius: 20, padding: 24, textAlign: 'center', boxShadow: C.shadow }}>
            <div style={{ fontSize: 15, color: C.textSec, fontWeight: 700, marginBottom: 16 }}>ยังไม่มีรอบนับที่เปิดอยู่</div>
            <button type="button" disabled={busy || !isOnline} onClick={handleStart} data-testid="stock-count-start"
              style={{ width: '100%', padding: 18, borderRadius: 18, border: 'none', background: C.primary, color: C.gold, fontSize: 18, fontWeight: 900, cursor: 'pointer' }}>
              ▶ เริ่มรอบนับใหม่
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <label>
                <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>ห้อง / โซน</div>
                <select value={zone} onChange={(e) => { setZone(e.target.value); setSide(''); }} style={selectStyle}>
                  <option value="">— เลือก —</option>
                  {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>ฝั่ง</div>
                <select value={side} onChange={(e) => setSide(e.target.value)} disabled={!zone} style={selectStyle}>
                  <option value="">— เลือก —</option>
                  {sides.map((s) => <option key={s} value={s}>{s === 'L' ? 'ซ้าย (L)' : 'ขวา (R)'}</option>)}
                </select>
              </label>
            </div>

            {zone && side && (
              <>
                {nextUncounted && (
                  <button type="button" onClick={() => openLocation(nextUncounted)}
                    style={{ width: '100%', padding: 16, borderRadius: 16, border: 'none', background: C.primary, color: C.gold, fontSize: 16, fontWeight: 900, cursor: 'pointer', marginBottom: 14 }}>
                    นับแถวถัดไป → {nextUncounted.code}
                  </button>
                )}
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 8 }}>
                  <span>⚪ ยังไม่นับ</span><span>✅ ตรง</span><span>⚠️ มีผลต่าง</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
                  {rowsInSide.map((l) => {
                    const counted = isCounted(l.id);
                    const status = counted ? rowStatus(linesByLocation.get(l.id)) : null;
                    const color = !counted ? C.border : status === 'VARIANCE' ? '#f59e0b' : C.green;
                    return (
                      <button key={l.id} type="button" onClick={() => openLocation(l)} data-testid="stock-count-row"
                        style={{ minHeight: 64, borderRadius: 14, border: `2px solid ${color}`, background: counted ? (status === 'VARIANCE' ? '#fffbeb' : C.greenLight) : C.surface, cursor: 'pointer', fontWeight: 900, color: C.text }}>
                        <div style={{ fontSize: 15 }}>{counted ? (status === 'VARIANCE' ? '⚠️ ' : '✅ ') : ''}{formatRowLabel(l.parsed.row)}</div>
                        <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{l.code}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button type="button" disabled={busy || !isOnline} onClick={handleSubmitSession} data-testid="stock-count-submit"
              style={{ width: '100%', marginTop: 28, padding: 16, borderRadius: 16, border: `2px solid ${C.green}`, background: C.surface, color: C.green, fontSize: 16, fontWeight: 900, cursor: 'pointer' }}>
              ✓ ส่งผลการนับ ({countedTotal} Location)
            </button>
          </>
        )}
      </div>
    </>,
  );
}
