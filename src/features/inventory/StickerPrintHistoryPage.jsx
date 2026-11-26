import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { listStickerPrintLogs } from '../../services/stickerPrintLogService.js';
import { formatPrintTime } from '../../components/sticker/StickerPrintHistory.jsx';
import { downloadExcelRows } from '../../utils/excelFileUtils.js';

// ประวัติการพิมพ์สติ๊กเกอร์: every sheet sent to print, filterable by date,
// FR code, who printed and format. Rows that repeat an earlier sticker in
// the shown range are marked "พิมพ์ซ้ำ".

const FORMAT_LABELS = { A5: 'A5', THERMAL: 'Thermal' };

const EXPORT_HEADERS = ['เวลาพิมพ์', 'ผู้พิมพ์', 'รูปแบบ', 'รหัสติดตาม', 'พาเลท', 'Location', 'กล่อง', 'พิมพ์ซ้ำ', 'หน้าที่สั่งพิมพ์'];

function isoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: isoDate(from), to: isoDate(to) };
}

function palletText(row) {
  return row.pallet_index != null ? `${row.pallet_index}/${row.pallet_total ?? '-'}` : '-';
}

export function summarizePrintRows(rows = []) {
  return {
    sheets: rows.length,
    codes: new Set(rows.map((r) => r.tracking_code).filter(Boolean)).size,
    reprints: rows.filter((r) => r.isReprint).length,
    people: new Set(rows.map((r) => r.printed_by_email).filter(Boolean)).size,
  };
}

function StatCard({ label, value, tone }) {
  return (
    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: '10px 14px', background: 'var(--color-surface)', minWidth: 140 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tone ?? 'inherit' }}>{value}</div>
    </div>
  );
}

export function StickerPrintHistoryPage() {
  const [filters, setFilters] = useState(() => ({ ...defaultRange(), trackingCode: '', printedBy: '', format: '', reprintsOnly: false }));
  const [applied, setApplied] = useState(filters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listStickerPrintLogs(applied).then(({ data, error: err, truncated: cut }) => {
      if (cancelled) return;
      setRows(data ?? []);
      setTruncated(Boolean(cut));
      setError(err ? `โหลดประวัติการพิมพ์ไม่สำเร็จ: ${err.message ?? err}` : '');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [applied, reloadKey]);

  // Newest first on screen; reprint marks were computed oldest first.
  const shown = useMemo(() => {
    const list = applied.reprintsOnly ? rows.filter((r) => r.isReprint) : rows;
    return [...list].reverse();
  }, [rows, applied.reprintsOnly]);
  const summary = useMemo(() => summarizePrintRows(rows), [rows]);

  function set(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  function exportExcel() {
    const data = shown.map((r) => ({
      'เวลาพิมพ์': formatPrintTime(r.printed_at),
      'ผู้พิมพ์': r.printed_by_email ?? '',
      'รูปแบบ': FORMAT_LABELS[r.sticker_format] ?? r.sticker_format,
      'รหัสติดตาม': r.tracking_code ?? '',
      'พาเลท': palletText(r),
      'Location': r.location_code ?? '',
      'กล่อง': r.boxes ?? '',
      'พิมพ์ซ้ำ': r.isReprint ? 'ใช่' : '',
      'หน้าที่สั่งพิมพ์': r.source_path ?? '',
    }));
    downloadExcelRows(data, EXPORT_HEADERS, `sticker-prints_${applied.from || 'all'}_${applied.to || 'all'}.xlsx`, 'ประวัติการพิมพ์', [17, 28, 9, 15, 8, 16, 8, 9, 30]);
  }

  return (
    <section className={getPageShellClassName()}>
      <PageHeader title="ประวัติการพิมพ์สติ๊กเกอร์" description="ทุกแผ่นที่สั่งพิมพ์ ทั้ง Thermal และ A5 — บันทึกตอนสั่งพิมพ์ ไม่ได้ยืนยันว่าเครื่องพิมพ์พิมพ์ออกจริง" />

      <form
        onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}
        data-testid="sticker-print-filters"
      >
        <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
          ตั้งแต่วันที่
          <input className="form-control" type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
          ถึงวันที่
          <input className="form-control" type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
          รหัสติดตาม
          <input className="form-control" value={filters.trackingCode} placeholder="เช่น FR2611" onChange={(e) => set('trackingCode', e.target.value)} data-testid="sticker-print-filter-code" style={{ width: 150 }} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
          ผู้พิมพ์
          <input className="form-control" value={filters.printedBy} placeholder="อีเมล" onChange={(e) => set('printedBy', e.target.value)} style={{ width: 180 }} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
          รูปแบบ
          <select className="form-control" value={filters.format} onChange={(e) => set('format', e.target.value)}>
            <option value="">ทั้งหมด</option>
            <option value="A5">A5</option>
            <option value="THERMAL">Thermal</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 600, paddingBottom: 8 }}>
          <input type="checkbox" checked={filters.reprintsOnly} onChange={(e) => set('reprintsOnly', e.target.checked)} data-testid="sticker-print-filter-reprints" />
          เฉพาะที่พิมพ์ซ้ำ
        </label>
        <button type="submit" className="btn btn-primary" data-testid="sticker-print-search">ค้นหา</button>
        <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)} title="โหลดใหม่" aria-label="โหลดใหม่">
          <RefreshCw size={14} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-secondary" onClick={exportExcel} disabled={!shown.length} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <Download size={14} aria-hidden="true" /> Excel
        </button>
      </form>

      {error && <div className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }} data-testid="sticker-print-summary">
        <StatCard label="แผ่นที่สั่งพิมพ์" value={summary.sheets} />
        <StatCard label="รหัสติดตาม" value={summary.codes} />
        <StatCard label="พิมพ์ซ้ำ" value={summary.reprints} tone={summary.reprints ? 'var(--color-warning)' : undefined} />
        <StatCard label="ผู้พิมพ์" value={summary.people} />
      </div>

      {truncated && (
        <div className="banner banner-warning" style={{ marginBottom: 16 }}>แสดงได้สูงสุด 5,000 แผ่น ลองเลือกช่วงวันที่ให้แคบลง</div>
      )}

      {loading ? <LoadingState /> : (
        <div className="table-wrapper">
          <table className="data-table" data-testid="sticker-print-table">
            <thead>
              <tr>
                <th>เวลาพิมพ์</th><th>ผู้พิมพ์</th><th>รูปแบบ</th><th>รหัสติดตาม</th>
                <th>พาเลท</th><th>Location</th><th style={{ textAlign: 'right' }}>กล่อง</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>ไม่มีการพิมพ์ในช่วงนี้</td></tr>
              ) : shown.map((r) => (
                <tr key={r.id} data-testid="sticker-print-row">
                  <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatPrintTime(r.printed_at)}</td>
                  <td>{r.printed_by_email ?? '-'}</td>
                  <td>{FORMAT_LABELS[r.sticker_format] ?? r.sticker_format}</td>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.tracking_code ?? '-'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{palletText(r)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.location_code ?? '-'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.boxes ?? '-'}</td>
                  <td>
                    {r.isReprint && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)', background: 'var(--color-warning-soft)', borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                        พิมพ์ซ้ำ
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
