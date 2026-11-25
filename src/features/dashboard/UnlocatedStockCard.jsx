import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, RefreshCw } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.jsx';
import { getUnlocatedStockSummary } from '../../services/unlocatedStockService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { useA5StickerPrint } from '../../components/sticker/A5StickerPrint.jsx';
import { resolveAllergen } from '../../utils/stickerPrint.jsx';

// A5 sheets for unplaced boxes only: placed pallets already got their sticker
// when they were put away. Each lot asks for its pallet count first.
export async function buildUnlocatedA5Entries(items) {
  const customerIds = [...new Set(items.map((i) => i.customerId).filter(Boolean))];
  const catalogs = await Promise.all(customerIds.map((id) => listCustomerProducts({ customerId: id })));
  const catalogByCustomer = new Map(customerIds.map((id, i) => [id, catalogs[i]?.data ?? []]));
  return items.map((item) => {
    const catalogMatch = (catalogByCustomer.get(item.customerId) ?? []).find((p) => p.customer_product_code === item.productCode) ?? null;
    const allergen = resolveAllergen(catalogMatch);
    return {
      lineId: item.lineId,
      manualOnly: true,
      splitBoxes: item.unlocatedBoxes,
      boxesPerPallet: catalogMatch?.default_boxes_per_pallet ?? null,
      baseItem: {
        depositDate: item.receivedAt,
        customerName: item.customerName,
        productCode: item.productCode ?? '',
        productName: item.productName,
        lotNo: item.lotNo,
        mfgDate: item.mfgDate,
        expDate: item.expDate,
        trackingCode: item.trackingCode ?? '-',
        lotBoxes: item.lotBoxes ?? item.inStockBoxes,
        lotWeight: item.lotWeight ?? null,
        allergenStatus: allergen.status,
        allergenText: allergen.text,
      },
    };
  });
}

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

// Summary + preview rows, split out so it renders from plain data (the card
// above loads the data). Every row shrinks to the card width: long customer
// names are cut with "…" (full name in the tooltip) instead of overflowing.
export function UnlocatedStockSummaryBody({ summary, onOpenItem, onViewAll }) {
  const pct = summary?.pct ?? 0;
  return (
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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, marginTop: 10 }}>
      {summary.items.slice(0, PREVIEW_COUNT).map((item) => (
        <button
          key={item.lineId}
          type="button"
          onClick={() => onOpenItem(item)}
          title={`${item.trackingCode ?? '-'} · ${item.customerName}`}
          data-testid="unlocated-stock-item"
          style={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 8px',
            width: '100%', minWidth: 0, boxSizing: 'border-box', textAlign: 'left',
            padding: '8px 10px', borderRadius: 8, border: 'none',
            background: 'rgba(255,191,94,0.12)', color: '#fff', cursor: 'pointer', font: 'inherit',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere', minWidth: 0 }}>{item.trackingCode ?? '-'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, fontVariantNumeric: 'tabular-nums' }}>{item.linePct}%</span>
          <span style={{ gridColumn: '1 / -1', minWidth: 0, fontSize: 12, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.customerName}
          </span>
          <span style={{ gridColumn: '1 / -1', minWidth: 0, fontSize: 12, opacity: 0.85, overflowWrap: 'anywhere' }}>
            ยังไม่วาง {formatNumber(item.unlocatedBoxes)}/{formatNumber(item.inStockBoxes)} กล่อง · รับ {formatDate(item.receivedAt)}
          </span>
        </button>
      ))}
    </div>
    <button
      type="button"
      onClick={onViewAll}
      data-testid="unlocated-stock-view-all"
      style={{ marginTop: 10, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,191,94,0.5)', background: 'transparent', color: AMBER, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
    >
      ดูทั้งหมด {summary.lots} รายการ
    </button>
    </>
  );
}

export function UnlocatedStockCard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [preparing, setPreparing] = useState(false);
  const a5Print = useA5StickerPrint();

  function toggleSelected(lineId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  }

  async function printSelectedA5() {
    const items = (summary?.items ?? []).filter((i) => selectedIds.has(i.lineId));
    if (!items.length) return;
    setPreparing(true);
    const entries = await buildUnlocatedA5Entries(items);
    setPreparing(false);
    setListOpen(false);
    a5Print.requestPrint(entries);
  }

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

  return (
    <div
      data-testid="unlocated-stock-card"
      style={{ alignSelf: 'stretch', minWidth: 0, boxSizing: 'border-box', marginTop: 18, border: '1px solid rgba(255,191,94,0.45)', background: 'rgba(255,191,94,0.08)', borderRadius: 12, padding: 14 }}
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
        <UnlocatedStockSummaryBody summary={summary} onOpenItem={openDeposit} onViewAll={() => setListOpen(true)} />
      )}

      {listOpen && summary && (
        <Modal isOpen onClose={() => setListOpen(false)} title="สินค้าที่ยังไม่ระบุ Location" size="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {summary.lots} lot · {formatNumber(summary.boxes)} กล่อง ({summary.pct}% ของสต็อกในคลัง) · คลิกรายการเพื่อเปิดใบฝากและระบุ Location หรือติ๊กเลือกเพื่อพิมพ์สติ๊กเกอร์ A5 ของกล่องที่ยังไม่วาง
            </div>
            <button
              type="button" className="btn btn-primary btn-sm"
              disabled={selectedIds.size === 0 || preparing || a5Print.busy}
              onClick={printSelectedA5}
              data-testid="unlocated-print-a5"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Printer size={14} aria-hidden="true" />
              {preparing ? 'กำลังเตรียม...' : `พิมพ์ A5 ที่เลือก${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      aria-label="เลือกทั้งหมด"
                      checked={summary.items.length > 0 && summary.items.every((i) => selectedIds.has(i.lineId))}
                      onChange={(e) => setSelectedIds(e.target.checked ? new Set(summary.items.map((i) => i.lineId)) : new Set())}
                      data-testid="unlocated-select-all"
                    />
                  </th>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`เลือก ${item.trackingCode ?? ''}`}
                        checked={selectedIds.has(item.lineId)}
                        onChange={() => toggleSelected(item.lineId)}
                        data-testid={`unlocated-select-${item.lineId}`}
                      />
                    </td>
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
      {a5Print.dialog}
    </div>
  );
}
