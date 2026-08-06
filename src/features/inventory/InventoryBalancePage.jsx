import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { getAllCustomerStockBalances } from '../../services/customerDepositRequestService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { CustomerDepositDetailModal } from '../../components/customer/CustomerDepositDetailModal.jsx';
import { downloadExcelRows } from '../../utils/excelFileUtils.js';
import { formatFixed2 } from '../../utils/numberFormat.js';

const BALANCE_EXPORT_HEADERS = [
  'ลูกค้า', 'รหัสสินค้า', 'ชื่อสินค้า', 'อุณหภูมิ', 'เลขที่ใบฝาก', 'วันที่รับเข้า',
  'LOT', 'รหัสติดตาม', 'คงเหลือ (กล่อง)', 'คงเหลือ (กก.)', 'หมายเหตุลูกค้า', 'หมายเหตุ ADMIN',
];

function balanceExportRow(line, customerLabel) {
  return {
    'ลูกค้า': customerLabel,
    'รหัสสินค้า': line.customer_product_code ?? '-',
    'ชื่อสินค้า': line.product_name ?? '-',
    'อุณหภูมิ': line.temperature_type ?? '-',
    'เลขที่ใบฝาก': line.request?.request_no ?? '-',
    'วันที่รับเข้า': (line.request?.last_action_at ?? line.request?.expected_arrival_date ?? '').slice(0, 10) || '-',
    'LOT': line.lot_no ?? '-',
    'รหัสติดตาม': line.tracking_code ?? '-',
    'คงเหลือ (กล่อง)': line.actual_boxes ?? line.expected_boxes ?? 0,
    'คงเหลือ (กก.)': line.actual_weight ?? line.expected_weight ?? 0,
    'หมายเหตุลูกค้า': line.note ?? '-',
    'หมายเหตุ ADMIN': line.actual_note ?? '-',
  };
}

function TempBadge({ type }) {
  const map = { FROZEN: '#1d6fcf', CHILLED: '#0e7a3a', AMBIENT: '#c97d00' };
  const bg = map[type] ?? '#888';
  return (
    <span style={{
      display: 'inline-block', background: bg, color: '#fff',
      borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 600,
    }}>
      {type ?? '-'}
    </span>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{
      flex: '1 1 140px', minWidth: 130,
      background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)',
      borderRadius: 10, padding: '12px 16px',
      borderTop: color ? `3px solid ${color}` : undefined,
    }}>
      <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {value}{' '}
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--tgd-muted-text)' }}>{unit}</span>
      </div>
    </div>
  );
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    return new Date(isoStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return isoStr; }
}

export function InventoryBalancePage() {
  const [customers, setCustomers] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedTemperature, setSelectedTemperature] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchText, setSearchText] = useState('');
  const [asOfDate, setAsOfDate] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  // customer_product_code has no per-line category snapshot — only the
  // catalog (tgd_customer_products) knows it, keyed the same way
  // movementLedgerReportService.js's catalogCategoryMap already is:
  // "customerId::customer_product_code" (the code alone isn't unique
  // across customers).
  const [categoryMap, setCategoryMap] = useState(new Map());
  const [categoryOptions, setCategoryOptions] = useState([]);

  useEffect(() => {
    getCustomers().then(({ data }) => setCustomers(data ?? []));
    listCustomerProducts().then(({ data }) => {
      const map = new Map();
      const categories = new Set();
      for (const p of (data ?? [])) {
        if (!p.customer_product_code || !p.product_category) continue;
        map.set(`${p.customer_id}::${p.customer_product_code}`, p.product_category);
        categories.add(p.product_category);
      }
      setCategoryMap(map);
      setCategoryOptions([...categories].sort());
    });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getAllCustomerStockBalances(asOfDate || null).then(({ data, error: err }) => {
      if (!active) return;
      setLines(data ?? []);
      setError(err ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [asOfDate]);

  function toggleKey(key) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Filter (customer filter is client-side now that all data is loaded at once)
  const filtered = lines.filter((l) => {
    if (selectedCustomerId && l.request?.customer_id !== selectedCustomerId) return false;
    if (selectedTemperature && l.temperature_type !== selectedTemperature) return false;
    if (selectedCategory) {
      const cid = l.request?.customer_id;
      const category = cid && l.customer_product_code ? categoryMap.get(`${cid}::${l.customer_product_code}`) : null;
      if (category !== selectedCategory) return false;
    }
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      (l.product_name ?? '').toLowerCase().includes(q) ||
      (l.customer_product_code ?? '').toLowerCase().includes(q) ||
      (l.lot_no ?? '').toLowerCase().includes(q) ||
      (l.tracking_code ?? '').toLowerCase().includes(q) ||
      (l.request?.request_no ?? '').toLowerCase().includes(q)
    );
  });

  // Build hierarchy: customerId → productKey → lines[]
  const customerMap = {};
  for (const line of filtered) {
    const cid = line.request?.customer_id ?? '__unknown__';
    const pk = `${line.customer_product_code ?? ''}|${line.product_name ?? ''}`;
    if (!customerMap[cid]) customerMap[cid] = {};
    if (!customerMap[cid][pk]) customerMap[cid][pk] = [];
    customerMap[cid][pk].push(line);
  }

  const customerGroups = Object.entries(customerMap).map(([cid, productMap]) => {
    const customer = customers.find((c) => c.id === cid);
    const productGroups = Object.entries(productMap).map(([pk, pLines]) => {
      const first = pLines[0];
      return {
        productKey: `${cid}::${pk}`,
        productCode: first?.customer_product_code ?? '-',
        productName: first?.product_name ?? '-',
        temperatureType: first?.temperature_type,
        productCategory: first?.customer_product_code ? categoryMap.get(`${cid}::${first.customer_product_code}`) : null,
        totalBoxes: pLines.reduce((s, l) => s + (l.actual_boxes ?? 0), 0),
        totalWeight: pLines.reduce((s, l) => s + (l.actual_weight ?? 0), 0),
        lines: pLines,
      };
    });
    return {
      customerId: cid,
      customerName: customer?.customer_name ?? customer?.customer_code ?? cid,
      totalBoxes: productGroups.reduce((s, p) => s + p.totalBoxes, 0),
      totalWeight: productGroups.reduce((s, p) => s + p.totalWeight, 0),
      products: productGroups,
    };
  });

  const grandTotalBoxes = customerGroups.reduce((s, g) => s + g.totalBoxes, 0);
  const grandTotalWeight = customerGroups.reduce((s, g) => s + g.totalWeight, 0);
  const uniqueProducts = new Set(filtered.map((l) => l.customer_product_code ?? l.product_name)).size;

  function handleExportExcel() {
    const rows = filtered.map((line) => {
      const customer = customers.find((c) => c.id === line.request?.customer_id);
      const customerLabel = customer?.customer_name ?? customer?.customer_code ?? line.request?.customer_id ?? '-';
      return balanceExportRow(line, customerLabel);
    });
    const stamp = asOfDate || new Date().toISOString().slice(0, 10);
    downloadExcelRows(rows, BALANCE_EXPORT_HEADERS, `stock-balance-${stamp}.xlsx`, 'Stock Balance');
  }

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title="ยอดคงเหลือสินค้า"
        description={asOfDate
          ? `ยอดคงเหลือ ณ วันที่ ${formatDate(asOfDate)} — สินค้าที่รับเข้าคลังและยืนยันแล้วภายในวันดังกล่าว หักการเบิกที่เสร็จสิ้นแล้วภายในวันดังกล่าว`
          : 'สินค้าที่รับเข้าคลังแล้ว หักการเบิกที่ยืนยันแล้ว (เฉพาะรายการที่มียอดคงเหลือ)'}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <label className="form-field" style={{ margin: 0, flex: '0 0 260px' }}>
          <span>เลือกลูกค้า</span>
          <select
            className="form-control"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">-- ลูกค้าทุกราย --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.customer_code} · {c.customer_name}</option>
            ))}
          </select>
        </label>
        <label className="form-field" style={{ margin: 0, flex: '0 0 160px' }}>
          <span>อุณหภูมิ</span>
          <select
            className="form-control"
            value={selectedTemperature}
            onChange={(e) => setSelectedTemperature(e.target.value)}
          >
            <option value="">-- ทุกอุณหภูมิ --</option>
            <option value="FROZEN">FROZEN</option>
            <option value="CHILLED">CHILLED</option>
            <option value="AMBIENT">AMBIENT</option>
          </select>
        </label>
        <label className="form-field" style={{ margin: 0, flex: '0 0 180px' }}>
          <span>ประเภทสินค้า</span>
          <select
            className="form-control"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">-- ทุกประเภท --</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="form-field" style={{ margin: 0, flex: '1 1 220px' }}>
          <span>ค้นหา</span>
          <input
            className="form-control"
            type="search"
            placeholder="ชื่อสินค้า / รหัส / LOT / รหัสติดตาม / เลขที่ใบฝาก"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </label>
        <label className="form-field" style={{ margin: 0, flex: '0 0 180px' }}>
          <span>ณ วันที่ (เว้นว่าง = ปัจจุบัน)</span>
          <input
            className="form-control"
            type="date"
            data-testid="inventory-balance-as-of-date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </label>
        {(selectedCustomerId || searchText || selectedTemperature || selectedCategory || asOfDate) && (
          <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-end' }}
            onClick={() => { setSelectedCustomerId(''); setSearchText(''); setSelectedTemperature(''); setSelectedCategory(''); setAsOfDate(''); }}>
            ล้างตัวกรอง
          </button>
        )}
        <button
          type="button" className="btn btn-outline" style={{ alignSelf: 'flex-end' }}
          onClick={() => setExpandedKeys(expandedKeys.size > 0 ? new Set() : new Set(customerGroups.flatMap((g) => g.products.map((p) => p.productKey))))}
        >
          {expandedKeys.size > 0 ? '▲ ย่อทั้งหมด' : '▼ ขยายทั้งหมด'}
        </button>
        <button
          type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-end' }}
          onClick={handleExportExcel}
          disabled={filtered.length === 0}
          data-testid="inventory-balance-export-excel"
        >
          Export Excel
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <StatCard label="ลูกค้า" value={customerGroups.length} unit="ราย" color="#3b82f6" />
          <StatCard label="ประเภทสินค้า" value={uniqueProducts} unit="รายการ" color="#8b5cf6" />
          <StatCard label="กล่องคงเหลือรวม" value={grandTotalBoxes.toLocaleString()} unit="กล่อง" color="#22c55e" />
          <StatCard label="น้ำหนักคงเหลือรวม" value={formatFixed2(grandTotalWeight)} unit="กก." color="#f59e0b" />
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="banner banner-danger" role="alert">{error.message ?? 'โหลดข้อมูลไม่สำเร็จ'}</div>
      ) : customerGroups.length === 0 ? (
        <div className="table-card">
          <p style={{ padding: '24px', textAlign: 'center', color: 'var(--tgd-muted-text)' }}>
            {lines.length === 0 ? 'ยังไม่มีสินค้าที่รับเข้าคลัง' : 'ไม่พบสินค้าที่ตรงกับเงื่อนไข'}
          </p>
        </div>
      ) : (
        <div className="table-card" style={{ overflow: 'hidden', padding: 0 }}>
          {customerGroups.map((cg) => (
            <div key={cg.customerId}>
              {/* Customer header row */}
              <div style={{
                background: 'var(--tgd-primary-dark, #1a2236)',
                color: '#fff',
                padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>👤 {cg.customerName}</span>
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  รวม {cg.totalBoxes.toLocaleString()} กล่อง · {formatFixed2(cg.totalWeight)} กก.
                </span>
                <span style={{ fontSize: 12, opacity: 0.6 }}>{cg.products.length} ประเภทสินค้า</span>
              </div>

              {/* Products under this customer */}
              {cg.products.map((pg) => {
                const isExpanded = expandedKeys.has(pg.productKey);
                return (
                  <div key={pg.productKey}>
                    {/* Product row (clickable to expand) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleKey(pg.productKey)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleKey(pg.productKey); } }}
                      style={{
                        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, width: '100%',
                        textAlign: 'left', background: isExpanded ? '#f0f7ff' : 'var(--tgd-surface)',
                        border: 'none', borderBottom: '1px solid var(--tgd-border)',
                        padding: '16px 16px 16px 32px',
                        cursor: 'pointer', color: 'var(--tgd-text)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 14, color: 'var(--tgd-muted-text)', width: 16, flexShrink: 0 }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{pg.productCode}</span>
                        {pg.productCode !== pg.productName && (
                          <span style={{ color: 'var(--tgd-muted-text)', fontSize: 13 }}>{pg.productName}</span>
                        )}
                        {pg.temperatureType && <TempBadge type={pg.temperatureType} />}
                        {pg.productCategory && (
                          <span style={{ fontSize: 11, color: 'var(--tgd-muted-text)', border: '1px solid var(--tgd-border)', borderRadius: 4, padding: '1px 6px' }}>
                            {pg.productCategory}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>กล่อง</div>
                          <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>{pg.totalBoxes.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>น้ำหนัก (กก.)</div>
                          <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>{formatFixed2(pg.totalWeight)}</div>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>{pg.lines.length} ใบฝาก</span>
                      </div>
                    </div>

                    {/* Expanded CDR lines */}
                    {isExpanded && (
                      <div style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                              <th style={{ padding: '12px 16px 12px 48px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase' }}>เลขที่ใบฝาก</th>
                              <th style={{ padding: '12px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase' }}>วันที่รับเข้า</th>
                              <th style={{ padding: '12px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase' }}>LOT</th>
                              <th style={{ padding: '12px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase' }}>รหัสติดตาม</th>
                              <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase' }}>คงเหลือ (กล่อง)</th>
                              <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase' }}>คงเหลือ (กก.)</th>
                              <th style={{ padding: '12px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase', maxWidth: 160 }}>หมายเหตุลูกค้า</th>
                              <th style={{ padding: '12px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase', maxWidth: 160 }}>หมายเหตุ Admin</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, textTransform: 'uppercase' }}>รายละเอียด</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pg.lines.map((l) => (
                              <tr key={l.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '16px 16px 16px 48px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--tgd-primary, #2563eb)' }}>
                                  {l.request?.request_no ?? '-'}
                                </td>
                                <td style={{ padding: '16px 12px', color: 'var(--tgd-text)' }}>
                                  {l.request?.last_action_at
                                    ? formatDate(l.request.last_action_at)
                                    : formatDate(l.request?.expected_arrival_date)}
                                </td>
                                <td style={{ padding: '16px 12px', color: 'var(--tgd-muted-text)', fontFamily: 'monospace' }}>
                                  {l.lot_no ?? '-'}
                                </td>
                                <td style={{ padding: '16px 12px', color: 'var(--tgd-text)', fontFamily: 'monospace', fontWeight: 600 }}>
                                  {l.tracking_code ?? '-'}
                                </td>
                                <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                                  {l.actual_boxes?.toLocaleString() ?? (
                                    <span style={{ color: 'var(--tgd-muted-text)', fontWeight: 400 }}>{l.expected_boxes ?? '-'}</span>
                                  )}
                                </td>
                                <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                                  {l.actual_weight != null ? formatFixed2(l.actual_weight) : (
                                    <span style={{ color: 'var(--tgd-muted-text)', fontWeight: 400 }}>{formatFixed2(l.expected_weight)}</span>
                                  )}
                                </td>
                                <td
                                  style={{ padding: '16px 12px', color: 'var(--tgd-muted-text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  title={l.note ?? ''}
                                >
                                  {l.note ?? '-'}
                                </td>
                                <td
                                  style={{ padding: '16px 12px', color: 'var(--tgd-muted-text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  title={l.actual_note ?? ''}
                                >
                                  {l.actual_note ?? '-'}
                                </td>
                                <td style={{ padding: '16px 16px', textAlign: 'center' }}>
                                  {l.request?.id && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => setDetailId(l.request.id)}
                                    >
                                      ดูรายละเอียด
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <p style={{ fontSize: 12, color: 'var(--tgd-muted-text)', padding: '8px 16px' }}>
            แสดง {filtered.length} รายการ (เฉพาะรายการที่มียอดคงเหลือ — หักการเบิกสินค้าที่ยืนยันแล้ว)
          </p>
        </div>
      )}

      <CustomerDepositDetailModal
        requestId={detailId}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onStatusChange={() => {}}
      />
    </section>
  );
}
