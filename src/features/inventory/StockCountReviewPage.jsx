import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { resolveCountPhotoUrls } from '../../services/customerDocumentAttachmentService.js';
import {
  LOCATION_COUNT_RESULT_LABELS,
  LOCATION_COUNT_STATUS_LABELS,
  canReviewLocationCount,
  isLocationCountVariance,
  listLocationCountLines,
  listLocationCountSessions,
  setLocationCountStatus,
} from '../../services/locationCountService.js';
import { downloadExcelRows } from '../../utils/excelFileUtils.js';
import { formatFixed2, round2 } from '../../utils/numberFormat.js';
import { buildPalletCode } from '../../utils/locationCodeUtils.js';

const RESULT_COLORS = {
  MATCH: '#059669', SHORT: '#d97706', OVER: '#2563eb', MISSING: '#dc2626', UNEXPECTED: '#7c3aed',
};
const STATUS_COLORS = { OPEN: '#2563eb', SUBMITTED: '#d97706', REVIEWED: '#059669', CANCELLED: '#94a3b8' };

const EXPORT_HEADERS = [
  'Location', 'พาเลท', 'รหัสสินค้า', 'ชื่อสินค้า', 'LOT', 'รหัสติดตาม',
  'ในระบบ (กล่อง)', 'นับได้ (กล่อง)', 'ต่าง (กล่อง)', 'ในระบบ (กก.)', 'นับได้ (กก.)', 'ต่าง (กก.)',
  'ผล', 'หมายเหตุ', 'ผู้นับ', 'เวลานับ',
];

function Badge({ label, color }) {
  return (
    <span style={{ display: 'inline-block', background: `${color}1a`, color, border: `1px solid ${color}55`, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function palletLabel(line) {
  return line.pallet_no != null && line.location_code ? buildPalletCode(line.location_code, line.pallet_no) : (line.location_code ?? '-');
}

function diff(counted, expected) {
  return round2(Number(counted ?? 0) - Number(expected ?? 0));
}

export function StockCountReviewPage() {
  const { role } = useUserRole();
  const canReview = canReviewLocationCount(role);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [varianceOnly, setVarianceOnly] = useState(true);
  const [photos, setPhotos] = useState({});
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadSessions() {
    setLoading(true);
    const result = await listLocationCountSessions();
    setSessions(result.data ?? []);
    setError(result.error?.message ?? '');
    setLoading(false);
    return result.data ?? [];
  }

  useEffect(() => { loadSessions(); }, []);

  async function openSession(session) {
    setSelected(session);
    setLines([]); setPhotos({}); setReviewNote(session.review_note ?? ''); setError('');
    setLinesLoading(true);
    const result = await listLocationCountLines(session.id);
    setLinesLoading(false);
    if (result.error) { setError(result.error.message ?? 'โหลดผลการนับไม่สำเร็จ'); return; }
    const loaded = result.data ?? [];
    setLines(loaded);
    const withLine = loaded.filter((l) => l.deposit_line_id);
    if (withLine.length) {
      const { data: products } = await listCustomerProducts({});
      const { data: resolved } = await resolveCountPhotoUrls(withLine, products ?? []);
      setPhotos(resolved ?? {});
    }
  }

  async function changeStatus(status) {
    if (!selected) return;
    const confirmText = status === 'CANCELLED' ? `ยกเลิกรอบนับ ${selected.count_no}?` : `บันทึกว่าตรวจผลการนับ ${selected.count_no} แล้ว?`;
    if (!window.confirm(confirmText)) return;
    setBusy(true); setError('');
    const result = await setLocationCountStatus(selected.id, status, { note: reviewNote });
    setBusy(false);
    if (result.error) { setError(result.error.message ?? 'บันทึกไม่สำเร็จ'); return; }
    const refreshed = await loadSessions();
    setSelected(refreshed.find((s) => s.id === selected.id) ?? null);
  }

  const visibleLines = useMemo(
    () => (varianceOnly ? lines.filter(isLocationCountVariance) : lines),
    [lines, varianceOnly],
  );
  const summary = useMemo(() => {
    const byResult = {};
    lines.forEach((l) => { byResult[l.result] = (byResult[l.result] ?? 0) + 1; });
    return {
      locations: new Set(lines.map((l) => l.location_id)).size,
      byResult,
      boxDiff: round2(lines.reduce((s, l) => s + diff(l.counted_boxes, l.expected_boxes), 0)),
      weightDiff: round2(lines.reduce((s, l) => s + diff(l.counted_weight, l.expected_weight), 0)),
    };
  }, [lines]);

  function handleExport() {
    const rows = lines.map((l) => ({
      'Location': l.location_code ?? '-',
      'พาเลท': l.pallet_no != null ? palletLabel(l) : '',
      'รหัสสินค้า': l.customer_product_code ?? '-',
      'ชื่อสินค้า': l.product_name ?? '-',
      'LOT': l.lot_no ?? '-',
      'รหัสติดตาม': l.tracking_code ?? '-',
      'ในระบบ (กล่อง)': Number(l.expected_boxes ?? 0),
      'นับได้ (กล่อง)': Number(l.counted_boxes ?? 0),
      'ต่าง (กล่อง)': diff(l.counted_boxes, l.expected_boxes),
      'ในระบบ (กก.)': Number(l.expected_weight ?? 0),
      'นับได้ (กก.)': Number(l.counted_weight ?? 0),
      'ต่าง (กก.)': diff(l.counted_weight, l.expected_weight),
      'ผล': LOCATION_COUNT_RESULT_LABELS[l.result] ?? l.result,
      'หมายเหตุ': l.note ?? '',
      'ผู้นับ': l.counted_by_email ?? '',
      'เวลานับ': formatDateTime(l.counted_at),
    }));
    downloadExcelRows(rows, EXPORT_HEADERS, `stock-count-${selected.count_no}.xlsx`, 'ผลการนับ');
  }

  return (
    <section className={getPageShellClassName()}>
      <PageHeader title="นับสต็อก" description="ผลการนับสต็อกจากศูนย์สแกน — ระบบไม่ปรับยอดเอง หากต้องแก้ ให้แก้ที่หน้า ยอดคงเหลือ → จัดการ Location" />
      {error && <div className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      {!selected ? (
        loading ? <LoadingState /> : (
          <div className="table-wrapper">
            <table className="data-table" data-testid="stock-count-session-table">
              <thead>
                <tr>
                  <th>เลขที่</th><th>เริ่มนับ</th><th>ผู้นับ</th><th>สถานะ</th>
                  <th style={{ textAlign: 'right' }}>Location</th><th style={{ textAlign: 'right' }}>รายการ</th><th style={{ textAlign: 'right' }}>ไม่ตรง</th><th />
                </tr>
              </thead>
              <tbody>
                {sessions.length ? sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.count_no}</td>
                    <td>{formatDateTime(s.started_at)}</td>
                    <td>{s.started_by_email ?? '-'}</td>
                    <td><Badge label={LOCATION_COUNT_STATUS_LABELS[s.status] ?? s.status} color={STATUS_COLORS[s.status] ?? '#64748b'} /></td>
                    <td style={{ textAlign: 'right' }}>{s.locationCount}</td>
                    <td style={{ textAlign: 'right' }}>{s.lineCount}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: s.varianceCount ? '#d97706' : undefined }}>{s.varianceCount}</td>
                    <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => openSession(s)}>ดูผล</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan={8}>ยังไม่มีรอบนับ — เริ่มนับได้ที่ศูนย์สแกน → นับสต็อก</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>← รายการรอบนับ</button>
            <h3 style={{ margin: 0 }}>{selected.count_no}</h3>
            <Badge label={LOCATION_COUNT_STATUS_LABELS[selected.status] ?? selected.status} color={STATUS_COLORS[selected.status] ?? '#64748b'} />
            <span style={{ color: 'var(--tgd-muted-text)', fontSize: 13 }}>
              เริ่ม {formatDateTime(selected.started_at)} · {selected.started_by_email ?? '-'}
              {selected.reviewed_at ? ` · ตรวจแล้ว ${formatDateTime(selected.reviewed_at)}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              ['Location ที่นับ', summary.locations],
              ...Object.keys(LOCATION_COUNT_RESULT_LABELS).map((k) => [LOCATION_COUNT_RESULT_LABELS[k], summary.byResult[k] ?? 0, RESULT_COLORS[k]]),
              ['ต่างรวม (กล่อง)', summary.boxDiff.toLocaleString()],
              ['ต่างรวม (กก.)', formatFixed2(summary.weightDiff)],
            ].map(([label, value, color]) => (
              <div key={label} style={{ flex: '1 1 120px', background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)', borderTop: color ? `3px solid ${color}` : undefined, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={varianceOnly} onChange={(e) => setVarianceOnly(e.target.checked)} data-testid="stock-count-variance-only" />
              เฉพาะที่ไม่ตรง
            </label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport} disabled={!lines.length}>Export Excel</button>
            <Link to="/inventory" className="btn btn-secondary btn-sm">ไปหน้ายอดคงเหลือ (แก้ Location/พาเลท)</Link>
          </div>

          {linesLoading ? <LoadingState /> : (
            <div className="table-wrapper">
              <table className="data-table" style={{ fontSize: 13 }} data-testid="stock-count-line-table">
                <thead>
                  <tr>
                    <th>รูป</th><th>Location / พาเลท</th><th>สินค้า</th><th>LOT / รหัสติดตาม</th>
                    <th style={{ textAlign: 'right' }}>ในระบบ</th><th style={{ textAlign: 'right' }}>นับได้</th><th style={{ textAlign: 'right' }}>ต่าง</th>
                    <th>ผล</th><th>หมายเหตุ / ผู้นับ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLines.length ? visibleLines.map((l) => {
                    const photo = l.deposit_line_id ? photos[l.deposit_line_id] : null;
                    const boxDiff = diff(l.counted_boxes, l.expected_boxes);
                    return (
                      <tr key={l.id}>
                        <td style={{ width: 64 }}>
                          {photo ? (
                            <a href={photo.url} target="_blank" rel="noopener noreferrer">
                              <img src={photo.url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                            </a>
                          ) : <span style={{ color: 'var(--tgd-muted-text)', fontSize: 11 }}>ไม่มีรูป</span>}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{palletLabel(l)}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{l.product_name ?? '-'}</div>
                          <div style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>{l.customer_product_code ?? ''}</div>
                        </td>
                        <td>
                          <div>{l.lot_no ?? '-'}</div>
                          <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--tgd-muted-text)' }}>{l.tracking_code ?? ''}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{Number(l.expected_boxes ?? 0).toLocaleString()}<div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>{formatFixed2(l.expected_weight ?? 0)} กก.</div></td>
                        <td style={{ textAlign: 'right' }}>{Number(l.counted_boxes ?? 0).toLocaleString()}<div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>{formatFixed2(l.counted_weight ?? 0)} กก.</div></td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: boxDiff < 0 ? '#dc2626' : boxDiff > 0 ? '#2563eb' : undefined }}>
                          {boxDiff > 0 ? '+' : ''}{boxDiff.toLocaleString()}
                        </td>
                        <td><Badge label={LOCATION_COUNT_RESULT_LABELS[l.result] ?? l.result} color={RESULT_COLORS[l.result] ?? '#64748b'} /></td>
                        <td>
                          <div>{l.note ?? ''}</div>
                          <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>{l.counted_by_email ?? ''} · {formatDateTime(l.counted_at)}</div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={9}>{varianceOnly ? 'ไม่มีรายการที่ไม่ตรง 🎉' : 'ยังไม่มีผลการนับ'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {canReview && (selected.status === 'SUBMITTED' || selected.status === 'OPEN') && (
            <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {selected.status === 'SUBMITTED' && (
                <>
                  <label className="form-field" style={{ flex: '1 1 320px', margin: 0 }}>
                    <span>หมายเหตุการตรวจ</span>
                    <input className="form-control" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="เช่น แก้ยอดพาเลท 42-R-11-02 แล้ว" />
                  </label>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => changeStatus('REVIEWED')} data-testid="stock-count-mark-reviewed">✓ ตรวจแล้ว</button>
                </>
              )}
              {selected.status === 'OPEN' && (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => changeStatus('CANCELLED')}>ยกเลิกรอบนับ</button>
              )}
            </div>
          )}
          {selected.review_note && selected.status === 'REVIEWED' && (
            <p style={{ marginTop: 16 }}><strong>หมายเหตุการตรวจ:</strong> {selected.review_note}</p>
          )}
        </>
      )}
    </section>
  );
}
