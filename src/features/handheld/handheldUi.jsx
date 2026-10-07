// Shared Scan Center (handheld) building blocks: theme tokens, feedback,
// camera scanner and top bar. Used by HandheldPage and the workflows split
// out of it (e.g. StockCountWorkflow).
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

// ── Theme tokens (aligned with main app: dark navy + gold) ───────────
export const C = {
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
export function triggerSuccessFeedback() {
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
// Live continuous scanning via ZXing over getUserMedia, not the native
// BarcodeDetector API this used to rely on -- BarcodeDetector doesn't exist
// in Safari (desktop OR iOS) at all, so on an iPhone this previously always
// fell through to opening the native camera app for a single still photo
// (capture="environment"), requiring the user to manually press the
// shutter, then usually STILL failed to decode (BarcodeDetector missing)
// and fell back to a plain window.prompt() text box -- on the one browser
// (iOS Safari) most handheld devices in an actual warehouse would be using.
// ZXing decodes video frames in pure JS, so it works identically on iOS
// Safari, desktop Chrome, Android -- point the camera at the code and it's
// read automatically, no capture button.
const SCAN_HINTS = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE, BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
  BarcodeFormat.ITF, BarcodeFormat.DATA_MATRIX,
]]]);

export function useCameraScanner(onScanned) {
  const [active, setActive] = useState(false);
  const [scanError, setScanError] = useState('');
  const [manualValue, setManualValue] = useState('');
  const videoRef = useRef(null);
  const readerRef = useRef(null);

  function trigger() {
    setScanError('');
    setManualValue('');
    setActive(true);
  }

  function close() {
    readerRef.current?.reset();
    setActive(false);
  }

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader(SCAN_HINTS);
    readerRef.current = reader;

    reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      videoRef.current,
      (result) => {
        // The callback fires on every frame attempt, including ones where
        // nothing was found yet (a NotFoundException passed as the second
        // arg) -- that's the normal "still looking" case while the camera
        // is pointed at nothing/blur, not a real error, so it's ignored
        // rather than surfaced.
        if (cancelled || !result) return;
        onScanned(result.getText());
        reader.reset();
        setActive(false);
      },
    ).catch(() => {
      if (cancelled) return;
      setScanError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง หรือกรอกรหัสด้านล่างแทน');
    });

    return () => {
      cancelled = true;
      reader.reset();
    };
  }, [active]);

  function submitManual() {
    const v = manualValue.trim();
    if (!v) return;
    onScanned(v);
    setActive(false);
  }

  const el = !active ? null : (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(9,17,28,0.96)', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <video ref={videoRef} muted playsInline
        style={{ width: '100%', maxWidth: 440, borderRadius: 20, background: '#000', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }} />
      <div style={{ color: '#fff', marginTop: 18, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
        เล็งกล้องไปที่บาร์โค้ดหรือ QR Code
      </div>
      {scanError && (
        <div style={{ color: '#fca5a5', marginTop: 10, fontSize: 13, fontWeight: 700, textAlign: 'center', maxWidth: 440 }}>
          {scanError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 18, width: '100%', maxWidth: 440 }}>
        <input type="text" value={manualValue} onChange={(e) => setManualValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
          placeholder="หรือพิมพ์รหัสเอง" autoFocus={Boolean(scanError)}
          style={{ flex: 1, padding: '12px 14px', borderRadius: 14, border: 'none', fontSize: 15, outline: 'none' }} />
        <button type="button" onClick={submitManual}
          style={{ padding: '12px 20px', borderRadius: 14, border: 'none', background: '#d4af37', color: '#09111c', fontWeight: 800, cursor: 'pointer' }}>
          ตกลง
        </button>
      </div>
      <button type="button" onClick={close}
        style={{ marginTop: 18, background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: 14, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}>
        ปิด
      </button>
    </div>
  );

  return { trigger, el };
}

// ── Status pill ───────────────────────────────────────────────
export function Pill({ label, color = C.primary, bg }) {
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
export function TopBar({ title, subtitle, onBack, badge }) {
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
