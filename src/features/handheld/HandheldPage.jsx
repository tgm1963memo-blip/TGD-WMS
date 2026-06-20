import { useEffect, useRef, useState, useMemo } from 'react';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { getWithdrawalStatusLabel } from '../../utils/customerWithdrawalStatusLabels.js';
import {
  listCustomerDepositRequests,
  listCustomerDepositRequestLines,
  recordDepositLineActualReceipt,
} from '../../services/customerDepositRequestService.js';
import {
  listCustomerWithdrawalRequests,
  listCustomerWithdrawalRequestLines,
} from '../../services/customerWithdrawalRequestService.js';
import { getActiveLocations } from '../../services/warehouseLayoutService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { HandheldProvider, useHandheldAuth } from './HandheldContext.jsx';
import { HandheldLoginPage } from './HandheldLoginPage.jsx';

// ── Theme tokens (Minimalist Elegant) ───────────
const C = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceSolid: '#ffffff',
  card: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  shadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
  shadowMd: '0 8px 30px rgba(15, 23, 42, 0.08)',
  primary: '#0f172a',
  primaryDark: '#020617',
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
  headerGrad: '#ffffff',
  receiveAccent: '#0f172a',
  pickAccent: '#0f172a',
  glassmorphism: {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
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
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats: ['code_128', 'qr_code', 'code_39', 'ean_13', 'ean_8'] });
      const img = new Image();
      img.onload = async () => {
        try {
          const codes = await detector.detect(img);
          if (codes.length) onScanned(codes[0].rawValue);
          else alert('ไม่พบบาร์โค้ดในภาพ');
        } catch { alert('ไม่สามารถอ่านบาร์โค้ดได้'); }
      };
      img.src = URL.createObjectURL(file);
    } else {
      alert('เบราว์เซอร์นี้ไม่รองรับ BarcodeDetector');
    }
    e.target.value = '';
  }

  const el = (
    <input ref={inputRef} type="file" accept="image/*" capture="environment"
      style={{ display: 'none' }} onChange={handleCapture} />
  );
  return { trigger, el };
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
function TopBar({ title, subtitle, onBack, badge, gradient = true }) {
  return (
    <div style={{
      background: gradient ? C.headerGrad : C.surface,
      borderBottom: gradient ? 'none' : `1px solid ${C.border}`,
      padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      boxShadow: gradient ? '0 4px 20px rgba(37,99,235,0.2)' : 'none',
    }}>
      {onBack && (
        <button type="button" onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
            color: '#ffffff', fontSize: 20, cursor: 'pointer',
            width: 40, height: 40, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
          ←
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: C.text,
          fontWeight: 800, fontSize: 18,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        {subtitle && (
          <div style={{ color: C.textSec, fontSize: 13, marginTop: 2, fontWeight: 600 }}>
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
        <div style={{ color: C.text, fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
        display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
        background: isDone ? C.surfaceSolid : C.card,
        border: `1px solid ${isDone ? C.greenBorder : C.border}`,
        borderRadius: 16, padding: '16px 16px', marginBottom: 10,
        cursor: 'pointer', color: C.text,
        boxShadow: isDone ? 'none' : C.shadow,
        transition: 'transform 0.2s, box-shadow 0.2s',
        borderLeft: `5px solid ${isDone ? C.green : C.primary}`,
        opacity: isDone ? 0.7 : 1,
      }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: isDone ? C.green : C.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 15, fontWeight: 800,
      }}>
        {isDone ? '✓' : index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
          {line.product_name ?? line.customer_product_code}
        </div>
        <div style={{ fontSize: 13, color: C.textSec, marginTop: 4, fontWeight: 500 }}>
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
function DocCard({ onClick, docNo, statusLabel, statusColor, dateStr, subText }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 20, padding: '20px 20px', marginBottom: 12,
        cursor: 'pointer', color: C.text,
        boxShadow: C.shadow,
        borderLeft: `6px solid ${statusColor}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{
          fontFamily: 'monospace', fontWeight: 900, fontSize: 17, color: C.text, letterSpacing: '0.02em',
        }}>{docNo}</span>
        <Pill label={statusLabel} color={statusColor} />
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: C.textSec, fontWeight: 500 }}>📅 {dateStr}</span>
        {subText && <span style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>· {subText}</span>}
      </div>
    </button>
  );
}

// ── Sort Control ──────────────────────────────────────────────
function SortDropdown({ sortType, setSortType }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ color: C.textSec, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        รายการสินค้า
      </div>
      <select
        value={sortType}
        onChange={(e) => setSortType(e.target.value)}
        style={{
          background: C.surfaceSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 700,
          color: C.primaryDark,
          outline: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <option value="pending">เรียงตาม สถานะการทำ (ยังไม่ทำขึ้นก่อน)</option>
        <option value="name">เรียงตาม ชื่อสินค้า (ก-ฮ)</option>
        <option value="code">เรียงตาม รหัสสินค้า (A-Z)</option>
      </select>
    </div>
  );
}

// ── Receiving workflow ────────────────────────────────────────
function ReceivingWorkflow({ onBack, t }) {
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [matchedLine, setMatchedLine] = useState(null);
  const [boxes, setBoxes] = useState('');
  const [weight, setWeight] = useState('');
  const [palletScan, setPalletScan] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [confirmed, setConfirmed] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sortType, setSortType] = useState('pending');

  const { trigger: cameraItem, el: cameraItemEl } = useCameraScanner((v) => handleScan(v));
  const { trigger: cameraPallet, el: cameraPalletEl } = useCameraScanner((v) => setPalletScan(v));

  useEffect(() => {
    listCustomerDepositRequests({ statusIn: ['WAREHOUSE_RECEIVING', 'ADMIN_ACCEPTED'] }).then((r) => {
      setDocs(r.data ?? []);
      setDocsLoading(false);
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
    } else {
      setMatchedLine(null);
    }
  }

  async function handleConfirm() {
    if (!matchedLine) return;
    setSaving(true); setSaveError('');
    const r = await recordDepositLineActualReceipt(matchedLine.id, { actualBoxes: boxes, actualWeight: weight, note: null });
    setSaving(false);
    if (r.error) { setSaveError(r.error.message ?? 'บันทึกไม่สำเร็จ'); return; }

    triggerSuccessFeedback();
    setConfirmed((prev) => [{
      line: matchedLine, boxes, weight, palletId: palletScan, location: selectedLocation,
      confirmedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }, ...prev]);
    setLines((prev) => prev.map((l) => l.id === matchedLine.id
      ? { ...l, actual_boxes: Number(boxes) || null, actual_weight: Number(weight) || null } : l));

    setScanValue(''); setMatchedLine(null); setBoxes(''); setWeight(''); setPalletScan(''); setSelectedLocation(null);
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
    return (
      <div data-testid="handheld-page" style={{ background: C.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <TopBar title="รับสินค้าเข้า" subtitle="เลือกใบงานที่ต้องการ" onBack={onBack} />
        <div style={{ padding: '24px 20px', flex: 1, overflowY: 'auto' }}>
          {docsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontWeight: 700 }}>กำลังโหลด...</div>
          ) : docs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: C.card, borderRadius: 24, marginTop: 8,
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
            }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>{`{ }`}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>ไม่มีใบงานที่รอรับสินค้า</div>
              <div style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>ใบงานสถานะ "รับเข้าคลัง" จะปรากฏที่นี่</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: C.textSec, fontWeight: 800 }}>พบ {docs.length} ใบงาน</span>
              </div>
              {docs.map((doc) => (
                <DocCard
                  key={doc.id}
                  onClick={() => pickDoc(doc)}
                  docNo={doc.request_no}
                  statusLabel={getDepositStatusLabel(doc.status, t)}
                  statusColor={doc.status === 'ADMIN_ACCEPTED' ? C.receiveAccent : C.green}
                  dateStr={doc.expected_arrival_date ?? '-'}
                  subText={doc.contact_name}
                />
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="handheld-page" style={{ background: C.bg, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {cameraItemEl}{cameraPalletEl}

      <TopBar
        title={selectedDoc.request_no}
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
            height: '100%', background: C.green,
            width: `${(doneCount / lines.length) * 100}%`,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 220px', background: C.bg }}>
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
                  triggerSuccessFeedback();
                }} />
            ))}
          </>
        )}
      </div>

      {/* Bottom Thumb Zone Action Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surface,
        ...C.glassmorphism,
        borderTop: `1px solid ${C.borderLight}`,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.08)',
        padding: '24px 20px 32px',
        transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: matchedLine ? 'translateY(0)' : 'translateY(0)',
        zIndex: 100,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {matchedLine ? (
          <div style={{ flex: 1, overflowY: 'auto', margin: '-24px -20px -32px', padding: '24px 20px 32px' }}>
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
              background: '#ffffff', borderRadius: 20, padding: '16px', marginBottom: 16,
              border: `2px solid ${C.primary}40`,
            }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
                {matchedLine.product_name ?? matchedLine.customer_product_code ?? '—'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: C.blueLight, color: C.primaryDark, borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>รหัส {matchedLine.customer_product_code}</span>
                {matchedLine.lot_no && <span style={{ background: '#f0fdf4', color: C.green, borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>LOT {matchedLine.lot_no}</span>}
              </div>
            </div>

            {saveError && (
              <div style={{ padding: '12px 16px', background: C.redLight, borderRadius: 16, color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                {saveError}
              </div>
            )}

            <QtyRow boxes={boxes} setBoxes={setBoxes} weight={weight} setWeight={setWeight} />

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.textSec, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Pallet ID (ถ้ามี)</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <input type="text" value={palletScan} onChange={(e) => setPalletScan(e.target.value)}
                  placeholder="สแกนหรือพิมพ์ Pallet ID"
                  style={{
                    flex: 1, background: C.inputBg,
                    border: `2px solid ${palletScan ? C.primary : C.border}`,
                    borderRadius: 16, padding: '14px 16px', color: C.text, fontSize: 15, fontWeight: 700, outline: 'none',
                  }} />
                <button type="button" onClick={cameraPallet}
                  style={{
                    background: C.primary, border: 'none', borderRadius: 16,
                    padding: '0 20px', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
                  }}>สแกน</button>
              </div>
            </div>

            {locations.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: C.textSec, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📍 เลือก Location จัดเก็บ</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {locations.map((loc) => {
                    const isSelected = selectedLocation?.id === loc.id;
                    return (
                      <button
                        key={loc.id} type="button"
                        onClick={() => setSelectedLocation(isSelected ? null : loc)}
                        style={{
                          padding: '10px 14px',
                          border: `2px solid ${isSelected ? C.green : C.border}`,
                          borderRadius: 14,
                          background: isSelected ? C.greenLight : C.surfaceSolid,
                          color: isSelected ? C.green : C.textSec,
                          fontSize: 14, fontWeight: isSelected ? 800 : 600,
                          cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        {loc.sectionCode} · {loc.code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button type="button" disabled={(!boxes && !weight) || saving} onClick={handleConfirm}
              style={{
                width: '100%', padding: '20px', borderRadius: 20,
                background: (!boxes && !weight) ? C.border : C.green,
                color: (!boxes && !weight) ? C.muted : '#ffffff',
                border: 'none', fontSize: 18, fontWeight: 900, cursor: 'pointer',
                boxShadow: (!boxes && !weight) ? 'none' : '0 8px 24px rgba(16,185,129,0.4)',
                transition: 'all 0.2s',
              }}>
              {saving ? '⏳ กำลังบันทึก...' : '✓ ยืนยันรับสินค้า'}
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
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [matchedLine, setMatchedLine] = useState(null);
  const [boxes, setBoxes] = useState('');
  const [weight, setWeight] = useState('');
  const [confirmed, setConfirmed] = useState([]);
  const [sortType, setSortType] = useState('pending');

  const { trigger: cameraItem, el: cameraItemEl } = useCameraScanner((v) => handleScan(v));

  useEffect(() => {
    listCustomerWithdrawalRequests({ statusIn: ['ADMIN_ACCEPTED', 'WAREHOUSE_PICKING'] }).then((r) => {
      setDocs(r.data ?? []);
      setDocsLoading(false);
    });
  }, []);

  function pickDoc(doc) {
    setSelectedDoc(doc);
    setLinesLoading(true);
    listCustomerWithdrawalRequestLines(doc.id).then((r) => {
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
      setBoxes(match.requested_boxes?.toString() ?? '');
      setWeight(match.requested_qty?.toString() ?? '');
    } else { setMatchedLine(null); }
  }

  function handleConfirm() {
    if (!matchedLine) return;
    triggerSuccessFeedback();
    setConfirmed((prev) => [{
      line: matchedLine, boxes, weight,
      confirmedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }, ...prev]);
    setScanValue(''); setMatchedLine(null); setBoxes(''); setWeight('');
  }

  const doneCount = confirmed.length;

  const sortedLines = useMemo(() => {
    return [...lines].sort((a, b) => {
      if (sortType === 'pending') {
        const aDone = confirmed.some(c => c.line.id === a.id);
        const bDone = confirmed.some(c => c.line.id === b.id);
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
  }, [lines, sortType, confirmed]);

  if (!selectedDoc) {
    return (
      <div style={{ background: C.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <TopBar title="เบิกสินค้าออก" subtitle="เลือกใบงานที่ต้องการ" onBack={onBack} />
        <div style={{ padding: '24px 20px', flex: 1, overflowY: 'auto' }}>
          {docsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontWeight: 700 }}>กำลังโหลด...</div>
          ) : docs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: C.card, borderRadius: 24, marginTop: 8,
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
            }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>{`{ }`}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>ไม่มีใบงานที่รอหยิบสินค้า</div>
              <div style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>ใบงานสถานะ "หยิบสินค้า" จะปรากฏที่นี่</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: C.textSec, fontWeight: 800 }}>พบ {docs.length} ใบงาน</span>
              </div>
              {docs.map((doc) => (
                <DocCard
                  key={doc.id}
                  onClick={() => pickDoc(doc)}
                  docNo={doc.withdrawal_no}
                  statusLabel={getWithdrawalStatusLabel(doc.status, t)}
                  statusColor={C.pickAccent}
                  dateStr={doc.requested_dispatch_date ?? '-'}
                  subText={doc.delivery_type}
                />
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            height: '100%', background: C.pickAccent,
            width: `${(doneCount / lines.length) * 100}%`,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 220px', background: C.bg }}>
        {linesLoading ? (
          <div style={{ textAlign: 'center', color: C.muted, fontWeight: 700, padding: 40 }}>กำลังโหลด...</div>
        ) : (
          <>
            {confirmed.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  color: C.pickAccent, fontSize: 13, fontWeight: 800, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: '0.08em'
                }}>
                  หยิบแล้วล่าสุด ({confirmed.length})
                </div>
                {confirmed.slice(0, 3).map((item, i) => <ConfirmedChip key={i} item={item} />)}
              </div>
            )}

            <SortDropdown sortType={sortType} setSortType={setSortType} />

            {sortedLines.map((l, i) => {
              const done = confirmed.some((c) => c.line.id === l.id);
              return (
                <LineListItem key={l.id} line={l} index={i} isDone={done}
                  doneLabel={done ? 'หยิบแล้ว' : ''}
                  onSelect={() => {
                    setMatchedLine(l);
                    setScanValue(l.customer_product_code ?? l.product_name ?? '');
                    setBoxes(l.requested_boxes?.toString() ?? '');
                    setWeight(l.requested_qty?.toString() ?? '');
                    triggerSuccessFeedback();
                  }} />
              );
            })}
          </>
        )}
      </div>

      {/* Bottom Thumb Zone Action Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surface,
        ...C.glassmorphism,
        borderTop: `1px solid ${C.borderLight}`,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.08)',
        padding: '24px 20px 32px',
        transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: matchedLine ? 'translateY(0)' : 'translateY(0)',
        zIndex: 100,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {matchedLine ? (
          <div style={{ flex: 1, overflowY: 'auto', margin: '-24px -20px -32px', padding: '24px 20px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ color: C.pickAccent, fontWeight: 900, fontSize: 20 }}>ยืนยันหยิบสินค้า</div>
              <button type="button" onClick={() => { setMatchedLine(null); setScanValue(''); }}
                style={{
                  background: C.border, border: 'none', borderRadius: 16, width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: C.textSec, cursor: 'pointer',
                }}>✕</button>
            </div>

            <div style={{
              background: '#ffffff', borderRadius: 20, padding: '16px', marginBottom: 16,
              border: `2px solid ${C.pickAccent}40`,
            }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
                {matchedLine.product_name ?? matchedLine.customer_product_code ?? '—'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>รหัส {matchedLine.customer_product_code}</span>
                {matchedLine.lot_no && <span style={{ background: '#f3f4f6', color: C.textSec, borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>LOT {matchedLine.lot_no}</span>}
              </div>
            </div>

            <QtyRow boxes={boxes} setBoxes={setBoxes} weight={weight} setWeight={setWeight} />

            <button type="button" disabled={!boxes && !weight} onClick={handleConfirm}
              style={{
                width: '100%', padding: '20px', borderRadius: 20,
                background: (!boxes && !weight) ? C.border : C.pickAccent,
                color: (!boxes && !weight) ? C.muted : '#ffffff',
                border: 'none', fontSize: 18, fontWeight: 900, cursor: 'pointer',
                boxShadow: (!boxes && !weight) ? 'none' : '0 8px 24px rgba(245,158,11,0.4)',
                transition: 'all 0.2s',
              }}>
              ✓ ยืนยันหยิบสินค้า
            </button>
          </div>
        ) : (
          <div>
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
  );
}

// ── Mode select home ──────────────────────────────────────────
function ModeSelect({ onSelect }) {
  const { activeProfile, logout } = useHandheldAuth();
  
  return (
    <div data-testid="handheld-page" style={{ background: C.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: C.surface,
        padding: '32px 24px 24px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ color: C.primaryDark, fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em' }}>
            TGC Handheld
          </div>
          <div style={{ color: C.textSec, fontSize: 14, marginTop: 4, fontWeight: 600 }}>
            {activeProfile ? `👤 ${activeProfile.displayName || activeProfile.email}` : 'Cold Storage Scanner'}
          </div>
        </div>
        
        {activeProfile && (
          <button type="button" onClick={logout} style={{
            background: C.blueLight,
            border: 'none',
            borderRadius: 12,
            padding: '8px 16px',
            color: C.text,
            fontWeight: 700,
            cursor: 'pointer'
          }}>
            ออกระบบ
          </button>
        )}
      </div>

      <div style={{ flex: 1, padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ color: C.muted, fontSize: 13, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 24, paddingLeft: 4 }}>
          เลือกโหมดการทำงาน
        </div>

        {/* Receive button */}
        <button type="button" onClick={() => onSelect('receive')}
          style={{
            display: 'block', width: '100%',
            background: C.surface, border: `1px solid ${C.primary}`,
            borderRadius: 16, padding: '24px',
            textAlign: 'left', cursor: 'pointer', color: C.text,
            marginBottom: 16,
            boxShadow: `4px 4px 0px ${C.primary}`,
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = `2px 2px 0px ${C.primary}`; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `4px 4px 0px ${C.primary}`; }}
          >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 4 }}>รับเข้า (Receiving)</div>
              <div style={{ fontSize: 14, color: C.textSec, fontWeight: 600 }}>รับสินค้าเข้าคลังตามใบงาน</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.primary }}>→</div>
          </div>
        </button>

        {/* Pick button */}
        <button type="button" onClick={() => onSelect('pick')}
          style={{
            display: 'block', width: '100%',
            background: C.surface, border: `1px solid ${C.primary}`,
            borderRadius: 16, padding: '24px',
            textAlign: 'left', cursor: 'pointer', color: C.text,
            marginBottom: 32,
            boxShadow: `4px 4px 0px ${C.primary}`,
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = `2px 2px 0px ${C.primary}`; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `4px 4px 0px ${C.primary}`; }}
          >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 4 }}>เบิกออก (Picking)</div>
              <div style={{ fontSize: 14, color: C.textSec, fontWeight: 600 }}>หยิบสินค้าตามใบขอเบิก</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.primary }}>→</div>
          </div>
        </button>

        {/* Pick button */}
        <button type="button" onClick={() => onSelect('pick')}
          style={{
            display: 'block', width: '100%',
            background: C.surface, ...C.glassmorphism, border: `1px solid ${C.border}`,
            borderRadius: 24, padding: '24px 20px',
            textAlign: 'left', cursor: 'pointer', color: C.text,
            marginBottom: 32,
            boxShadow: `0 8px 30px rgba(245,158,11,0.1)`,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, flexShrink: 0,
            }}>📤</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 6 }}>เบิกสินค้าออก</div>
              <div style={{ fontSize: 14, color: C.textSec, fontWeight: 500 }}>สแกนและหยิบสินค้า</div>
              <div style={{ fontSize: 14, color: C.textSec, fontWeight: 500, marginTop: 2 }}>ตามใบขอเบิก</div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#fef3c7', color: C.amber,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, flexShrink: 0,
            }}>›</div>
          </div>
        </button>

        {/* Tip card */}
        <div style={{
          background: C.surfaceSolid, borderRadius: 20,
          border: `1px solid ${C.border}`,
          padding: '20px',
          boxShadow: C.shadow,
        }}>
          <div style={{ color: C.primaryDark, fontSize: 14, fontWeight: 900, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span> วิธีใช้งาน
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
  );
}

// ── Main Layout ───────────────────────────────────────────────
function HandheldApp() {
  const t = useTranslation();
  const [mode, setMode] = useState(null);
  const { activeProfile, isLoading } = useHandheldAuth();

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', fontWeight: 700 }}>กำลังโหลด...</div>;
  if (!activeProfile) return <HandheldLoginPage />;

  if (mode === 'receive') return <ReceivingWorkflow onBack={() => setMode(null)} t={t} />;
  if (mode === 'pick') return <PickingWorkflow onBack={() => setMode(null)} t={t} />;
  return <ModeSelect onSelect={setMode} />;
}

export function HandheldPage() {
  return (
    <HandheldProvider>
      <HandheldApp />
    </HandheldProvider>
  );
}
