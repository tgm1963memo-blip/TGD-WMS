import { useEffect, useRef, useState } from 'react';
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

// ── Theme tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: '#f0f4f8',
  surface: '#ffffff',
  card: '#ffffff',
  border: '#e2e8f0',
  shadow: '0 2px 12px rgba(0,0,0,0.08)',
  shadowMd: '0 4px 20px rgba(37,99,235,0.12)',
  primary: '#2563eb',
  primaryDark: '#1e3a8a',
  amber: '#f59e0b',
  green: '#16a34a',
  greenLight: '#dcfce7',
  greenBorder: '#bbf7d0',
  red: '#dc2626',
  redLight: '#fee2e2',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  text: '#1e293b',
  textSec: '#475569',
  muted: '#94a3b8',
  inputBg: '#ffffff',
  headerGrad: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
  receiveAccent: '#2563eb',
  pickAccent: '#f59e0b',
};

// ── Camera barcode scanner ────────────────────────────────────────────────────
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

// ── Status pill ───────────────────────────────────────────────────────────────
function Pill({ label, color = C.primary, bg }) {
  return (
    <span style={{
      background: bg ?? (color + '18'),
      color,
      border: `1px solid ${color}33`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar({ title, subtitle, onBack, badge, gradient = true }) {
  return (
    <div style={{
      background: gradient ? C.headerGrad : C.surface,
      borderBottom: gradient ? 'none' : `1px solid ${C.border}`,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      boxShadow: gradient ? '0 2px 12px rgba(37,99,235,0.25)' : 'none',
    }}>
      {onBack && (
        <button type="button" onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)',
            color: '#ffffff', fontSize: 18, cursor: 'pointer',
            lineHeight: 1, padding: '6px 10px', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          ←
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: gradient ? '#ffffff' : C.text,
          fontWeight: 800, fontSize: 16,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        {subtitle && (
          <div style={{ color: gradient ? 'rgba(255,255,255,0.72)' : C.muted, fontSize: 12, marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
      {badge}
    </div>
  );
}

// ── Scan zone ─────────────────────────────────────────────────────────────────
function ScanZone({ value, onChange, onCameraClick, placeholder, label, hint, inputRef: externalRef }) {
  const internalRef = useRef(null);
  const ref = externalRef ?? internalRef;
  const hasValue = !!value;

  return (
    <div style={{
      padding: '16px 16px 12px',
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      {label && (
        <div style={{
          color: C.textSec, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
        }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          flex: 1, position: 'relative',
          borderRadius: 14,
          boxShadow: hasValue ? `0 0 0 3px ${C.green}30` : `0 0 0 3px ${C.primary}20`,
          transition: 'box-shadow 0.2s',
        }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 18, pointerEvents: 'none',
          }}>
            {hasValue ? '✅' : '🔍'}
          </span>
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? 'สแกนหรือพิมพ์'}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              background: C.inputBg,
              border: `2px solid ${hasValue ? C.green : C.primary}`,
              borderRadius: 14, padding: '14px 14px 14px 44px',
              color: C.text, fontSize: 16, fontWeight: 600,
              outline: 'none', transition: 'border-color 0.2s',
            }}
          />
        </div>
        <button type="button" onClick={onCameraClick}
          style={{
            background: C.primary,
            border: 'none', borderRadius: 14,
            padding: '14px 16px', color: '#fff', fontSize: 20,
            cursor: 'pointer', lineHeight: 1, flexShrink: 0,
            boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
          }}>
          📷
        </button>
      </div>
      {hint && (
        <div style={{
          color: hasValue ? C.green : C.textSec,
          fontSize: 12, marginTop: 8, paddingLeft: 2, fontWeight: hasValue ? 600 : 400,
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────
function ItemCard({ line, docNo, statusLabel }) {
  if (!line) return null;
  return (
    <div style={{
      margin: '12px 16px',
      background: C.card,
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
      boxShadow: C.shadow,
      flexShrink: 0,
    }}>
      <div style={{
        background: C.headerGrad,
        padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: '#ffffff', fontWeight: 800, fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{docNo}</span>
        <Pill label={statusLabel} color="#ffffff" bg="rgba(255,255,255,0.2)" />
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
          {line.product_name ?? line.customer_product_code ?? '—'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {line.customer_product_code && (
            <span style={{
              background: C.blueLight, color: C.primary,
              borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700,
            }}>
              รหัส {line.customer_product_code}
            </span>
          )}
          {line.lot_no && (
            <span style={{
              background: '#f0fdf4', color: C.green,
              borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700,
            }}>
              LOT {line.lot_no}
            </span>
          )}
          {line.temperature_type && (
            <span style={{
              background: '#e0f2fe', color: '#0284c7',
              borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700,
            }}>
              ❄ {line.temperature_type}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{
            flex: 1, background: C.bg, borderRadius: 10, padding: '10px 12px',
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>คาดการณ์</div>
            <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
              {line.expected_boxes ?? '-'} กล่อง
            </div>
            <div style={{ color: C.textSec, fontSize: 12 }}>{line.expected_weight ?? '-'} กก.</div>
          </div>
          {line.actual_boxes != null && (
            <div style={{
              flex: 1, background: C.greenLight, borderRadius: 10, padding: '10px 12px',
              border: `1px solid ${C.greenBorder}`,
            }}>
              <div style={{ color: C.green, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>รับจริง ✓</div>
              <div style={{ color: C.green, fontWeight: 800, fontSize: 14 }}>{line.actual_boxes} กล่อง</div>
              <div style={{ color: C.green, fontSize: 12 }}>{line.actual_weight ?? '-'} กก.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Qty input row ─────────────────────────────────────────────────────────────
function QtyRow({ boxes, setBoxes, weight, setWeight }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '0 16px 12px', flexShrink: 0 }}>
      {[['📦 กล่อง', boxes, setBoxes], ['⚖️ น้ำหนัก (กก.)', weight, setWeight]].map(([label, val, setVal]) => (
        <label key={label} style={{ flex: 1 }}>
          <div style={{ color: C.textSec, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
          <input
            type="number" min={0} value={val}
            onChange={(e) => setVal(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: val ? C.greenLight : C.inputBg,
              border: `2px solid ${val ? C.green : C.border}`,
              borderRadius: 12, padding: '14px 10px',
              color: val ? C.green : C.text,
              fontSize: 24, fontWeight: 800, textAlign: 'center', outline: 'none',
              transition: 'all 0.2s',
            }}
          />
        </label>
      ))}
    </div>
  );
}

// ── Confirmed chip ────────────────────────────────────────────────────────────
function ConfirmedChip({ item }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      background: C.greenLight, borderRadius: 12,
      border: `1px solid ${C.greenBorder}`, marginBottom: 8,
      boxShadow: '0 1px 4px rgba(22,163,74,0.1)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: C.green, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 16,
      }}>✓</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.line?.product_name ?? item.line?.customer_product_code}
        </div>
        <div style={{ color: C.green, fontSize: 12, marginTop: 2, fontWeight: 600 }}>
          {item.boxes} กล่อง · {item.weight} กก.{item.palletId ? ` · ${item.palletId}` : ''}{item.location ? ` · 📍 ${item.location.code}` : ''}
          <span style={{ color: C.textSec, fontWeight: 400, marginLeft: 8 }}>{item.confirmedAt}</span>
        </div>
      </div>
    </div>
  );
}

// ── Line list item ────────────────────────────────────────────────────────────
function LineListItem({ line, index, isDone, doneLabel, onSelect }) {
  return (
    <button type="button" onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        background: isDone ? C.greenLight : C.card,
        border: `1.5px solid ${isDone ? C.greenBorder : C.border}`,
        borderRadius: 14, padding: '14px 14px', marginBottom: 8,
        cursor: 'pointer', color: C.text,
        boxShadow: isDone ? 'none' : C.shadow,
        transition: 'all 0.15s',
        borderLeft: `4px solid ${isDone ? C.green : C.primary}`,
      }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: isDone ? C.green : C.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 14, fontWeight: 800,
      }}>
        {isDone ? '✓' : index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
          {line.product_name ?? line.customer_product_code}
        </div>
        <div style={{ fontSize: 12, color: C.textSec, marginTop: 3 }}>
          {line.expected_boxes != null ? `${line.expected_boxes} กล่อง · ` : ''}{line.expected_weight != null ? `${line.expected_weight} กก.` : ''}
          {isDone && doneLabel && (
            <span style={{
              color: C.green, fontWeight: 700, marginLeft: 6,
              background: C.greenLight, borderRadius: 6, padding: '1px 7px',
            }}>{doneLabel}</span>
          )}
        </div>
      </div>
      <span style={{
        width: 28, height: 28, borderRadius: '50%',
        background: isDone ? C.green + '18' : C.blueLight,
        color: isDone ? C.green : C.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, flexShrink: 0,
      }}>›</span>
    </button>
  );
}

// ── Big confirm button ────────────────────────────────────────────────────────
function ConfirmBtn({ label, onClick, disabled, saving, color = C.primary }) {
  const active = !disabled && !saving;
  return (
    <div style={{
      padding: '12px 16px 16px',
      flexShrink: 0,
      background: C.surface,
      borderTop: `1px solid ${C.border}`,
      boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
    }}>
      <button type="button" disabled={disabled || saving} onClick={onClick}
        style={{
          width: '100%', padding: '18px',
          borderRadius: 16,
          background: active ? color : C.border,
          color: active ? '#ffffff' : C.muted,
          border: 'none', fontSize: 17, fontWeight: 800,
          cursor: active ? 'pointer' : 'not-allowed',
          letterSpacing: '0.02em',
          boxShadow: active ? `0 6px 20px ${color}55` : 'none',
          transition: 'all 0.2s',
        }}>
        {saving ? '⏳ กำลังบันทึก...' : label}
      </button>
    </div>
  );
}

// ── Doc card ──────────────────────────────────────────────────────────────────
function DocCard({ onClick, docNo, statusLabel, statusColor, dateStr, subText }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 16, padding: '16px 16px', marginBottom: 10,
        cursor: 'pointer', color: C.text,
        boxShadow: C.shadow,
        borderLeft: `4px solid ${statusColor}`,
        transition: 'box-shadow 0.15s',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{
          fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: C.primaryDark,
        }}>{docNo}</span>
        <Pill label={statusLabel} color={statusColor} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: C.textSec }}>📅 {dateStr}</span>
        {subText && <span style={{ fontSize: 12, color: C.muted }}>· {subText}</span>}
      </div>
    </button>
  );
}

// ── Receiving workflow ────────────────────────────────────────────────────────
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
  const [flashMsg, setFlashMsg] = useState('');

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

    setConfirmed((prev) => [{ line: matchedLine, boxes, weight, palletId: palletScan, location: selectedLocation,
      confirmedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setLines((prev) => prev.map((l) => l.id === matchedLine.id
      ? { ...l, actual_boxes: Number(boxes) || null, actual_weight: Number(weight) || null } : l));

    setFlashMsg(`✓ ${matchedLine.product_name ?? matchedLine.customer_product_code}`);
    setScanValue(''); setMatchedLine(null); setBoxes(''); setWeight(''); setPalletScan(''); setSelectedLocation(null);
    setTimeout(() => setFlashMsg(''), 3000);
  }

  const doneCount = lines.filter((l) => l.actual_boxes != null).length;

  // Doc select screen
  if (!selectedDoc) {
    return (
      <div data-testid="handheld-page" style={{ background: C.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <TopBar title="รับสินค้าเข้า" subtitle="เลือกใบงานที่ต้องการ" onBack={onBack} />
        <div style={{ padding: '16px 16px 24px', flex: 1, overflowY: 'auto' }}>
          {docsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>กำลังโหลด...</div>
          ) : docs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: C.card, borderRadius: 20, marginTop: 8,
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
            }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>ไม่มีใบงานที่รอรับสินค้า</div>
              <div style={{ fontSize: 13, color: C.muted }}>ใบงานสถานะ "รับเข้าคลัง" จะปรากฏที่นี่</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>พบ {docs.length} ใบงาน</span>
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
            padding: '4px 12px', color: '#fff', fontSize: 12, fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.35)',
          }}>
            {doneCount}/{lines.length}
          </div>
        }
      />

      {/* Progress bar */}
      {lines.length > 0 && (
        <div style={{ background: C.primaryDark, height: 4, flexShrink: 0 }}>
          <div style={{
            height: '100%', background: C.green,
            width: `${(doneCount / lines.length) * 100}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {linesLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, background: C.bg }}>
          กำลังโหลด...
        </div>
      ) : (
        <>
          <ScanZone value={scanValue} onChange={handleScan} onCameraClick={cameraItem}
            label="สแกนสินค้า" placeholder="รหัส / LOT / ชื่อสินค้า"
            hint={matchedLine
              ? `✓ พบ: ${matchedLine.product_name ?? matchedLine.customer_product_code}`
              : 'สแกนบาร์โค้ดหรือพิมพ์ หรือเลือกจากรายการด้านล่าง'} />

          <div style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
            {flashMsg && (
              <div style={{
                margin: '12px 16px 0', padding: '12px 16px',
                background: C.greenLight, border: `1px solid ${C.greenBorder}`,
                borderRadius: 12, color: C.green, fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 18 }}>🎉</span> {flashMsg}
              </div>
            )}
            {saveError && (
              <div style={{
                margin: '12px 16px 0', padding: '12px 16px',
                background: C.redLight, borderRadius: 12, color: C.red, fontSize: 13,
              }}>
                {saveError}
              </div>
            )}

            {matchedLine ? (
              <>
                <ItemCard line={matchedLine} docNo={selectedDoc.request_no}
                  statusLabel={getDepositStatusLabel(selectedDoc.status, t)} />
                <QtyRow boxes={boxes} setBoxes={setBoxes} weight={weight} setWeight={setWeight} />

                <div style={{ padding: '0 16px 12px' }}>
                  <div style={{ color: C.textSec, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🪵 Pallet ID (ถ้ามี)</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" value={palletScan} onChange={(e) => setPalletScan(e.target.value)}
                      placeholder="สแกนหรือพิมพ์ Pallet ID"
                      style={{
                        flex: 1, background: C.inputBg,
                        border: `2px solid ${palletScan ? C.primary : C.border}`,
                        borderRadius: 12, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none',
                      }} />
                    <button type="button" onClick={cameraPallet}
                      style={{
                        background: C.primary, border: 'none', borderRadius: 12,
                        padding: '12px 16px', color: '#fff', fontSize: 18, cursor: 'pointer',
                      }}>📷</button>
                  </div>
                </div>

                {/* Location picker */}
                {locations.length > 0 && (
                  <div style={{ padding: '0 16px 12px' }}>
                    <div style={{ color: C.textSec, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📍 เลือก Location จัดเก็บ</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {locations.map((loc) => {
                        const isSelected = selectedLocation?.id === loc.id;
                        return (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => setSelectedLocation(isSelected ? null : loc)}
                            style={{
                              padding: '6px 12px',
                              border: `2px solid ${isSelected ? C.green : C.border}`,
                              borderRadius: 10,
                              background: isSelected ? C.greenLight : C.inputBg,
                              color: isSelected ? C.green : C.textSec,
                              fontSize: 12, fontWeight: isSelected ? 700 : 400,
                              cursor: 'pointer',
                            }}
                          >
                            {loc.sectionCode} · {loc.code}
                          </button>
                        );
                      })}
                    </div>
                    {selectedLocation && (
                      <div style={{ marginTop: 8, color: C.green, fontSize: 12, fontWeight: 700 }}>
                        ✓ เลือก: {selectedLocation.label}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ padding: '0 16px 16px' }}>
                  <button type="button" onClick={() => { setMatchedLine(null); setScanValue(''); }}
                    style={{
                      background: 'none', border: `1px solid ${C.border}`,
                      color: C.textSec, fontSize: 13, cursor: 'pointer',
                      borderRadius: 8, padding: '8px 14px',
                    }}>
                    ← เลือกสินค้าอื่น
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  รายการสินค้า ({lines.length})
                </div>
                {lines.map((l, i) => (
                  <LineListItem key={l.id} line={l} index={i} isDone={l.actual_boxes != null}
                    doneLabel={l.actual_boxes != null ? `รับแล้ว ${l.actual_boxes} กล่อง` : ''}
                    onSelect={() => {
                      setMatchedLine(l);
                      setScanValue(l.customer_product_code ?? l.product_name ?? '');
                      setBoxes(l.actual_boxes?.toString() ?? l.expected_boxes?.toString() ?? '');
                      setWeight(l.actual_weight?.toString() ?? l.expected_weight?.toString() ?? '');
                    }} />
                ))}

                {confirmed.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 10,
                      textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      บันทึกแล้วในเซสชันนี้ ({confirmed.length})
                    </div>
                    {confirmed.map((item, i) => <ConfirmedChip key={i} item={item} />)}
                  </div>
                )}
              </div>
            )}
          </div>

          {matchedLine && (
            <ConfirmBtn
              label="✓ ยืนยันรับสินค้า"
              onClick={handleConfirm}
              disabled={!boxes && !weight}
              saving={saving}
              color={C.green}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Picking workflow ──────────────────────────────────────────────────────────
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
  const [flashMsg, setFlashMsg] = useState('');

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
      setMatchedLine(match);
      setBoxes(match.requested_boxes?.toString() ?? '');
      setWeight(match.requested_qty?.toString() ?? '');
    } else { setMatchedLine(null); }
  }

  function handleConfirm() {
    if (!matchedLine) return;
    setConfirmed((prev) => [{ line: matchedLine, boxes, weight,
      confirmedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setFlashMsg(`✓ ${matchedLine.product_name ?? matchedLine.customer_product_code}`);
    setScanValue(''); setMatchedLine(null); setBoxes(''); setWeight('');
    setTimeout(() => setFlashMsg(''), 3000);
  }

  const doneCount = confirmed.length;

  if (!selectedDoc) {
    return (
      <div style={{ background: C.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <TopBar title="เบิกสินค้าออก" subtitle="เลือกใบงานที่ต้องการ" onBack={onBack} />
        <div style={{ padding: '16px 16px 24px', flex: 1, overflowY: 'auto' }}>
          {docsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>กำลังโหลด...</div>
          ) : docs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: C.card, borderRadius: 20, marginTop: 8,
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
            }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>ไม่มีใบงานที่รอหยิบสินค้า</div>
              <div style={{ fontSize: 13, color: C.muted }}>ใบงานสถานะ "หยิบสินค้า" จะปรากฏที่นี่</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>พบ {docs.length} ใบงาน</span>
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
            padding: '4px 12px', color: '#fff', fontSize: 12, fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.35)',
          }}>
            {doneCount}/{lines.length}
          </div>
        }
      />

      {lines.length > 0 && (
        <div style={{ background: C.primaryDark, height: 4, flexShrink: 0 }}>
          <div style={{
            height: '100%', background: C.pickAccent,
            width: `${(doneCount / lines.length) * 100}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {linesLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, background: C.bg }}>
          กำลังโหลด...
        </div>
      ) : (
        <>
          <ScanZone value={scanValue} onChange={handleScan} onCameraClick={cameraItem}
            label="สแกนสินค้า" placeholder="รหัส / LOT / ชื่อสินค้า"
            hint={matchedLine
              ? `✓ พบ: ${matchedLine.product_name ?? matchedLine.customer_product_code}`
              : 'สแกนบาร์โค้ดหรือพิมพ์ หรือเลือกจากรายการ'} />

          <div style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
            {flashMsg && (
              <div style={{
                margin: '12px 16px 0', padding: '12px 16px',
                background: C.greenLight, border: `1px solid ${C.greenBorder}`,
                borderRadius: 12, color: C.green, fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 18 }}>🎉</span> {flashMsg}
              </div>
            )}

            {matchedLine ? (
              <>
                <ItemCard line={matchedLine} docNo={selectedDoc.withdrawal_no}
                  statusLabel={getWithdrawalStatusLabel(selectedDoc.status, t)} />
                <QtyRow boxes={boxes} setBoxes={setBoxes} weight={weight} setWeight={setWeight} />
                <div style={{ padding: '0 16px 16px' }}>
                  <button type="button" onClick={() => { setMatchedLine(null); setScanValue(''); }}
                    style={{
                      background: 'none', border: `1px solid ${C.border}`,
                      color: C.textSec, fontSize: 13, cursor: 'pointer',
                      borderRadius: 8, padding: '8px 14px',
                    }}>
                    ← เลือกสินค้าอื่น
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  รายการสินค้า ({lines.length})
                </div>
                {lines.map((l, i) => {
                  const done = confirmed.some((c) => c.line.id === l.id);
                  return (
                    <LineListItem key={l.id} line={l} index={i} isDone={done}
                      doneLabel={done ? 'หยิบแล้ว' : ''}
                      onSelect={() => {
                        setMatchedLine(l);
                        setScanValue(l.customer_product_code ?? l.product_name ?? '');
                        setBoxes(l.requested_boxes?.toString() ?? '');
                        setWeight(l.requested_qty?.toString() ?? '');
                      }} />
                  );
                })}
                {confirmed.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 10,
                      textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      หยิบแล้ว ({confirmed.length})
                    </div>
                    {confirmed.map((item, i) => <ConfirmedChip key={i} item={item} />)}
                  </div>
                )}
              </div>
            )}
          </div>

          {matchedLine && (
            <ConfirmBtn
              label="✓ ยืนยันหยิบสินค้า"
              onClick={handleConfirm}
              disabled={!boxes && !weight}
              color={C.pickAccent}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Mode select home ──────────────────────────────────────────────────────────
function ModeSelect({ onSelect }) {
  return (
    <div data-testid="handheld-page" style={{ background: C.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero header */}
      <div style={{
        background: C.headerGrad,
        padding: '36px 24px 32px',
        boxShadow: '0 4px 24px rgba(37,99,235,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'rgba(255,255,255,0.15)',
            border: '2px solid rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, flexShrink: 0,
          }}>
            📦
          </div>
          <div>
            <div style={{ color: '#ffffff', fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em' }}>
              TGC Handheld
            </div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>
              Cold Storage · Barcode Scanner
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 14, padding: '12px 16px',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
            🕐 {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 14 }}>
          เลือกโหมดการทำงาน
        </div>

        {/* Receive button */}
        <button type="button" onClick={() => onSelect('receive')}
          style={{
            background: C.card, border: 'none',
            borderRadius: 20, padding: '20px 20px',
            textAlign: 'left', cursor: 'pointer', color: C.text,
            marginBottom: 12,
            boxShadow: `0 4px 20px rgba(37,99,235,0.15)`,
            borderLeft: `5px solid ${C.receiveAccent}`,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18,
              background: C.blueLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, flexShrink: 0,
            }}>
              📥
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>รับสินค้าเข้า</div>
              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>สแกนและบันทึกสินค้า<br />รับเข้าตามใบแจ้งฝาก</div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: C.blueLight, color: C.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, flexShrink: 0,
            }}>›</div>
          </div>
        </button>

        {/* Pick button */}
        <button type="button" onClick={() => onSelect('pick')}
          style={{
            background: C.card, border: 'none',
            borderRadius: 20, padding: '20px 20px',
            textAlign: 'left', cursor: 'pointer', color: C.text,
            marginBottom: 20,
            boxShadow: `0 4px 20px rgba(245,158,11,0.15)`,
            borderLeft: `5px solid ${C.pickAccent}`,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18,
              background: '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, flexShrink: 0,
            }}>
              📤
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>เบิกสินค้าออก</div>
              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>สแกนและหยิบสินค้า<br />ตามใบขอเบิก</div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#fef3c7', color: C.amber,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, flexShrink: 0,
            }}>›</div>
          </div>
        </button>

        {/* Tip card */}
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: '16px 18px',
          boxShadow: C.shadow,
        }}>
          <div style={{ color: C.primary, fontSize: 12, fontWeight: 800, marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>💡</span> วิธีใช้งาน
          </div>
          {[
            ['1', 'เลือกโหมด → เลือกใบงาน'],
            ['2', 'สแกนบาร์โค้ด หรือเลือกสินค้าจากรายการ'],
            ['3', 'กรอกจำนวนที่รับ/หยิบ → กดยืนยัน'],
          ].map(([num, text]) => (
            <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: C.blueLight, color: C.primary,
                fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{num}</div>
              <span style={{ color: C.textSec, fontSize: 13, lineHeight: 1.4 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function HandheldPage() {
  const t = useTranslation();
  const [mode, setMode] = useState(null);

  if (mode === 'receive') return <ReceivingWorkflow onBack={() => setMode(null)} t={t} />;
  if (mode === 'pick') return <PickingWorkflow onBack={() => setMode(null)} t={t} />;
  return <ModeSelect onSelect={setMode} />;
}
