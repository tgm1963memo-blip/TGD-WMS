import { useEffect, useState } from 'react';
import { getStickerPrintSummary, STICKER_PRINTED_EVENT } from '../../services/stickerPrintLogService.js';

// "พิมพ์แล้ว N ครั้ง" next to a deposit line's tracking code, from
// tgd_sticker_print_logs. Refreshes when this browser prints a sticker.

export function formatPrintTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function useStickerPrintSummary(trackingCodes = []) {
  const key = [...new Set(trackingCodes.filter(Boolean))].sort().join('|');
  const [summary, setSummary] = useState(() => new Map());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!key) { setSummary(new Map()); return undefined; }
    let cancelled = false;
    getStickerPrintSummary(key.split('|')).then(({ data }) => {
      if (!cancelled) setSummary(data ?? new Map());
    });
    return () => { cancelled = true; };
  }, [key, reloadKey]);

  useEffect(() => {
    if (!key) return undefined;
    const codes = new Set(key.split('|'));
    const onPrinted = (e) => {
      const printed = e.detail?.trackingCodes ?? [];
      if (printed.some((c) => codes.has(c))) setReloadKey((k) => k + 1);
    };
    window.addEventListener(STICKER_PRINTED_EVENT, onPrinted);
    return () => window.removeEventListener(STICKER_PRINTED_EVENT, onPrinted);
  }, [key]);

  return summary;
}

export function StickerPrintBadge({ entry }) {
  if (!entry) return null;
  const formatLabel = entry.lastFormat === 'A5' ? 'A5' : 'สติ๊กเกอร์';
  const title = `พิมพ์สติ๊กเกอร์แล้ว ${entry.count} แผ่น · ล่าสุด ${formatPrintTime(entry.lastAt)} (${formatLabel})${entry.lastBy ? ` โดย ${entry.lastBy}` : ''}`;
  return (
    <div
      title={title}
      data-testid="sticker-print-badge"
      style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap' }}
    >
      พิมพ์แล้ว {entry.count} แผ่น · {formatPrintTime(entry.lastAt)}
    </div>
  );
}
