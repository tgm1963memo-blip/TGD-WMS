import { useEffect, useRef, useState, useMemo } from 'react';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { getWithdrawalStatusLabel } from '../../utils/customerWithdrawalStatusLabels.js';
import {
  listCustomerDepositRequests,
  listCustomerDepositRequestLines,
  listDepositLineSummariesForDocs,
  recordDepositLineActualReceipt,
  updateDepositLineLocation,
  upsertCustomerDepositRequestLine,
} from '../../services/customerDepositRequestService.js';
import {
  listCustomerWithdrawalRequests,
  listCustomerWithdrawalRequestLines,
  listWithdrawalLineSummariesForDocs,
  reviewCustomerWithdrawalRequest,
  recordWithdrawalLinePick,
} from '../../services/customerWithdrawalRequestService.js';
import { getActiveLocations } from '../../services/warehouseLayoutService.js';
import { checkLocationHasInventory } from '../../services/inventoryMovementService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { HandheldProvider, useHandheldAuth } from './HandheldContext.jsx';
import { HandheldLoginPage } from './HandheldLoginPage.jsx';

// ── Theme tokens (aligned with main app: dark navy + gold) ───────────
const C = {
  bg: '#f8fafb',
  surface: '#ffffff',
  surfaceSolid: '#ffffff',
  card: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  shadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
  shadowMd: '0 8px 30px rgba(15, 23, 42, 0.08)',
  primary: '#09111c',
  primaryDark: '#050505',
  gold: '#d4af37',
  goldHover: '#b5952f',
  amber: '#d97706',
  green: '#059669',
  greenLight: '#ecfdf5',
  greenBorder: '#6ee7b7',
  red: '#dc2626',
  redLight: '#fef2f2',
  blueLight: '#f1f5f9',
  text: '#0f172a',
  textSec: '#475569',
  muted: '#94a3b8',
  inputBg: '#f8fafc',
  headerBg: '#09111c',
  receiveAccent: '#09111c',
  pickAccent: '#09111c',
  glassmorphism: {
    // backdropFilter removed for performance
    // WebkitBackdropFilter removed for performance
  }
};

// ── Sound & Haptic Feedback ───────────────────────────────────
function triggerSuccessFeedback() {
  if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { }
}

// ── Camera barcode scanner ────────────────────────────────────
function useCameraScanner(onScanned) {
  const inputRef = useRef(null);

  function trigger() { inputRef.current?.click(); }

  function handleCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['code_128', 'qr_code', 'code_39', 'ean_13', 'ean_8', 'itf', 'data_matrix'] });
          const codes = await detector.detect(img);
          if (codes.length > 0) {
            onScanned(codes[0].rawValue);
          } else {
            alert('ไม่พบบาร์โค้ดในภาพ กรุณาถ่ายภาพใหม่ให้ชัดขึ้น');
          }
        } catch {
          alert('ไม่สามารถอ่านบาร์โค้ดได้ กรุณาลองใหม่');
        }
      } else {
        // Fallback: prompt user to enter manually
        const manual = window.prompt('เบราว์เซอร์ไม่รองรับการสแกนอัตโนมัติ กรุณากรอกรหัสสินค้า:');
        if (manual) onScanned(manual.trim());
      }
    };
    img.src = objectUrl;
    e.target.value = '';
  }

  // Use capture="environment" to open rear camera directly on mobile
  const el = (
    <input ref={inputRef} type="file" accept="image/*;capture=camera" capture="environment"
      style={{ display: 'none' }} onChange={handleCapture} />
  );
  return { trigger, el };
}

// ── Print sticker ─────────────────────────────────────────────
function printSticker({ customerName, productName, lotNo, mfgDate, expDate, locationCode, locationDetail }) {
  const qrData = JSON.stringify({
    c: customerName,
    p: productName,
    l: lotNo,
    e: expDate,
    loc: locationCode
  });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sticker</title>
<style>
  @page { size: 100mm 60mm; margin: 4mm; }
  body { font-family: sans-serif; font-size: 10px; margin: 0; padding: 0; }
  .sticker { border: 1px solid #000; padding: 4mm; width: 92mm; height: 52mm; box-sizing: border-box; display: flex; gap: 4mm; }
  .info-col { flex: 1; display: flex; flex-direction: column; }
  .qr-col { width: 25mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .title { font-size: 13px; font-weight: 900; margin-bottom: 3mm; border-bottom: 1px solid #000; padding-bottom: 2mm; }
  .row { display: flex; gap: 4px; margin-bottom: 1mm; }
  .label { font-weight: 700; min-width: 18mm; color: #555; }
  .val { font-weight: 600; font-size: 11px; }
  .location-box { margin-top: auto; padding: 1mm; border: 2px solid #000; border-radius: 2mm; text-align: center; }
  .loc-main { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
  .loc-detail { font-size: 9px; color: #666; }
</style>
</head>
<body>
<div class="sticker">
  <div class="info-col">
    <div class="title">TGC Cold Storage — สติ๊กเกอร์จัดเก็บ</div>
    <div class="row"><span class="label">ลูกค้า:</span><span class="val">${customerName ?? '-'}</span></div>
    <div class="row"><span class="label">สินค้า:</span><span class="val">${productName ?? '-'}</span></div>
    ${lotNo ? `<div class="row"><span class="label">LOT:</span><span class="val">${lotNo}</span></div>` : ''}
    ${mfgDate ? `<div class="row"><span class="label">ผลิต:</span><span class="val">${mfgDate}</span></div>` : ''}
    ${expDate ? `<div class="row"><span class="label">หมดอายุ:</span><span class="val">${expDate}</span></div>` : ''}
    <div class="location-box">
      <div class="loc-main">${locationCode ?? '-'}</div>
      ${locationDetail ? `<div class="loc-detail">${locationDetail}</div>` : ''}
    </div>
  </div>
  <div class="qr-col">
    <img src="${qrUrl}" alt="QR Code" style="width: 25mm; height: 25mm; margin-bottom: 2mm;" />
  </div>
</div>
</body>
</html>`;
  const win = window.open('', '_blank', 'width=400,height=300');
  if (!win) { alert('กรุณาอนุญาตป๊อปอัพ'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 500); };
}

// ── Status pill ───────────────────────────────────────────────
function Pill({ label, color = C.primary, bg }) {
  return (
    <span style={{
      background: bg ?? (color + '18'),
      color,
      border: `1px solid ${color}33`,
      borderRadius: 20, padding: '4px 12px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Top bar ───────────────────────────────────────────────────
function TopBar({ title, subtitle, onBack, badge }) {
  return (
    <div style={{
      background: C.headerBg,
      borderBottom: 'none',
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      {onBack && (
        <button type="button" onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#ffffff', fontSize: 20, cursor: 'pointer',
            width: 40, height: 40, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          ←
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: '#ffffff',
          fontWeight: 800, fontSize: 18,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        {subtitle && (
          <div style={{ color: C.gold, fontSize: 13, marginTop: 2, fontWeight: 600 }}>
            {subtitle}
          </div>
        )}
      </div>
      {badge}
    </div>
  );
}

// ── Qty input row ─────────────────────────────────────────────
function QtyRow({ boxes, setBoxes, weight, setWeight }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '0 0 16px', flexShrink: 0 }}>
      {[['กล่อง', boxes, setBoxes], ['น้ำหนัก (กก.)', weight, setWeight]].map(([label, val, setVal]) => (
        <label key={label} style={{ flex: 1 }}>
          <div style={{ color: C.textSec, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{label}</div>
          <input
            type="number" min={0} value={val}
            onChange={(e) => setVal(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: val ? C.greenLight : C.inputBg,
              border: `2px solid ${val ? C.green : C.border}`,
              borderRadius: 16, padding: '16px 12px',
              color: val ? C.green : C.text,
              fontSize: 26, fontWeight: 800, textAlign: 'center', outline: 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </label>
      ))}
    </div>
  );
}

// ── Confirmed chip ────────────────────────────────────────────
function ConfirmedChip({ item }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      background: C.greenLight, borderRadius: 16,
      border: `1px solid ${C.greenBorder}`, marginBottom: 10,
      boxShadow: '0 2px 8px rgba(16,185,129,0.1)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: C.green, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 18, boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
      }}>✓</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word' }}>
          {item.line?.product_name ?? item.line?.customer_product_code}
        </div>
        <div style={{ color: C.green, fontSize: 13, marginTop: 4, fontWeight: 600 }}>
          {item.boxes} กล่อง · {item.weight} กก.{item.palletId ? ` · ${item.palletId}` : ''}{item.location ? ` · 📍 ${item.location.code}` : ''}
        </div>
      </div>
      <span style={{ color: C.textSec, fontSize: 12, fontWeight: 600 }}>{item.confirmedAt}</span>
    </div>
  );
}

// ── Line list item ────────────────────────────────────────────
function LineListItem({ line, index, isDone, doneLabel, onSelect }) {
  return (
    <button type="button" onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%', boxSizing: 'border-box', textAlign: 'left',
        background: isDone ? C.surfaceSolid : C.card,
        border: `1px solid ${isDone ? C.greenBorder : C.border}`,
        borderRadius: 16, padding: '24px 16px', marginBottom: 10,
        cursor: 'pointer', color: C.text,
        boxShadow: isDone ? 'none' : C.shadow,
        transition: 'transform 0.2s, box-shadow 0.2s',
        borderLeft: `5px solid ${isDone ? C.green : C.primary}`,
        opacity: isDone ? 0.7 : 1,
        overflow: 'hidden',
      }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: isDone ? C.green : C.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 15, fontWeight: 800,
      }}>
        {isDone ? '✓' : index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 15, fontWeight: 800, wordBreak: 'break-word', overflowWrap: 'anywhere', color: C.text, lineHeight: 1.4 }}>
          {line.product_name ?? line.customer_product_code}
        </div>
        <div style={{ fontSize: 13, color: C.textSec, marginTop: 4, fontWeight: 500, lineHeight: 1.5 }}>
          {line.expected_boxes != null ? `${line.expected_boxes} กล่อง · ` : ''}{line.expected_weight != null ? `${line.expected_weight} กก.` : ''}
          {isDone && doneLabel && (
            <span style={{
              color: C.green, fontWeight: 800, marginLeft: 8,
              background: C.greenLight, borderRadius: 8, padding: '2px 8px',
            }}>{doneLabel}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Doc card ──────────────────────────────────────────────────
function DocCard({ onClick, docNo, statusLabel, statusColor, dateStr, subText, customerName, lotText, expText }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', textAlign: 'left',
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 20, padding: '20px 24px', marginBottom: 16,
        cursor: 'pointer', color: C.text,
        boxShadow: C.shadow,
        borderLeft: `6px solid ${statusColor}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8, width: '100%' }}>
        <span style={{
          fontFamily: 'monospace', fontWeight: 900, fontSize: 15, color: C.text, letterSpacing: '0.02em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, lineHeight: 1.4,
        }}>{docNo}</span>
        <Pill label={statusLabel} color={statusColor} />
      </div>
      {customerName && (
        <div style={{ fontSize: 13, color: C.text, fontWeight: 700, marginBottom: 4, lineHeight: 1.5 }}>{customerName}</div>
      )}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
        <span style={{ fontSize: 13, color: C.textSec, fontWeight: 500, lineHeight: 1.5 }}>{dateStr}</span>
        {subText && <span style={{ fontSize: 13, color: C.muted, fontWeight: 500, lineHeight: 1.5, wordBreak: 'break-word' }}>· {subText}</span>}
      </div>
      {(lotText || expText) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          {lotText && <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600, background: C.blueLight, borderRadius: 8, padding: '2px 8px' }}>LOT: {lotText}</span>}
          {expText && <span style={{ fontSize: 12, color: C.amber, fontWeight: 600, background: '#fef3c7', borderRadius: 8, padding: '2px 8px' }}>หมดอายุ: {expText}</span>}
        </div>
      )}
    </button>
  );
}

// ── Sort Control ──────────────────────────────────────────────
function SortDropdown({ sortType, setSortType }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: C.textSec, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        รายการสินค้า
      </div>
      <select
        value={sortType}
        onChange={(e) => setSortType(e.target.value)}
        style={{
          width: '100%',
          background: C.surfaceSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 700,
          color: C.primaryDark,
          outline: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <option value="pending">ยังไม่ทำก่อน</option>
        <option value="name">ชื่อสินค้า (ก-ฮ)</option>
        <option value="code">รหัสสินค้า (A-Z)</option>
      </select>
    </div>
  );
}

// ── Receiving workflow ────────────────────────────────────────
function ReceivingWorkflow({ onBack, t }) {
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docLineSummary, setDocLineSummary] = useState({});
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [matchedLine, setMatchedLine] = useState(null);
  const [boxes, setBoxes] = useState('');
  const [weight, setWeight] = useState('');

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locZone, setLocZone] = useState('');
  const [locSide, setLocSide] = useState('');
  const [locRow, setLocRow] = useState('');
  const [locLevel, setLocLevel] = useState('');
  const [confirmed, setConfirmed] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sortType, setSortType] = useState('pending');
  const [mismatchWarned, setMismatchWarned] = useState(false);
  const [editLotNo, setEditLotNo] = useState('');
  const [editMfgDate, setEditMfgDate] = useState('');
  const [editExpDate, setEditExpDate] = useState('');
  const [stickerItem, setStickerItem] = useState(null);
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [extraProductName, setExtraProductName] = useState('');
  const [extraProductCode, setExtraProductCode] = useState('');
  const [extraLotNo, setExtraLotNo] = useState('');
  const [extraMfgDate, setExtraMfgDate] = useState('');
  const [extraExpDate, setExtraExpDate] = useState('');
  const [extraBoxes, setExtraBoxes] = useState('');
  const [extraWeight, setExtraWeight] = useState('');
  const [extraSaving, setExtraSaving] = useState(false);
  const [extraError, setExtraError] = useState('');

  // Parse location code into hierarchy parts: zone, side, row, level
  function parseLocCode(code) {
    const m = /^(.+)-([LR])-(\d+)-(\d+)$/i.exec(code ?? '');
    return m ? { zone: m[1], side: m[2].toUpperCase(), row: m[3], level: m[4] } : null;
  }
  const parsedLocs = useMemo(() => locations.map((l) => ({ ...l, parsed: parseLocCode(l.code) })), [locations]);
  const useHierarchy = parsedLocs.length > 0 && parsedLocs.every((l) => l.parsed !== null);

  const availableZones = useMemo(() => {
    if (!useHierarchy) return [];
    return [...new Set(parsedLocs.map((l) => l.parsed.zone))].sort();
  }, [parsedLocs, useHierarchy]);

  const availableSides = useMemo(() => {
    if (!locZone) return [];
    return [...new Set(parsedLocs.filter((l) => l.parsed.zone === locZone).map((l) => l.parsed.side))].sort();
  }, [parsedLocs, locZone]);

  const availableRows = useMemo(() => {
    if (!locZone || !locSide) return [];
    return [...new Set(parsedLocs.filter((l) => l.parsed.zone === locZone && l.parsed.side === locSide).map((l) => l.parsed.row))].sort();
  }, [parsedLocs, locZone, locSide]);

  const availableLevels = useMemo(() => {
    if (!locZone || !locSide || !locRow) return [];
    return [...new Set(parsedLocs.filter((l) => l.parsed.zone === locZone && l.parsed.side === locSide && l.parsed.row === locRow).map((l) => l.parsed.level))].sort();
  }, [parsedLocs, locZone, locSide, locRow]);

  // Auto-resolve selectedLocation from the 4-part hierarchy selection
  useEffect(() => {
    if (!useHierarchy || !locZone || !locSide || !locRow || !locLevel) {
      if (useHierarchy) setSelectedLocation(null);
      return;
    }
    const match = parsedLocs.find((l) =>
      l.parsed.zone === locZone && l.parsed.side === locSide && l.parsed.row === locRow && l.parsed.level === locLevel
    );
    setSelectedLocation(match ?? null);
  }, [locZone, locSide, locRow, locLevel, parsedLocs, useHierarchy]);

  const { trigger: cameraItem, el: cameraItemEl } = useCameraScanner((v) => handleScan(v));

  useEffect(() => {
    listCustomerDepositRequests({ statusIn: ['WAREHOUSE_RECEIVING', 'ADMIN_ACCEPTED'] }).then((r) => {
      const loaded = r.data ?? [];
      setDocs(loaded);
      setDocsLoading(false);
      const ids = loaded.map((d) => d.id);
      listDepositLineSummariesForDocs(ids).then((sr) => {
        const map = {};
        (sr.data ?? []).forEach((l) => {
          if (!map[l.deposit_request_id]) map[l.deposit_request_id] = { lots: [], exps: [] };
          if (l.lot_no) map[l.deposit_request_id].lots.push(l.lot_no);
          if (l.exp_date) map[l.deposit_request_id].exps.push(l.exp_date);
        });
        setDocLineSummary(map);
      });
    });
    getActiveLocations().then(({ data }) => setLocations(data ?? []));
  }, []);

  function pickDoc(doc) {
    setSelectedDoc(doc);
    setLinesLoading(true);
    listCustomerDepositRequestLines(doc.id).then((r) => {
      setLines(r.data ?? []);
      setLinesLoading(false);
      setScanValue(''); setMatchedLine(null);
    });
  }

  function handleScan(val) {
    setScanValue(val);
    const q = val.trim().toLowerCase();
    const match = lines.find((l) =>
      (l.customer_product_code ?? '').toLowerCase() === q ||
      (l.product_name ?? '').toLowerCase().includes(q) ||
      (l.lot_no ?? '').toLowerCase() === q,
    );
    if (match) {
      triggerSuccessFeedback();
      setMatchedLine(match);
      setBoxes(match.actual_boxes?.toString() ?? match.expected_boxes?.toString() ?? '');
      setWeight(match.actual_weight?.toString() ?? match.expected_weight?.toString() ?? '');
      setEditLotNo(match.lot_no ?? '');
      setEditMfgDate(match.mfg_date ?? '');
      setEditExpDate(match.exp_date ?? '');
      setMismatchWarned(false);
    } else {
      setMatchedLine(null);
    }
  }

  function hasMismatch() {
    const enteredBoxes = Number(boxes);
    const enteredWeight = Number(weight);
    const expectedBoxes = Number(matchedLine?.expected_boxes ?? 0);
    const expectedWeight = Number(matchedLine?.expected_weight ?? 0);
    const boxesDiff = expectedBoxes > 0 && Math.abs(enteredBoxes - expectedBoxes) > 0;
    const weightDiff = expectedWeight > 0 && Math.abs(enteredWeight - expectedWeight) > 0.01;
    return boxesDiff || weightDiff;
  }

  async function handleConfirm() {
    if (!matchedLine) return;
    if (hasMismatch() && !mismatchWarned) {
      setMismatchWarned(true);
      return;
    }
    setSaving(true); setSaveError('');
    const r = await recordDepositLineActualReceipt(matchedLine.id, {
      actualBoxes: boxes,
      actualWeight: weight,
      note: null,
      lotNo: editLotNo || null,
      mfgDate: editMfgDate || null,
      expDate: editExpDate || null,
      locationId: selectedLocation?.id || null,
    });
    setSaving(false);
    if (r.error) { setSaveError(r.error.message ?? 'บันทึกไม่สำเร็จ'); return; }

    triggerSuccessFeedback();
    const confirmedItem = {
      line: matchedLine, boxes, weight, location: selectedLocation,
      lotNo: editLotNo, mfgDate: editMfgDate, expDate: editExpDate,
      confirmedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      customerName: selectedDoc?.contact_name ?? '',
    };
    setConfirmed((prev) => [confirmedItem, ...prev]);
    setLines((prev) => prev.map((l) => l.id === matchedLine.id
      ? { ...l, actual_boxes: Number(boxes) || null, actual_weight: Number(weight) || null } : l));

    setStickerItem(confirmedItem);
    setScanValue(''); setMatchedLine(null); setBoxes(''); setWeight('');
    setSelectedLocation(null); setMismatchWarned(false);
    setLocZone(''); setLocSide(''); setLocRow(''); setLocLevel('');
    setEditLotNo(''); setEditMfgDate(''); setEditExpDate('');
  }

  async function handleAddExtra() {
    if (!extraProductName.trim() || !extraBoxes) return;
    setExtraSaving(true); setExtraError('');
    const upsertResult = await upsertCustomerDepositRequestLine(selectedDoc.id, {
      productName: extraProductName.trim(),
      customerProductCode: extraProductCode.trim() || null,
      lotNo: extraLotNo || null,
      mfgDate: extraMfgDate || null,
      expDate: extraExpDate || null,
      expectedBoxes: Number(extraBoxes) || null,
      expectedWeight: Number(extraWeight) || null,
    });
    if (upsertResult.error) {
      setExtraError(upsertResult.error.message ?? 'เพิ่มรายการไม่สำเร็จ');
      setExtraSaving(false);
      return;
    }
    const newLineId = upsertResult.data?.id;
    if (newLineId) {
      await recordDepositLineActualReceipt(newLineId, {
        actualBoxes: Number(extraBoxes) || null,
        actualWeight: Number(extraWeight) || null,
        note: null,
        lotNo: extraLotNo || null,
        mfgDate: extraMfgDate || null,
        expDate: extraExpDate || null,
      });
    }
    triggerSuccessFeedback();
    // Refresh lines
    const refreshed = await listCustomerDepositRequestLines(selectedDoc.id);
    setLines(refreshed.data ?? []);
    setExtraSaving(false);
    setAddExtraOpen(false);
    setExtraProductName(''); setExtraProductCode(''); setExtraLotNo('');
    setExtraMfgDate(''); setExtraExpDate(''); setExtraBoxes(''); setExtraWeight('');
  }

  const doneCount = lines.filter((l) => l.actual_boxes != null).length;

  const sortedLines = useMemo(() => {
    return [...lines].sort((a, b) => {
      if (sortType === 'pending') {
        const aDone = a.actual_boxes != null;
        const bDone = b.actual_boxes != null;
        if (aDone !== bDone) return aDone ? 1 : -1;
      } else if (sortType === 'name') {
        const aName = a.product_name ?? '';
        const bName = b.product_name ?? '';
        return aName.localeCompare(bName, 'th');
      } else if (sortType === 'code') {
        const aCode = a.customer_product_code ?? '';
        const bCode = b.customer_product_code ?? '';
        return aCode.localeCompare(bCode);
      }
      return 0;
    });
  }, [lines, sortType]);

  if (!selectedDoc) {
    const customerOptions = [...new Map(
      docs.map((d) => ({ id: d.customer_id, name: d.customer?.customer_name || d.customer?.name || d.customer_id }))
        .filter((c) => c.id)
        .map((c) => [c.id, c])
    ).values()];
    const filteredDocs = docs.filter((d) => {
      if (filterCustomer && d.customer_id !== filterCustomer) return false;
      const date = d.expected_arrival_date ?? '';
      if (filterDateFrom && date < filterDateFrom) return false;
      if (filterDateTo && date > filterDateTo) return false;
      return true;
    });
    const hasFilter = filterCustomer || filterDateFrom || filterDateTo;
    return (
      <div style={{ background: C.bg, minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div data-testid="handheld-page" style={{ width: '100%', maxWidth: 720, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <TopBar title="รับสินค้าเข้า" subtitle="เลือกใบงานที่ต้องการ" onBack={onBack} />
        <div style={{ padding: '16px 10px', flex: 1, overflowY: 'auto' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
              style={{ flex: '1 1 160px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 700, color: C.text, outline: 'none' }}>
              <option value="">ลูกค้าทุกราย</option>
              {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
              style={{ flex: '1 1 130px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, color: C.text, outline: 'none' }} />
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
              style={{ flex: '1 1 130px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, color: C.text, outline: 'none' }} />
            {hasFilter && (
              <button type="button" onClick={() => { setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                style={{ background: C.blueLight, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: C.textSec, cursor: 'pointer' }}>
                ล้าง
              </button>
            )}
          </div>
          {docsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontWeight: 700 }}>กำลังโหลด...</div>
          ) : filteredDocs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: C.card, borderRadius: 24, marginTop: 8,
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
            }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>{`{ }`}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>{hasFilter ? 'ไม่พบใบงานที่ตรงกับเงื่อนไข' : 'ไม่มีใบงานที่รอรับสินค้า'}</div>
              <div style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>ใบงานสถานะ "รับเข้าคลัง" จะปรากฏที่นี่</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: C.textSec, fontWeight: 800 }}>พบ {filteredDocs.length} ใบงาน</span>
              </div>
              {filteredDocs.map((doc) => {
                const summary = docLineSummary[doc.id];
                const lots = summary?.lots ?? [];
                const exps = summary?.exps ?? [];
                const uniqueLots = [...new Set(lots)];
                const uniqueExps = [...new Set(exps)].sort();
                return (
                  <DocCard
                    key={doc.id}
                    onClick={() => pickDoc(doc)}
                    docNo={doc.request_no}
                    statusLabel={getDepositStatusLabel(doc.status, t)}
                    statusColor={doc.status === 'ADMIN_ACCEPTED' ? C.receiveAccent : C.green}
                    dateStr={doc.expected_arrival_date ?? '-'}
                    subText={doc.contact_name}
                    customerName={doc.customer?.customer_name || doc.customer?.name || null}
                    lotText={uniqueLots.length ? uniqueLots.join(', ') : null}
                    expText={uniqueExps.length ? uniqueExps[0] + (uniqueExps.length > 1 ? ` +${uniqueExps.length - 1}` : '') : null}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, display: 'flex', justifyContent: 'center' }}>
    <div data-testid="handheld-page" style={{ width: '100%', maxWidth: 720, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {cameraItemEl}

      <TopBar
        title={selectedDoc.request_no}
        subtitle={`✅ ${doneCount}/${lines.length} รายการ`}
        onBack={() => { setSelectedDoc(null); setLines([]); setConfirmed([]); setMatchedLine(null); setScanValue(''); setSelectedLocation(null); setLocZone(''); setLocSide(''); setLocRow(''); setLocLevel(''); }}
        badge={
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 20,
            padding: '4px 12px', color: '#fff', fontSize: 13, fontWeight: 800,
            border: '1px solid rgba(255,255,255,0.4)',
          }}>
            {doneCount}/{lines.length}
          </div>
        }
      />

      {lines.length > 0 && (
        <div style={{ background: C.primaryDark, height: 6, flexShrink: 0 }}>
          <div style={{
            height: '100%', background: C.green,
            width: `${(doneCount / lines.length) * 100}%`,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 10px 320px', background: C.bg }}>
        {linesLoading ? (
          <div style={{ textAlign: 'center', color: C.muted, fontWeight: 700, padding: 40 }}>กำลังโหลด...</div>
        ) : (
          <>
            {confirmed.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  color: C.green, fontSize: 13, fontWeight: 800, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: '0.08em'
                }}>
                  บันทึกแล้วล่าสุด ({confirmed.length})
                </div>
                {confirmed.slice(0, 3).map((item, i) => <ConfirmedChip key={i} item={item} />)}
              </div>
            )}

            <SortDropdown sortType={sortType} setSortType={setSortType} />

            {sortedLines.map((l, i) => (
              <LineListItem key={l.id} line={l} index={i} isDone={l.actual_boxes != null}
                doneLabel={l.actual_boxes != null ? `รับแล้ว ${l.actual_boxes} กล่อง` : ''}
                onSelect={() => {
                  setMatchedLine(l);
                  setScanValue(l.customer_product_code ?? l.product_name ?? '');
                  setBoxes(l.actual_boxes?.toString() ?? l.expected_boxes?.toString() ?? '');
                  setWeight(l.actual_weight?.toString() ?? l.expected_weight?.toString() ?? '');
                  setEditLotNo(l.lot_no ?? '');
                  setEditMfgDate(l.mfg_date ?? '');
                  setEditExpDate(l.exp_date ?? '');
                  setMismatchWarned(false);
                  triggerSuccessFeedback();
                }} />
            ))}
          </>
        )}
      </div>

      {/* Sticker print popup */}
      {stickerItem && (
        <div 
          role="dialog" 
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '24px 20px',
            width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 16, color: C.text }}>พิมพ์สติ๊กเกอร์</div>
            <div style={{ background: C.blueLight, borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13 }}>
              <div><strong>ลูกค้า:</strong> {stickerItem.customerName || '-'}</div>
              <div><strong>สินค้า:</strong> {stickerItem.line?.product_name}</div>
              <div><strong>LOT:</strong> {stickerItem.lotNo || '-'}</div>
              <div><strong>วันผลิต:</strong> {stickerItem.mfgDate || '-'} / <strong>หมดอายุ:</strong> {stickerItem.expDate || '-'}</div>
              <div><strong>Location:</strong> {stickerItem.location?.code ?? 'ยังไม่ได้เลือก'}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button"
                onClick={() => {
                  printSticker({
                    customerName: stickerItem.customerName,
                    productName: stickerItem.line?.product_name,
                    lotNo: stickerItem.lotNo,
                    mfgDate: stickerItem.mfgDate,
                    expDate: stickerItem.expDate,
                    locationCode: stickerItem.location?.code,
                    locationDetail: stickerItem.location ? `${stickerItem.location.sectionName ?? stickerItem.location.sectionCode ?? '-'}` : '',
                  });
                }}
                style={{ flex: 1, padding: '16px', borderRadius: 16, background: C.primary, color: '#fff', border: 'none', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                พิมพ์สติ๊กเกอร์
              </button>
              <button type="button" onClick={() => setStickerItem(null)}
                style={{ padding: '16px 20px', borderRadius: 16, background: C.blueLight, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: C.textSec }}>
                ข้าม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 720,
        background: C.surface,
        // backdropFilter removed for performance
        // WebkitBackdropFilter removed for performance
        borderTop: `1px solid ${C.borderLight}`,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.08)',
        padding: '20px 10px 32px',
        zIndex: 100,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}>
        {matchedLine ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ color: C.primaryDark, fontWeight: 900, fontSize: 20 }}>ยืนยันรับเข้า</div>
              <button type="button" onClick={() => { setMatchedLine(null); setScanValue(''); }}
                style={{
                  background: C.border, border: 'none', borderRadius: 16, width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: C.textSec, cursor: 'pointer',
                }}>✕</button>
            </div>

            <div style={{
              background: '#ffffff', borderRadius: 20, padding: '24px 16px', marginBottom: 16,
              border: `2px solid ${C.primary}40`,
            }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 8, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {matchedLine.product_name ?? matchedLine.customer_product_code ?? '—'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ background: C.blueLight, color: C.primaryDark, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, overflowWrap: 'break-word', wordBreak: 'break-all' }}>รหัส {matchedLine.customer_product_code}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  <div style={{ fontSize: 11, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>เลข LOT</div>
                  <input type="text" value={editLotNo} onChange={(e) => setEditLotNo(e.target.value)}
                    placeholder="LOT number"
                    style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 14, fontWeight: 700, outline: 'none' }} />
                </label>
                <label>
                  <div style={{ fontSize: 11, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>วันผลิต</div>
                  <input type="date" value={editMfgDate} onChange={(e) => setEditMfgDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>วันหมดอายุ</div>
                  <input type="date" value={editExpDate} onChange={(e) => setEditExpDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                </label>
              </div>
            </div>

            {saveError && (
              <div style={{ padding: '12px 16px', background: C.redLight, borderRadius: 16, color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                {saveError}
              </div>
            )}

            <QtyRow boxes={boxes} setBoxes={setBoxes} weight={weight} setWeight={setWeight} />

            {mismatchWarned && (
              <div style={{ padding: '12px 16px', background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 16, marginBottom: 16 }}>
                <div style={{ color: '#92400e', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>⚠ จำนวนไม่ตรงกับที่แจ้ง</div>
                <div style={{ color: '#78350f', fontSize: 13 }}>
                  ที่แจ้ง: {matchedLine.expected_boxes} กล่อง / {matchedLine.expected_weight} กก.
                  — ที่นับได้: {boxes} กล่อง / {weight} กก.
                </div>
                <div style={{ color: '#92400e', fontSize: 13, marginTop: 4, fontWeight: 700 }}>กดยืนยันอีกครั้งเพื่อบันทึกตามจำนวนที่นับได้</div>
              </div>
            )}

            <div style={{ marginBottom: 16 }} />

            {locations.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: C.textSec, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  📍 เลือก Location จัดเก็บ
                  {selectedLocation && (
                    <span style={{ marginLeft: 8, color: C.green, fontWeight: 900 }}>
                      ✓ {selectedLocation.code}
                    </span>
                  )}
                </div>

                {useHierarchy ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>ห้อง / โซน</div>
                      <select value={locZone} onChange={(e) => { setLocZone(e.target.value); setLocSide(''); setLocRow(''); setLocLevel(''); }}
                        style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 8px', fontSize: 14, fontWeight: 700, color: C.text, outline: 'none', minHeight: 48 }}>
                        <option value="">— เลือก —</option>
                        {availableZones.map((z) => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>ฝั่ง</div>
                      <select value={locSide} onChange={(e) => { setLocSide(e.target.value); setLocRow(''); setLocLevel(''); }}
                        disabled={!locZone}
                        style={{ width: '100%', boxSizing: 'border-box', background: locZone ? C.inputBg : C.borderLight, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 8px', fontSize: 14, fontWeight: 700, color: locZone ? C.text : C.muted, outline: 'none', minHeight: 48 }}>
                        <option value="">— เลือก —</option>
                        {availableSides.map((s) => <option key={s} value={s}>{s === 'L' ? 'ซ้าย (L)' : 'ขวา (R)'}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>แถว</div>
                      <select value={locRow} onChange={(e) => { setLocRow(e.target.value); setLocLevel(''); }}
                        disabled={!locSide}
                        style={{ width: '100%', boxSizing: 'border-box', background: locSide ? C.inputBg : C.borderLight, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 8px', fontSize: 14, fontWeight: 700, color: locSide ? C.text : C.muted, outline: 'none', minHeight: 48 }}>
                        <option value="">— เลือก —</option>
                        {availableRows.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>ชั้น</div>
                      <select value={locLevel} onChange={(e) => setLocLevel(e.target.value)}
                        disabled={!locRow}
                        style={{ width: '100%', boxSizing: 'border-box', background: locRow ? C.inputBg : C.borderLight, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 8px', fontSize: 14, fontWeight: 700, color: locRow ? C.text : C.muted, outline: 'none', minHeight: 48 }}>
                        <option value="">— เลือก —</option>
                        {availableLevels.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {locations.map((loc) => {
                      const isSelected = selectedLocation?.id === loc.id;
                      return (
                        <button key={loc.id} type="button"
                          onClick={() => setSelectedLocation(isSelected ? null : loc)}
                          style={{
                            padding: '10px 14px', borderRadius: 14,
                            border: `2px solid ${isSelected ? C.green : C.border}`,
                            background: isSelected ? C.greenLight : C.surfaceSolid,
                            color: isSelected ? C.green : C.textSec,
                            fontSize: 14, fontWeight: isSelected ? 800 : 600,
                            cursor: 'pointer', transition: 'all 0.2s',
                          }}>
                          {loc.sectionCode} · {loc.code}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button type="button" disabled={(!boxes && !weight) || saving} onClick={handleConfirm}
              style={{
                width: '100%', padding: '20px', borderRadius: 20,
                background: (!boxes && !weight) ? C.border : (mismatchWarned ? '#f59e0b' : (matchedLine?.actual_boxes != null ? '#1d6fcf' : C.green)),
                color: (!boxes && !weight) ? C.muted : '#ffffff',
                border: 'none', fontSize: 18, fontWeight: 900, cursor: 'pointer',
                boxShadow: (!boxes && !weight) ? 'none' : (mismatchWarned ? '0 8px 24px rgba(245,158,11,0.4)' : (matchedLine?.actual_boxes != null ? '0 8px 24px rgba(29,111,207,0.4)' : '0 8px 24px rgba(16,185,129,0.4)')),
                transition: 'all 0.2s',
              }}>
              {saving ? '⏳ กำลังบันทึก...' : (mismatchWarned ? '⚠ ยืนยันอีกครั้ง (จำนวนต่างจากแจ้ง)' : (matchedLine?.actual_boxes != null ? '✎ แก้ไขยอดรับเข้า' : '✓ ยืนยันรับสินค้า'))}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                flex: 1, position: 'relative', borderRadius: 20,
                boxShadow: scanValue ? `0 0 0 3px ${C.primary}30` : `0 0 0 3px ${C.borderLight}`,
              }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: C.muted, pointerEvents: 'none' }}>
                  ค้นหา
                </span>
                <input
                  type="text" value={scanValue} onChange={(e) => handleScan(e.target.value)}
                  placeholder="สแกนรหัส หรือ LOT"
                  style={{
                    width: '100%', boxSizing: 'border-box', background: C.surfaceSolid,
                    border: `2px solid ${C.primary}`, borderRadius: 20, padding: '16px 16px 16px 60px',
                    color: C.text, fontSize: 16, fontWeight: 800, outline: 'none',
                  }}
                />
              </div>
              <button type="button" onClick={cameraItem}
                style={{
                  background: C.primary, border: 'none', borderRadius: 20,
                  padding: '16px 20px', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(14,165,233,0.3)',
                }}>
                กล้อง
              </button>
            </div>
            <button type="button" onClick={() => setAddExtraOpen(true)}
              style={{
                marginTop: 12, width: '100%', padding: '14px', borderRadius: 16,
                background: 'transparent', border: `2px dashed ${C.border}`,
                color: C.textSec, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
              + เพิ่มสินค้าที่ไม่ได้แจ้ง / เพิ่ม LOT ใหม่
            </button>
          </div>
        )}
      </div>

      {/* Add Extra Item Modal */}
      {addExtraOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
            padding: '28px 20px 40px', width: '100%', maxWidth: 480,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>เพิ่มสินค้าที่ไม่ได้แจ้ง</div>
              <button type="button" onClick={() => { setAddExtraOpen(false); setExtraError(''); }}
                style={{ background: C.border, border: 'none', borderRadius: 14, width: 36, height: 36, fontSize: 18, cursor: 'pointer', color: C.textSec }}>
                ✕
              </button>
            </div>
            {extraError && (
              <div style={{ padding: '12px 16px', background: C.redLight, borderRadius: 12, color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                {extraError}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>ชื่อสินค้า <span style={{ color: C.red }}>*</span></div>
                <input type="text" value={extraProductName} onChange={(e) => setExtraProductName(e.target.value)}
                  placeholder="ชื่อสินค้า"
                  style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, fontWeight: 700, outline: 'none' }} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>รหัสสินค้าลูกค้า</div>
                <input type="text" value={extraProductCode} onChange={(e) => setExtraProductCode(e.target.value)}
                  placeholder="รหัสสินค้า (ถ้ามี)"
                  style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, fontWeight: 700, outline: 'none' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>เลข LOT</div>
                  <input type="text" value={extraLotNo} onChange={(e) => setExtraLotNo(e.target.value)}
                    placeholder="LOT"
                    style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 700, outline: 'none' }} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>วันผลิต</div>
                  <input type="date" value={extraMfgDate} onChange={(e) => setExtraMfgDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 13, outline: 'none' }} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>วันหมดอายุ</div>
                  <input type="date" value={extraExpDate} onChange={(e) => setExtraExpDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 13, outline: 'none' }} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>จำนวนกล่อง <span style={{ color: C.red }}>*</span></div>
                  <input type="number" min="0" value={extraBoxes} onChange={(e) => setExtraBoxes(e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, fontWeight: 800, outline: 'none' }} />
                </label>
              </div>
              <label>
                <div style={{ fontSize: 12, color: C.textSec, fontWeight: 700, marginBottom: 4 }}>น้ำหนัก (กก.)</div>
                <input type="number" min="0" step="0.01" value={extraWeight} onChange={(e) => setExtraWeight(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, fontWeight: 800, outline: 'none' }} />
              </label>
            </div>
            <button type="button"
              disabled={!extraProductName.trim() || !extraBoxes || extraSaving}
              onClick={handleAddExtra}
              style={{
                marginTop: 20, width: '100%', padding: '18px', borderRadius: 18,
                background: (!extraProductName.trim() || !extraBoxes) ? C.border : C.green,
                color: (!extraProductName.trim() || !extraBoxes) ? C.muted : '#fff',
                border: 'none', fontSize: 17, fontWeight: 900, cursor: 'pointer',
              }}>
              {extraSaving ? '⏳ กำลังบันทึก...' : '✓ เพิ่มและบันทึก'}
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ── Picking workflow ──────────────────────────────────────────
function PickingWorkflow({ onBack, t }) {
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docLineSummary, setDocLineSummary] = useState({});
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [matchedLine, setMatchedLine] = useState(null);
  const [boxes, setBoxes] = useState('');
  const [weight, setWeight] = useState('');
  const [confirmed, setConfirmed] = useState([]);
  const [sortType, setSortType] = useState('pending');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editWarned, setEditWarned] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [docCompleted, setDocCompleted] = useState(false);

  const { trigger: cameraItem, el: cameraItemEl } = useCameraScanner((v) => handleScan(v));

  useEffect(() => {
    listCustomerWithdrawalRequests({ statusIn: ['ADMIN_ACCEPTED', 'WAREHOUSE_PICKING'] }).then((r) => {
      const loaded = r.data ?? [];
      setDocs(loaded);
      setDocsLoading(false);
      const ids = loaded.map((d) => d.id);
      listWithdrawalLineSummariesForDocs(ids).then((sr) => {
        const map = {};
        (sr.data ?? []).forEach((l) => {
          if (!map[l.withdrawal_request_id]) map[l.withdrawal_request_id] = { lots: [], exps: [] };
          if (l.lot_no) map[l.withdrawal_request_id].lots.push(l.lot_no);
          if (l.exp_date) map[l.withdrawal_request_id].exps.push(l.exp_date);
        });
        setDocLineSummary(map);
      });
    });
  }, []);

  function pickDoc(doc) {
    setSelectedDoc(doc);
    setLinesLoading(true);
    setDocCompleted(false);
    setCompleteError('');
    listCustomerWithdrawalRequestLines(doc.id).then((r) => {
      const mapped = (r.data ?? []).map((l) => ({
        ...l,
        expected_boxes: l.requested_boxes,
        expected_weight: l.requested_weight,
      }));
      setLines(mapped);
      setLinesLoading(false);
      setScanValue(''); setMatchedLine(null);
    });
  }

  function handleScan(val) {
    setScanValue(val);
    setEditWarned(false);
    const q = val.trim().toLowerCase();
    const match = lines.find((l) =>
      (l.customer_product_code ?? '').toLowerCase() === q ||
      (l.product_name ?? '').toLowerCase().includes(q) ||
      (l.lot_no ?? '').toLowerCase() === q,
    );
    if (match) {
      triggerSuccessFeedback();
      setMatchedLine(match);
      setBoxes(match.requested_boxes?.toString() ?? '');
      setWeight(match.requested_weight?.toString() ?? '');
      setEditWarned(false);
    } else { setMatchedLine(null); }
  }

  function isDone(line) {
    return confirmed.some((c) => c.line.id === line.id) || line.picked_at != null;
  }

  async function handleConfirm() {
    if (!matchedLine) return;
    const alreadyDone = isDone(matchedLine);
    if (alreadyDone && !editWarned) {
      setEditWarned(true);
      return;
    }
    setSaving(true);
    setSaveError('');
    const result = await recordWithdrawalLinePick(
      matchedLine.id,
      boxes ? Number(boxes) : null,
      weight ? Number(weight) : null,
    );
    setSaving(false);
    if (result.error) {
      setSaveError(result.error.message ?? 'บันทึกไม่สำเร็จ');
      return;
    }
    triggerSuccessFeedback();
    const confirmedItem = {
      line: matchedLine, boxes, weight,
      confirmedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    };
    setConfirmed((prev) =>
      alreadyDone
        ? prev.map((c) => (c.line.id === matchedLine.id ? confirmedItem : c))
        : [confirmedItem, ...prev]
    );
    setLines((prev) => prev.map((l) => l.id === matchedLine.id
      ? { ...l, picked_boxes: boxes ? Number(boxes) : null, picked_weight: weight ? Number(weight) : null, picked_at: new Date().toISOString() }
      : l));
    setScanValue(''); setMatchedLine(null); setBoxes(''); setWeight(''); setEditWarned(false);
  }

  async function handleCompleteJob() {
    if (!selectedDoc) return;
    setCompleting(true);
    setCompleteError('');
    const result = await reviewCustomerWithdrawalRequest(selectedDoc.id, 'CONFIRM_DISPATCH');
    setCompleting(false);
    if (result.error) {
      setCompleteError(result.error.message ?? 'ปิดใบงานไม่สำเร็จ');
      return;
    }
    triggerSuccessFeedback();
    setDocCompleted(true);
  }

  const doneCount = lines.filter(isDone).length;
  const allDone = lines.length > 0 && doneCount >= lines.length;

  const sortedLines = useMemo(() => {
    return [...lines].sort((a, b) => {
      if (sortType === 'pending') {
        const aDone = confirmed.some((c) => c.line.id === a.id) || a.picked_at != null;
        const bDone = confirmed.some((c) => c.line.id === b.id) || b.picked_at != null;
        if (aDone !== bDone) return aDone ? 1 : -1;
      } else if (sortType === 'name') {
        return (a.product_name ?? '').localeCompare(b.product_name ?? '', 'th');
      } else if (sortType === 'code') {
        return (a.customer_product_code ?? '').localeCompare(b.customer_product_code ?? '');
      }
      return 0;
    });
  }, [lines, sortType, confirmed]);

  if (!selectedDoc) {
    return (
      <div style={{ background: C.bg, minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 720, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <TopBar title="เบิกสินค้าออก" subtitle="เลือกใบงานที่ต้องการ" onBack={onBack} />
        <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
          {(() => {
            const customerOptions = [...new Map(
              docs.map((d) => ({ id: d.customer_id, name: d.customer?.customer_name || d.customer?.name || d.customer_id }))
                .filter((c) => c.id).map((c) => [c.id, c])
            ).values()];
            const filteredDocs = docs.filter((d) => {
              if (filterCustomer && d.customer_id !== filterCustomer) return false;
              const date = d.requested_dispatch_date ?? '';
              if (filterDateFrom && date < filterDateFrom) return false;
              if (filterDateTo && date > filterDateTo) return false;
              return true;
            });
            const hasFilter = filterCustomer || filterDateFrom || filterDateTo;
            return (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
                    style={{ flex: '1 1 160px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 700, color: C.text, outline: 'none' }}>
                    <option value="">ลูกค้าทุกราย</option>
                    {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                    style={{ flex: '1 1 130px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, color: C.text, outline: 'none' }} />
                  <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                    style={{ flex: '1 1 130px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, color: C.text, outline: 'none' }} />
                  {hasFilter && (
                    <button type="button" onClick={() => { setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                      style={{ background: C.blueLight, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: C.textSec, cursor: 'pointer' }}>
                      ล้าง
                    </button>
                  )}
                </div>
                {docsLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontWeight: 700 }}>กำลังโหลด...</div>
                ) : filteredDocs.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '60px 24px',
                    background: C.card, borderRadius: 24, marginTop: 8,
                    border: `1px solid ${C.border}`, boxShadow: C.shadow,
                  }}>
                    <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>{`{ }`}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>{hasFilter ? 'ไม่พบใบงานที่ตรงกับเงื่อนไข' : 'ไม่มีใบงานที่รอหยิบสินค้า'}</div>
                    <div style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>ใบงานสถานะ "หยิบสินค้า" จะปรากฏที่นี่</div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 14, color: C.textSec, fontWeight: 800 }}>พบ {filteredDocs.length} ใบงาน</span>
                    </div>
                    {filteredDocs.map((doc) => {
                      const summary = docLineSummary[doc.id];
                      const uniqueLots = [...new Set(summary?.lots ?? [])];
                      const uniqueExps = [...new Set(summary?.exps ?? [])].sort();
                      return (
                        <DocCard
                          key={doc.id}
                          onClick={() => pickDoc(doc)}
                          docNo={doc.withdrawal_no}
                          statusLabel={getWithdrawalStatusLabel(doc.status, t)}
                          statusColor={C.pickAccent}
                          dateStr={doc.requested_dispatch_date ?? '-'}
                          subText={doc.delivery_type}
                          customerName={doc.customer?.customer_name || doc.customer?.name || null}
                          lotText={uniqueLots.length ? uniqueLots.join(', ') : null}
                          expText={uniqueExps.length ? uniqueExps[0] + (uniqueExps.length > 1 ? ` +${uniqueExps.length - 1}` : '') : null}
                        />
                      );
                    })}
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, display: 'flex', justifyContent: 'center' }}>
    <div style={{ width: '100%', maxWidth: 720, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {cameraItemEl}
      <TopBar
        title={selectedDoc.withdrawal_no}
        subtitle={`✅ ${doneCount}/${lines.length} รายการ`}
        onBack={() => { setSelectedDoc(null); setLines([]); setConfirmed([]); setMatchedLine(null); setScanValue(''); }}
        badge={
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 20,
            padding: '4px 12px', color: '#fff', fontSize: 13, fontWeight: 800,
            border: '1px solid rgba(255,255,255,0.4)',
          }}>
            {doneCount}/{lines.length}
          </div>
        }
      />

      {lines.length > 0 && (
        <div style={{ background: C.primaryDark, height: 6, flexShrink: 0 }}>
          <div style={{
            height: '100%', background: allDone ? C.green : C.pickAccent,
            width: `${(doneCount / lines.length) * 100}%`,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 300px', background: C.bg }}>
        {linesLoading ? (
          <div style={{ textAlign: 'center', color: C.muted, fontWeight: 700, padding: 40 }}>กำลังโหลด...</div>
        ) : (
          <>
            {docCompleted && (
              <div style={{ padding: '16px 20px', background: C.greenLight, borderRadius: 20, border: `2px solid ${C.greenBorder}`, marginBottom: 20, textAlign: 'center' }}>
                <div style={{ color: C.green, fontWeight: 900, fontSize: 18 }}>✓ ปิดใบงานเรียบร้อยแล้ว</div>
                <div style={{ color: C.textSec, fontSize: 13, marginTop: 4 }}>{selectedDoc.withdrawal_no} — สถานะ: เสร็จสิ้น</div>
              </div>
            )}

            {confirmed.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  color: C.pickAccent, fontSize: 13, fontWeight: 800, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: '0.08em'
                }}>
                  จัดแล้วล่าสุด ({confirmed.length})
                </div>
                {confirmed.slice(0, 3).map((item, i) => <ConfirmedChip key={i} item={item} />)}
              </div>
            )}

            <SortDropdown sortType={sortType} setSortType={setSortType} />

            {sortedLines.map((l, i) => {
              const done = isDone(l);
              const pickedLabel = done
                ? `จัดแล้ว${l.picked_boxes != null ? ` · ${l.picked_boxes} กล่อง` : ''}${l.picked_weight != null ? ` / ${Number(l.picked_weight).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} กก.` : ''}`
                : '';
              return (
                <LineListItem key={l.id} line={l} index={i} isDone={done}
                  doneLabel={pickedLabel}
                  onSelect={() => {
                    setMatchedLine(l);
                    setScanValue(l.customer_product_code ?? l.product_name ?? '');
                    setBoxes(l.requested_boxes?.toString() ?? '');
                    setWeight(l.requested_weight?.toString() ?? '');
                    setEditWarned(false);
                    triggerSuccessFeedback();
                  }} />
              );
            })}
          </>
        )}
      </div>

      {/* Action Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 720,
        background: C.surface,
        borderTop: `1px solid ${C.borderLight}`,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.08)',
        padding: '20px 24px 32px',
        zIndex: 100,
        maxHeight: '65vh',
        overflowY: 'auto',
      }}>
        {matchedLine ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ color: C.pickAccent, fontWeight: 900, fontSize: 20 }}>ยืนยันหยิบสินค้า</div>
              <button type="button" onClick={() => { setMatchedLine(null); setScanValue(''); setEditWarned(false); }}
                style={{
                  background: C.border, border: 'none', borderRadius: 16, width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: C.textSec, cursor: 'pointer',
                }}>✕</button>
            </div>

            {/* Product card with requested qty */}
            <div style={{
              background: '#ffffff', borderRadius: 20, padding: '16px', marginBottom: 12,
              border: `2px solid ${C.pickAccent}40`,
            }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 8, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {matchedLine.product_name ?? matchedLine.customer_product_code ?? '—'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, overflowWrap: 'break-word', wordBreak: 'break-all' }}>รหัส {matchedLine.customer_product_code}</span>
                {matchedLine.lot_no && <span style={{ background: '#f3f4f6', color: C.textSec, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>LOT {matchedLine.lot_no}</span>}
              </div>
              <div style={{ background: '#f0f9ff', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, marginBottom: 2 }}>ลูกค้าสั่ง (กล่อง)</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0369a1' }}>{matchedLine.requested_boxes ?? '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, marginBottom: 2 }}>ลูกค้าสั่ง (กก.)</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0369a1' }}>
                    {matchedLine.requested_weight != null
                      ? Number(matchedLine.requested_weight).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '-'}
                  </div>
                </div>
              </div>
            </div>

            {saveError && (
              <div style={{ padding: '12px 16px', background: C.redLight, borderRadius: 16, color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                {saveError}
              </div>
            )}

            {editWarned && (
              <div style={{ padding: '12px 16px', background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 16, marginBottom: 12 }}>
                <div style={{ color: '#92400e', fontWeight: 800, fontSize: 14, marginBottom: 2 }}>⚠ รายการนี้ยืนยันแล้ว</div>
                <div style={{ color: '#78350f', fontSize: 13 }}>กดยืนยันการแก้ไขอีกครั้งเพื่อบันทึกค่าใหม่</div>
              </div>
            )}

            <QtyRow boxes={boxes} setBoxes={setBoxes} weight={weight} setWeight={setWeight} />

            <button type="button" disabled={(!boxes && !weight) || saving} onClick={handleConfirm}
              style={{
                width: '100%', padding: '20px', borderRadius: 20,
                background: (!boxes && !weight) ? C.border : (editWarned ? '#f59e0b' : C.pickAccent),
                color: (!boxes && !weight) ? C.muted : '#ffffff',
                border: 'none', fontSize: 18, fontWeight: 900, cursor: (!boxes && !weight) ? 'not-allowed' : 'pointer',
                boxShadow: (!boxes && !weight) ? 'none' : (editWarned ? '0 8px 24px rgba(245,158,11,0.4)' : '0 8px 24px rgba(9,17,28,0.3)'),
                transition: 'all 0.2s',
              }}>
              {saving ? '⏳ กำลังบันทึก...' : (editWarned ? '⚠ ยืนยันการแก้ไข' : '✓ ยืนยันหยิบสินค้า')}
            </button>
          </div>
        ) : (
          <div>
            {allDone && !docCompleted && (
              <div style={{ marginBottom: 14 }}>
                {completeError && (
                  <div style={{ padding: '12px 16px', background: C.redLight, borderRadius: 16, color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    {completeError}
                  </div>
                )}
                <button type="button" disabled={completing} onClick={handleCompleteJob}
                  style={{
                    width: '100%', padding: '20px', borderRadius: 20,
                    background: completing ? C.border : C.green,
                    color: completing ? C.muted : '#ffffff',
                    border: 'none', fontSize: 18, fontWeight: 900, cursor: completing ? 'not-allowed' : 'pointer',
                    boxShadow: completing ? 'none' : '0 8px 24px rgba(5,150,105,0.4)',
                    transition: 'all 0.2s',
                  }}>
                  {completing ? '⏳ กำลังปิดใบงาน...' : '✓ ปิดใบงาน (หยิบครบแล้ว)'}
                </button>
              </div>
            )}

            {docCompleted && (
              <div style={{ padding: '14px', background: C.greenLight, borderRadius: 16, border: `2px solid ${C.greenBorder}`, marginBottom: 14, textAlign: 'center' }}>
                <div style={{ color: C.green, fontWeight: 900, fontSize: 15 }}>✓ ปิดใบงานเรียบร้อยแล้ว</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                flex: 1, position: 'relative', borderRadius: 20,
                boxShadow: scanValue ? `0 0 0 3px ${C.pickAccent}30` : `0 0 0 3px ${C.borderLight}`,
              }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: C.muted, pointerEvents: 'none' }}>
                  ค้นหา
                </span>
                <input
                  type="text" value={scanValue} onChange={(e) => handleScan(e.target.value)}
                  placeholder="สแกนรหัส หรือ LOT"
                  style={{
                    width: '100%', boxSizing: 'border-box', background: C.surfaceSolid,
                    border: `2px solid ${C.pickAccent}`, borderRadius: 20, padding: '16px 16px 16px 60px',
                    color: C.text, fontSize: 16, fontWeight: 800, outline: 'none',
                  }}
                />
              </div>
              <button type="button" onClick={cameraItem}
                style={{
                  background: C.pickAccent, border: 'none', borderRadius: 20,
                  padding: '16px 20px', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
                }}>
                กล้อง
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ── Location Update workflow ──────────────────────────────────
function LocationUpdateWorkflow({ onBack, t }) {
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docLineSummary, setDocLineSummary] = useState({});
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locZone, setLocZone] = useState('');
  const [locSide, setLocSide] = useState('');
  const [locRow, setLocRow] = useState('');
  const [locLevel, setLocLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [updated, setUpdated] = useState([]);

  function parseLocCode(code) {
    const m = /^(.+)-([LR])-(\d+)-(\d+)$/i.exec(code ?? '');
    return m ? { zone: m[1], side: m[2].toUpperCase(), row: m[3], level: m[4] } : null;
  }
  const parsedLocs = useMemo(() => locations.map((l) => ({ ...l, parsed: parseLocCode(l.code) })), [locations]);
  const useHierarchy = parsedLocs.length > 0 && parsedLocs.every((l) => l.parsed !== null);

  const availableZones = useMemo(() => [...new Set(parsedLocs.filter((l) => l.parsed).map((l) => l.parsed.zone))].sort(), [parsedLocs]);
  const availableSides = useMemo(() => [...new Set(parsedLocs.filter((l) => l.parsed?.zone === locZone).map((l) => l.parsed.side))].sort(), [parsedLocs, locZone]);
  const availableRows = useMemo(() => [...new Set(parsedLocs.filter((l) => l.parsed?.zone === locZone && l.parsed?.side === locSide).map((l) => l.parsed.row))].sort(), [parsedLocs, locZone, locSide]);
  const availableLevels = useMemo(() => [...new Set(parsedLocs.filter((l) => l.parsed?.zone === locZone && l.parsed?.side === locSide && l.parsed?.row === locRow).map((l) => l.parsed.level))].sort(), [parsedLocs, locZone, locSide, locRow]);

  useEffect(() => {
    if (locZone && locSide && locRow && locLevel && useHierarchy) {
      const match = parsedLocs.find((l) => l.parsed.zone === locZone && l.parsed.side === locSide && l.parsed.row === locRow && l.parsed.level === locLevel);
      setSelectedLocation(match ?? null);
    } else if (useHierarchy) {
      setSelectedLocation(null);
    }
  }, [locZone, locSide, locRow, locLevel, parsedLocs, useHierarchy]);

  useEffect(() => {
    listCustomerDepositRequests({ statusIn: ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED'] }).then((r) => {
      const loaded = r.data ?? [];
      setDocs(loaded);
      setDocsLoading(false);
      const ids = loaded.map((d) => d.id);
      listDepositLineSummariesForDocs(ids).then((sr) => {
        const map = {};
        (sr.data ?? []).forEach((l) => {
          if (!map[l.deposit_request_id]) map[l.deposit_request_id] = { lots: [], exps: [] };
          if (l.lot_no) map[l.deposit_request_id].lots.push(l.lot_no);
          if (l.exp_date) map[l.deposit_request_id].exps.push(l.exp_date);
        });
        setDocLineSummary(map);
      });
    });
    getActiveLocations().then(({ data }) => setLocations(data ?? []));
  }, []);

  function pickDoc(doc) {
    setSelectedDoc(doc);
    setLinesLoading(true);
    listCustomerDepositRequestLines(doc.id).then((r) => {
      setLines(r.data ?? []);
      setLinesLoading(false);
      setSelectedLine(null);
    });
  }

  async function handleSaveLocation() {
    if (!selectedLine) return;
    setSaving(true); setSaveError('');
    
    if (selectedLocation?.id) {
      const hasStock = await checkLocationHasInventory(selectedLocation.id);
      if (hasStock) {
        if (!window.confirm('Location นี้มีสินค้าอยู่แล้ว คุณแน่ใจหรือไม่ที่จะจัดเก็บสินค้าเพิ่มที่นี่?')) {
          setSaving(false);
          return;
        }
      }
    }

    const r = await updateDepositLineLocation(selectedLine.id, selectedLocation?.id || null, selectedLine);
    setSaving(false);
    if (r.error) { setSaveError(r.error.message ?? 'บันทึกไม่สำเร็จ'); return; }
    triggerSuccessFeedback();
    setLines((prev) => prev.map((l) => l.id === selectedLine.id ? { ...l, location_id: selectedLocation?.id ?? null } : l));
    setUpdated((prev) => [{ line: selectedLine, location: selectedLocation, at: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setSelectedLine(null); setSelectedLocation(null); setLocZone(''); setLocSide(''); setLocRow(''); setLocLevel('');
  }

  const pendingCount = lines.filter((l) => !l.location_id).length;

  if (!selectedDoc) {
    return (
      <div style={{ background: C.bg, height: '100dvh', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: 720, height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <TopBar title="อัปเดต Location" subtitle="เลือกใบงานที่ต้องการ" onBack={onBack} />
        <div style={{ padding: '16px 10px', flex: 1, overflowY: 'auto' }}>
          {(() => {
            const customerOptions = [...new Map(
              docs.map((d) => ({ id: d.customer_id, name: d.customer?.customer_name || d.customer?.name || d.customer_id }))
                .filter((c) => c.id).map((c) => [c.id, c])
            ).values()];
            const filteredDocs = docs.filter((d) => {
              if (filterCustomer && d.customer_id !== filterCustomer) return false;
              const date = d.expected_arrival_date ?? '';
              if (filterDateFrom && date < filterDateFrom) return false;
              if (filterDateTo && date > filterDateTo) return false;
              return true;
            });
            const hasFilter = filterCustomer || filterDateFrom || filterDateTo;
            return (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
                    style={{ flex: '1 1 160px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 700, color: C.text, outline: 'none' }}>
                    <option value="">ลูกค้าทุกราย</option>
                    {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                    style={{ flex: '1 1 130px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, color: C.text, outline: 'none' }} />
                  <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                    style={{ flex: '1 1 130px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, color: C.text, outline: 'none' }} />
                  {hasFilter && (
                    <button type="button" onClick={() => { setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                      style={{ background: C.blueLight, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: C.textSec, cursor: 'pointer' }}>
                      ล้าง
                    </button>
                  )}
                </div>
                {docsLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontWeight: 700 }}>กำลังโหลด...</div>
                ) : filteredDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 24px', background: C.card, borderRadius: 24, marginTop: 8, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
                    <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>📍</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>{hasFilter ? 'ไม่พบใบงานที่ตรงกับเงื่อนไข' : 'ไม่มีใบงานที่รับแล้ว'}</div>
                    <div style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>ใบงานสถานะ "รับแล้ว" จะปรากฏที่นี่</div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 14, color: C.textSec, fontWeight: 800 }}>พบ {filteredDocs.length} ใบงาน</span>
                    </div>
                    {filteredDocs.map((doc) => {
                      const summary = docLineSummary[doc.id];
                      const uniqueLots = [...new Set(summary?.lots ?? [])];
                      const uniqueExps = [...new Set(summary?.exps ?? [])].sort();
                      return (
                        <DocCard key={doc.id} onClick={() => pickDoc(doc)}
                          docNo={doc.request_no}
                          statusLabel={getDepositStatusLabel(doc.status, t)}
                          statusColor="#6366f1"
                          dateStr={doc.expected_arrival_date ?? '-'}
                          subText={doc.contact_name}
                          customerName={doc.customer?.customer_name || doc.customer?.name || null}
                          lotText={uniqueLots.length ? uniqueLots.join(', ') : null}
                          expText={uniqueExps.length ? uniqueExps[0] + (uniqueExps.length > 1 ? ` +${uniqueExps.length - 1}` : '') : null}
                        />
                      );
                    })}
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, display: 'flex', justifyContent: 'center' }}>
    <div style={{ width: '100%', maxWidth: 720, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar
        title={selectedDoc.request_no}
        subtitle={`📍 รอระบุ Location ${pendingCount}/${lines.length} รายการ`}
        onBack={() => { setSelectedDoc(null); setLines([]); setSelectedLine(null); setUpdated([]); }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 10px 280px', background: C.bg }}>
        {linesLoading ? (
          <div style={{ textAlign: 'center', color: C.muted, fontWeight: 700, padding: 40 }}>กำลังโหลด...</div>
        ) : (
          <>
            {updated.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: C.green, fontSize: 13, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>อัปเดตแล้ว ({updated.length})</div>
                {updated.slice(0, 3).map((item, i) => (
                  <div key={i} style={{ background: C.greenLight, borderRadius: 14, padding: '10px 14px', marginBottom: 8, border: `1px solid ${C.greenBorder}`, fontSize: 13 }}>
                    <span style={{ fontWeight: 800, color: C.green }}>✓ {item.line.product_name}</span>
                    {' → '}
                    <span style={{ color: C.textSec }}>{item.location?.code ?? 'ไม่ระบุ'}</span>
                    <span style={{ color: C.muted, marginLeft: 8 }}>{item.at}</span>
                  </div>
                ))}
              </div>
            )}

            {lines.map((l, i) => {
              const hasloc = !!l.location_id;
              return (
                <div key={l.id}
                  onClick={() => { setSelectedLine(l); setSelectedLocation(null); setLocZone(''); setLocSide(''); setLocRow(''); setLocLevel(''); }}
                  style={{
                    background: hasloc ? C.greenLight : C.surface,
                    border: `2px solid ${hasloc ? C.greenBorder : (selectedLine?.id === l.id ? '#6366f1' : C.border)}`,
                    borderRadius: 18, padding: '24px 16px', marginBottom: 12,
                    cursor: 'pointer',
                    boxShadow: C.shadow, transition: 'border-color 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 2 }}>{l.product_name ?? l.customer_product_code}</div>
                      <div style={{ fontSize: 12, color: C.textSec }}>LOT: {l.lot_no ?? '-'} · รับจริง: {l.actual_boxes ?? l.expected_boxes ?? '-'} กล่อง · วันที่รับ: {selectedDoc.expected_arrival_date ?? '-'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {hasloc ? (
                        <span style={{ color: C.green, fontWeight: 900, fontSize: 13 }}>✓ {locations.find((loc) => loc.id === l.location_id)?.code ?? l.location_id}</span>
                      ) : (
                        <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 13 }}>📍 ระบุ Location</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {selectedLine && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 720,
          background: C.surface, borderTop: `1px solid ${C.borderLight}`,
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          boxShadow: '0 -10px 40px rgba(0,0,0,0.08)',
          padding: '20px 10px 32px',
          zIndex: 100, maxHeight: '80vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>ระบุ Location</div>
            <button type="button" onClick={() => setSelectedLine(null)}
              style={{ background: C.border, border: 'none', borderRadius: 16, width: 36, height: 36, fontSize: 20, color: C.textSec, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ background: C.blueLight, borderRadius: 14, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
            <div style={{ fontWeight: 800, color: C.text }}>{selectedLine.product_name}</div>
            <div style={{ color: C.textSec, marginTop: 2 }}>LOT: {selectedLine.lot_no ?? '-'} · รับจริง: {selectedLine.actual_boxes ?? selectedLine.expected_boxes ?? '-'} กล่อง {selectedLine.actual_weight != null ? `· ${selectedLine.actual_weight} กก.` : ''}</div>
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>ยอดรับไม่สามารถแก้ไขได้</div>
          </div>

          {saveError && (
            <div style={{ padding: '12px 16px', background: C.redLight, borderRadius: 16, color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{saveError}</div>
          )}

          {locations.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.textSec, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                📍 เลือก Location จัดเก็บ
                {selectedLocation && <span style={{ marginLeft: 8, color: C.green, fontWeight: 900 }}>✓ {selectedLocation.code}</span>}
              </div>
              {useHierarchy ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>ห้อง / โซน</div>
                    <select value={locZone} onChange={(e) => { setLocZone(e.target.value); setLocSide(''); setLocRow(''); setLocLevel(''); }}
                      style={{ width: '100%', boxSizing: 'border-box', background: C.inputBg, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 8px', fontSize: 14, fontWeight: 700, color: C.text, outline: 'none', minHeight: 48 }}>
                      <option value="">— เลือก —</option>
                      {availableZones.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>ฝั่ง</div>
                    <select value={locSide} onChange={(e) => { setLocSide(e.target.value); setLocRow(''); setLocLevel(''); }}
                      disabled={!locZone}
                      style={{ width: '100%', boxSizing: 'border-box', background: locZone ? C.inputBg : C.borderLight, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 8px', fontSize: 14, fontWeight: 700, color: locZone ? C.text : C.muted, outline: 'none', minHeight: 48 }}>
                      <option value="">— เลือก —</option>
                      {availableSides.map((s) => <option key={s} value={s}>{s === 'L' ? 'ซ้าย (L)' : 'ขวา (R)'}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>แถว</div>
                    <select value={locRow} onChange={(e) => { setLocRow(e.target.value); setLocLevel(''); }}
                      disabled={!locSide}
                      style={{ width: '100%', boxSizing: 'border-box', background: locSide ? C.inputBg : C.borderLight, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 8px', fontSize: 14, fontWeight: 700, color: locSide ? C.text : C.muted, outline: 'none', minHeight: 48 }}>
                      <option value="">— เลือก —</option>
                      {availableRows.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>ชั้น</div>
                    <select value={locLevel} onChange={(e) => setLocLevel(e.target.value)}
                      disabled={!locRow}
                      style={{ width: '100%', boxSizing: 'border-box', background: locRow ? C.inputBg : C.borderLight, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 8px', fontSize: 14, fontWeight: 700, color: locRow ? C.text : C.muted, outline: 'none', minHeight: 48 }}>
                      <option value="">— เลือก —</option>
                      {availableLevels.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {locations.map((loc) => {
                    const isSel = selectedLocation?.id === loc.id;
                    return (
                      <button key={loc.id} type="button" onClick={() => setSelectedLocation(isSel ? null : loc)}
                        style={{ padding: '10px 14px', borderRadius: 14, border: `2px solid ${isSel ? C.green : C.border}`, background: isSel ? C.greenLight : C.surfaceSolid, color: isSel ? C.green : C.textSec, fontSize: 14, fontWeight: isSel ? 800 : 600, cursor: 'pointer' }}>
                        {loc.sectionCode} · {loc.code}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>ไม่มีข้อมูล Location ในระบบ</div>
          )}

          <button type="button" disabled={!selectedLocation || saving} onClick={handleSaveLocation}
            style={{
              width: '100%', padding: '20px', borderRadius: 20,
              background: !selectedLocation ? C.border : '#6366f1',
              color: !selectedLocation ? C.muted : '#fff',
              border: 'none', fontSize: 18, fontWeight: 900, cursor: !selectedLocation ? 'not-allowed' : 'pointer',
              boxShadow: !selectedLocation ? 'none' : '0 8px 24px rgba(99,102,241,0.4)',
              transition: 'all 0.2s',
            }}>
            {saving ? '⏳ กำลังบันทึก...' : '📍 บันทึก Location'}
          </button>
        </div>
      )}
    </div>
    </div>
  );
}

// ── Mode select home ──────────────────────────────────────────
function ModeSelect({ onSelect }) {
  const { activeProfile, logout } = useHandheldAuth();
  
  return (
    <div style={{ background: C.bg, minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
    <div data-testid="handheld-page" style={{ width: '100%', maxWidth: 720, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header - matches app sidebar branding */}
      <div style={{
        background: C.headerBg,
        padding: '24px 28px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <div>
          <div style={{ color: C.gold, fontWeight: 900, fontSize: 22, letterSpacing: '-0.01em' }}>
            TGC Cold Storage
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 3, fontWeight: 600 }}>
            {activeProfile ? `${activeProfile.displayName || activeProfile.email}` : 'Handheld Scanner'}
          </div>
        </div>

        {activeProfile && (
          <button type="button" onClick={logout} style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10,
            padding: '8px 16px',
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}>
            ออกระบบ
          </button>
        )}
      </div>

      <div style={{ flex: 1, padding: '32px 28px 40px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ color: C.muted, fontSize: 13, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 24, paddingLeft: 4 }}>
          เลือกโหมดการทำงาน
        </div>

        {/* Receive button */}
        <button type="button" onClick={() => onSelect('receive')}
          style={{
            display: 'flex', alignItems: 'center', gap: 16,
            width: '100%', boxSizing: 'border-box',
            background: C.surface, border: `2px solid ${C.border}`,
            borderRadius: 20, padding: '28px 24px',
            textAlign: 'left', cursor: 'pointer', color: C.text,
            marginBottom: 16, overflow: 'hidden',
            boxShadow: C.shadow,
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = `0 4px 16px rgba(212,175,55,0.25)`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = C.shadow; }}
          >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>รับเข้า (Receiving)</div>
            <div style={{ fontSize: 13, color: C.textSec, fontWeight: 600, lineHeight: 1.5 }}>รับสินค้าเข้าคลังตามใบงาน</div>
          </div>
        </button>

        {/* Pick button */}
        <button type="button" onClick={() => onSelect('pick')}
          style={{
            display: 'flex', alignItems: 'center', gap: 16,
            width: '100%', boxSizing: 'border-box',
            background: C.surface, border: `2px solid ${C.border}`,
            borderRadius: 20, padding: '28px 24px',
            textAlign: 'left', cursor: 'pointer', color: C.text,
            marginBottom: 16, overflow: 'hidden',
            boxShadow: C.shadow,
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = `0 4px 16px rgba(212,175,55,0.25)`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = C.shadow; }}
          >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>เบิกออก (Picking)</div>
            <div style={{ fontSize: 13, color: C.textSec, fontWeight: 600, lineHeight: 1.5 }}>หยิบสินค้าตามใบขอเบิก</div>
          </div>
        </button>

        {/* Location Update button */}
        <button type="button" onClick={() => onSelect('location')}
          style={{
            display: 'flex', alignItems: 'center', gap: 16,
            width: '100%', boxSizing: 'border-box',
            background: C.surface, border: `2px solid ${C.border}`,
            borderRadius: 20, padding: '28px 24px',
            textAlign: 'left', cursor: 'pointer', color: C.text,
            marginBottom: 36, overflow: 'hidden',
            boxShadow: C.shadow,
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = `0 4px 16px rgba(99,102,241,0.25)`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = C.shadow; }}
          >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>📍 ระบุที่จัดเก็บ (Location)</div>
            <div style={{ fontSize: 13, color: C.textSec, fontWeight: 600, lineHeight: 1.5 }}>ระบุตำแหน่งสินค้าที่รับเข้าแล้ว</div>
          </div>
        </button>

        {/* Tip card */}
        <div style={{
          background: C.surfaceSolid, borderRadius: 20,
          border: `1px solid ${C.border}`,
          padding: '20px',
          boxShadow: C.shadow,
        }}>
          <div style={{ color: C.primaryDark, fontSize: 14, fontWeight: 900, marginBottom: 12 }}>
            วิธีใช้งาน
          </div>
          {[
            ['1', 'เลือกโหมดการทำงาน → เลือกใบงาน'],
            ['2', 'สแกนบาร์โค้ด หรือเลือกสินค้าจากรายการ'],
            ['3', 'กรอกจำนวนที่รับ/หยิบ → กดยืนยัน'],
          ].map(([num, text]) => (
            <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: C.blueLight, color: C.primaryDark,
                fontSize: 12, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{num}</div>
              <span style={{ color: C.textSec, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────
function HandheldApp() {
  const t = useTranslation();
  const [mode, setMode] = useState(null);
  const { activeProfile, isLoading } = useHandheldAuth();

  if (isLoading) return <div data-testid="handheld-page" style={{ padding: 40, textAlign: 'center', fontWeight: 700 }}>กำลังโหลด...</div>;
  if (!activeProfile) return <div data-testid="handheld-page" style={{ minHeight: '100dvh', background: '#f8fafb', display: 'flex', justifyContent: 'center' }}><HandheldLoginPage /></div>;

  if (mode === 'receive') return <ReceivingWorkflow onBack={() => setMode(null)} t={t} />;
  if (mode === 'pick') return <PickingWorkflow onBack={() => setMode(null)} t={t} />;
  if (mode === 'location') return <LocationUpdateWorkflow onBack={() => setMode(null)} t={t} />;
  return <ModeSelect onSelect={setMode} />;
}

export function HandheldPage() {
  return (
    <HandheldProvider>
      <HandheldApp />
    </HandheldProvider>
  );
}
