import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.jsx';
import { getUnlocatedStockSummary } from '../../services/unlocatedStockService.js';

// "ยังไม่ระบุ Location": stock in the warehouse that was received but never
// put on a pallet location. Lives in the dark side panel of the room map.
// The read covers every in-stock deposit line, so it refreshes every 5
// minutes (and on demand) rather than with the map's 30 s poll.

const REFRESH_MS = 5 * 60 * 1000;
const PREVIEW_COUNT = 3;
const AMBER = '#ffbf5e';

function formatNumber(n) {
  return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
}

export function UnlocatedStockCard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    getUnlocatedStockSummary().then(({ data, error: err }) => {
      if (!current) return;
      setLoading(false);
      if (err) { setError('โหลดข้อมูลสินค้าที่ยังไม่ระบุ Location ไม่สำเร็จ'); return; }
      setError('');
      setSummary(data);
    });
    return () => { current = false; };
  }, [refreshKey]);

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey((k) => k + 1), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  function openDeposit(item) {
    setListOpen(false);
    if (item.depositRequestId) navigate(`/customer/admin/deposit-review/${item.depositRequestId}`);
  }

  const pct = summary?.pct ?? 0;

  return (
    <div
      data-testid="unlocated-stock-card"
      style={{ alignSelf: 'stretch', marginTop: 18, border: '1px solid rgba(255,191,94,0.45)', background: 'rgba(255,191,94,0.08)', borderRadius: 12, padding: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: AMBER, letterSpacing: '0.06em', flex: 1 }}>ยังไม่ระบุ LOCATION</div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          aria-label="โหลดข้อมูลสินค้าที่ยังไม่ระบุ Location ใหม่"
          style={{ background: 'transparent', border: 'none', color: AMBER, cursor: 'pointer', padding: 4, display: 'inline-flex' }}
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <div style={{ fontSize: 12, color: '#ffd7a8' }}>{error}</div>
      ) : loading && !summary ? (
        <div style={{ fontSize: 12, opacity: 0.75 }}>กำลังโหลด...</div>
      ) : summary?.lots === 0 ? (
        <div style={{ fontSize: 13, color: '#c9f2d8', fontWeight: 600 }}>สินค้าทุก lot มี Location แล้ว</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span data-testid="unlocated-stock-pct" style={{ fontSize: 28, fontWeight: 900, color: AMBER, lineHeight: 1.1 }}>{pct}%</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>
              {formatNumber(summary.boxes)} กล่อง · {summary.lots} lot
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 6, overflow: 'hidden', margin: '8px 0 6px' }}>
            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: AMBER, borderRadius: 6 }} />
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>
            จากสต็อกในคลังทั้งหมด {formatNumber(summary.totalBoxes)} กล่อง
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {summary.items.slice(0, PREVIEW_COUNT).map((item) => (
              <button
                key={item.lineId}
                type="button"
                onClick={() => openDeposit(item)}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 8px', textAlign: 'left', padding: '7px 9px', borderRadius: 8, border: 'none', background: 'rgba(255,191,94,0.12)', color: '#fff', cursor: 'pointer', font: 'inherit' }}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>{item.trackingCode ?? '-'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: AMBER }}>{item.linePct}%</span>
                <span style={{ gridColumn: '1 / -1', fontSize: 11, opacity: 0.8 }}>
                  {item.customerName} · ยังไม่วาง {formatNumber(item.unlocatedBoxes)}/{formatNumber(item.inStockBoxes)} กล่อง · รับ {formatDate(item.receivedAt)}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setListOpen(true)}
            data-testid="unlocated-stock-view-all"
            style={{ marginTop: 10, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,191,94,0.5)', background: 'transparent', color: AMBER, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            ดูทั้งหมด {summary.lots} รายการ
          </button>
        </>
      )}

      {listOpen && summary && (
        <Modal isOpen onClose={() => setListOpen(false)} title="สินค้าที่ยังไม่ระบุ Location" size="lg">
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {summary.lots} lot · {formatNumber(summary.boxes)} กล่อง ({summary.pct}% ของสต็อกในคลัง) · คลิกรายการเพื่อเปิดใบฝากและระบุ Location
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>รหัสติดตาม</th>
                  <th>ลูกค้า</th>
                  <th>สินค้า</th>
                  <th style={{ textAlign: 'right' }}>ยังไม่วาง / คงคลัง (กล่อง)</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                  <th>วันที่รับ</th>
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item) => (
                  <tr key={item.lineId} onClick={() => openDeposit(item)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 700 }}>{item.trackingCode ?? '-'}</td>
                    <td>{item.customerName}</td>
                    <td>{item.productCode ? `${item.productCode} ` : ''}{item.productName ?? '-'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(item.unlocatedBoxes)} / {formatNumber(item.inStockBoxes)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.linePct}%</td>
                    <td>{formatDate(item.receivedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
