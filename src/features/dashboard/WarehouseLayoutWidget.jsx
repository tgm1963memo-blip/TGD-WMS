import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSectionsWithOccupancy, getStockAtLocation } from '../../services/warehouseLayoutService.js';
import { getCustomers, getProducts } from '../../services/masterDataService.js';

function pctColor(pct) {
  if (pct >= 80) return '#e74c3c';
  if (pct >= 60) return '#e07b00';
  if (pct >= 40) return '#f0c419';
  return '#3498db';
}

function CircularProgress({ pct, size = 120, strokeWidth = 10, color = '#f0a500' }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

function SectionGrid({ section, onLocClick }) {
  const [hovered, setHovered] = useState(null);
  const { rows, cols, locations, gridInfo } = section;
  const total = rows * cols;

  const locMap = useMemo(() => {
    const map = {};
    for (const loc of locations || []) {
      if (loc?.location_code) map[loc.location_code] = loc;
    }
    return map;
  }, [locations]);

  // Modern Asymmetric Rendering
  if (gridInfo?.sidesConfig) {
    const leftConfig = gridInfo.sidesConfig.L || { rows: 0, levels: 0 };
    const rightConfig = gridInfo.sidesConfig.R || { rows: 0, levels: 0 };
    const zoneCode = section.code;

    const renderDot = (side, r, c) => {
      const rowStr = String(r).padStart(2, '0');
      const lvStr = String(c).padStart(2, '0');
      const code = `${zoneCode}-${side}-${rowStr}-${lvStr}`;
      const loc = locMap[code];
      const isOccupied = loc?.isOccupied ?? false;

      return (
        <div
          key={code}
          onMouseEnter={() => setHovered({ code, row: r, col: c, isOccupied })}
          onMouseLeave={() => setHovered(null)}
          onClick={() => isOccupied && loc && onLocClick?.(loc.id, code)}
          title={code}
          style={{
            width: 14, height: 14,
            borderRadius: '50%',
            background: !loc ? '#e2e8f0' : isOccupied ? '#f59e0b' : '#10b981',
            boxShadow: isOccupied ? '0 0 8px rgba(245, 158, 11, 0.4)' : 'none',
            cursor: isOccupied ? 'pointer' : 'default',
            transition: 'transform 0.2s, opacity 0.2s',
            transform: hovered?.code === code ? 'scale(1.5)' : 'scale(1)',
            opacity: hovered && hovered.code !== code ? 0.6 : 1,
          }}
        />
      );
    };

    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
        {/* Left Aisle — horizontal band: each column = 1 row, each grid row = 1 level */}
        {leftConfig.rows > 0 && leftConfig.levels > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${leftConfig.rows}, 1fr)`, gap: 6 }}>
            {Array.from({ length: leftConfig.rows * leftConfig.levels }).map((_, idx) => {
              const r = (idx % leftConfig.rows) + 1;
              const c = Math.floor(idx / leftConfig.rows) + 1;
              return renderDot('L', r, c);
            })}
          </div>
        )}

        {/* Walking Path — horizontal */}
        {(leftConfig.rows > 0 || rightConfig.rows > 0) && (
          <div style={{ height: 8, background: 'rgba(0,0,0,0.04)', borderRadius: 4 }} />
        )}

        {/* Right Aisle — horizontal band */}
        {rightConfig.rows > 0 && rightConfig.levels > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rightConfig.rows}, 1fr)`, gap: 6 }}>
            {Array.from({ length: rightConfig.rows * rightConfig.levels }).map((_, idx) => {
              const r = (idx % rightConfig.rows) + 1;
              const c = Math.floor(idx / rightConfig.rows) + 1;
              return renderDot('R', r, c);
            })}
          </div>
        )}

        {hovered && (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.85)', color: '#fff',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 12, padding: '12px 16px',
            fontSize: 13, fontWeight: 600,
            pointerEvents: 'none',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            minWidth: 160, whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>{section.name}</div>
            <div>{hovered.code}</div>
            <div style={{ marginTop: 4, fontWeight: 400, fontSize: 12 }}>
              {hovered.isOccupied ? '🟠 มีสินค้า' : '⬜ ว่าง'}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback Legacy Rendering
  const halfCols = Math.ceil(cols / 2);
  const leftCols = halfCols;
  const rightCols = cols - halfCols;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows}, 1fr)`, gap: 6 }}>
        {Array.from({ length: rows * leftCols }).map((_, idx) => {
          const row = (idx % rows) + 1;
          const col = Math.floor(idx / rows) + 1;
          const globalIdx = (row - 1) * cols + (col - 1);
          const loc = (locations || [])[globalIdx];
          const isOccupied = loc?.isOccupied ?? false;
          return (
            <div
              key={`L-${idx}`}
              onMouseEnter={() => setHovered({ idx: globalIdx, row, col, isOccupied, code: loc?.location_code })}
              onMouseLeave={() => setHovered(null)}
              onClick={() => isOccupied && loc && onLocClick?.(loc.id, loc.location_code)}
              title={loc?.location_code ?? `R${row}C${col}`}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: !loc ? '#e2e8f0' : isOccupied ? '#f59e0b' : '#10b981',
                boxShadow: isOccupied ? '0 0 8px rgba(245, 158, 11, 0.4)' : 'none',
                cursor: isOccupied ? 'pointer' : 'default',
                transition: 'transform 0.2s, opacity 0.2s',
                transform: hovered?.idx === globalIdx ? 'scale(1.5)' : 'scale(1)',
                opacity: hovered && hovered.idx !== globalIdx ? 0.6 : 1,
              }}
            />
          );
        })}
      </div>

      <div style={{ height: 8, background: 'rgba(0,0,0,0.04)', borderRadius: 4 }} />

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows}, 1fr)`, gap: 6 }}>
        {Array.from({ length: rows * rightCols }).map((_, idx) => {
          const row = (idx % rows) + 1;
          const col = leftCols + Math.floor(idx / rows) + 1;
          const globalIdx = (row - 1) * cols + (col - 1);
          const loc = (locations || [])[globalIdx];
          const isOccupied = loc?.isOccupied ?? false;
          return (
            <div
              key={`R-${idx}`}
              onMouseEnter={() => setHovered({ idx: globalIdx, row, col, isOccupied, code: loc?.location_code })}
              onMouseLeave={() => setHovered(null)}
              onClick={() => isOccupied && loc && onLocClick?.(loc.id, loc.location_code)}
              title={loc?.location_code ?? `R${row}C${col}`}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: !loc ? '#e2e8f0' : isOccupied ? '#f59e0b' : '#10b981',
                boxShadow: isOccupied ? '0 0 8px rgba(245, 158, 11, 0.4)' : 'none',
                cursor: isOccupied ? 'pointer' : 'default',
                transition: 'transform 0.2s, opacity 0.2s',
                transform: hovered?.idx === globalIdx ? 'scale(1.5)' : 'scale(1)',
                opacity: hovered && hovered.idx !== globalIdx ? 0.6 : 1,
              }}
            />
          );
        })}
      </div>

      {hovered && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.85)', color: '#fff',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 12, padding: '12px 16px',
          fontSize: 13, fontWeight: 600,
          pointerEvents: 'none',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          minWidth: 160, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>{section.name}</div>
          <div>{hovered.code ?? `แถว ${hovered.row} · ช่อง ${hovered.col}`}</div>
          <div style={{ marginTop: 4, fontWeight: 400, fontSize: 12 }}>
            {hovered.isOccupied ? '🟠 มีสินค้า' : '⬜ ว่าง'}
          </div>
        </div>
      )}
    </div>
  );
}

export function WarehouseLayoutWidget() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [customerMap, setCustomerMap] = useState({});
  const [productMap, setProductMap] = useState({});
  const [stockModal, setStockModal] = useState(null); // { locId, locCode }
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSectionsWithOccupancy().then(({ data }) => {
      setSections(data ?? []);
      if (data?.length) setSelectedId((prev) => prev ?? data[0].id);
      setLoading(false);
    });
    Promise.all([getCustomers({ isActive: true }), getProducts({ isActive: true })]).then(
      ([cRes, pRes]) => {
        const cMap = {};
        for (const c of cRes.data ?? []) cMap[c.id] = c.customer_name ?? c.customer_code ?? c.id;
        const pMap = {};
        for (const p of pRes.data ?? []) pMap[p.id] = p.product_name ?? p.sku ?? p.id;
        setCustomerMap(cMap);
        setProductMap(pMap);
      }
    );
  }, [refreshKey]);

  function handleLocClick(locId, locCode) {
    setStockModal({ locId, locCode });
    setStockItems([]);
    setStockLoading(true);
    getStockAtLocation(locId).then(({ data, error }) => {
      if (error) {
        setStockItems([]);
      } else {
        const itemsWithAvailable = (data ?? []).map(item => ({
          ...item,
          qty_available: item.qty_on_hand - (item.qty_allocated || 0)
        }));
        setStockItems(itemsWithAvailable);
      }
      setStockLoading(false);
    });
  }

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];

  if (loading && sections.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>กำลังโหลดผังคลัง...</div>
    );
  }

  if (sections.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
        <div style={{ fontWeight: 600, fontSize: 15, color: '#475569', marginBottom: 8 }}>
          ยังไม่มีการตั้งค่าผังคลัง
        </div>
        <div style={{ fontSize: 13, marginBottom: 18 }}>กำหนด Section และ Location ก่อนเพื่อแสดงผัง</div>
        <button
          type="button"
          onClick={() => navigate('/admin/warehouse-locations')}
          style={{ padding: '10px 20px', borderRadius: 10, background: '#2d9348', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
        >
          ตั้งค่า Location คลัง
        </button>
      </div>
    );
  }

  if (!selected) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0, minHeight: 500 }}>

      {/* Left: grid + section list */}
      <div style={{ padding: '20px' }}>
        {/* Section tabs */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSelectedId(sec.id)}
              style={{
                padding: '6px 14px',
                border: sec.id === selected.id ? '2px solid #2d9348' : '2px solid #e5e7eb',
                borderRadius: 20,
                background: sec.id === selected.id ? '#2d9348' : '#fff',
                color: sec.id === selected.id ? '#fff' : '#374151',
                cursor: 'pointer', fontSize: 13, fontWeight: sec.id === selected.id ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {sec.name}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              style={{
                padding: '6px 12px', border: '2px solid #e5e7eb', borderRadius: 20,
                background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, color: '#64748b',
              }}
              title="รีเฟรชผังคลัง"
            >
              {loading ? '⟳ กำลังโหลด...' : '⟳ รีเฟรช'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/warehouse-locations')}
              style={{
                padding: '6px 12px', border: '2px solid #e5e7eb', borderRadius: 20,
                background: '#fff', cursor: 'pointer', fontSize: 12, color: '#64748b',
              }}
            >
              ⚙ ตั้งค่า Location
            </button>
          </div>
        </div>

        {/* Date + legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>{selected.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                ว่าง
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px rgba(245, 158, 11, 0.4)', display: 'inline-block' }} />
                มีสินค้า
              </span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ background: '#f8fafb', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          {selected.total > 0 ? (
            <SectionGrid section={selected} onLocClick={handleLocClick} />
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
              Section นี้ยังไม่มี Location
            </div>
          )}
        </div>

        {/* Section list */}
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 10 }}>รายการ Section ทั้งหมด</div>
        <div>
          {sections.map((sec) => {
            const color = pctColor(sec.usedPct);
            return (
              <div
                key={sec.id}
                onClick={() => setSelectedId(sec.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  background: sec.id === selected.id ? '#f0fdf4' : '#fff',
                  border: `1px solid ${sec.id === selected.id ? '#bbf7d0' : '#f1f5f9'}`,
                  marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: sec.id === selected.id ? 700 : 500, fontSize: 14, color: '#1e293b' }}>
                    {sec.name}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>{sec.total} location</span>
                </div>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>ใช้งาน</span>
                <div style={{ width: 100, height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${sec.usedPct}%`, background: color, borderRadius: 4 }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color, width: 36, textAlign: 'right' }}>{sec.usedPct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: stats panel */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
        borderRadius: '0 16px 16px 0',
        padding: '32px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        color: '#fff',
        boxShadow: '-4px 0 15px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, alignSelf: 'flex-start' }}>
          {selected.name}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 24, alignSelf: 'flex-start' }}>การใช้งาน</div>

        <div style={{ position: 'relative', width: 130, height: 130, marginBottom: 20 }}>
          <CircularProgress pct={selected.usedPct} size={130} strokeWidth={12} color="#f0a500" />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{selected.usedPct}%</div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>ใช้งาน</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{selected.used}</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>มีสินค้า</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{selected.empty}</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>ว่าง</div>
          </div>
        </div>

        <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.15)', marginBottom: 20 }} />

        <div style={{ alignSelf: 'stretch' }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            สรุปทุก Section
          </div>
          {sections.slice(0, 6).map((sec) => (
            <div key={sec.id}
              onClick={() => setSelectedId(sec.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 12, flex: 1, opacity: sec.id === selected.id ? 1 : 0.75, fontWeight: sec.id === selected.id ? 700 : 400 }}>
                {sec.code}
              </div>
              <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${sec.usedPct}%`, background: sec.usedPct >= 80 ? '#ef4444' : '#f0a500', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, width: 30, textAlign: 'right', opacity: sec.id === selected.id ? 1 : 0.75 }}>
                {sec.usedPct}%
              </div>
            </div>
          ))}
          {sections.length > 6 && (
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>+{sections.length - 6} section อื่น</div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => navigate('/admin/warehouse-locations')}
          style={{
            alignSelf: 'stretch', marginTop: 20,
            padding: '10px', border: '2px solid rgba(255,255,255,0.35)',
            borderRadius: 10, background: 'rgba(255,255,255,0.12)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          ⚙ ตั้งค่า Location
        </button>
      </div>

      {/* Stock detail modal */}
      {stockModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setStockModal(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: 28,
              minWidth: 360, maxWidth: 520, width: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              maxHeight: '80vh', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#1e293b' }}>รายละเอียดสินค้าใน Location</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{stockModal.locCode}</div>
              </div>
              <button
                type="button"
                onClick={() => setStockModal(null)}
                style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 18, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {stockLoading ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>กำลังโหลด...</div>
            ) : stockItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>ไม่มีสินค้าใน Location นี้</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stockItems.map((item) => (
                  <div key={item.id} style={{ background: '#f8fafb', borderRadius: 12, padding: '14px 16px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 8 }}>
                      {productMap[item.product_id] ?? item.product_id}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
                      <div style={{ color: '#64748b' }}>ลูกค้า</div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{customerMap[item.customer_id] ?? item.customer_id}</div>
                      <div style={{ color: '#64748b' }}>จำนวนคงเหลือ</div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{item.qty_on_hand} {item.uom}</div>
                      <div style={{ color: '#64748b' }}>จำนวนพร้อมจ่าย</div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{item.qty_available} {item.uom}</div>
                      {item.weight != null && (
                        <>
                          <div style={{ color: '#64748b' }}>น้ำหนัก</div>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{item.weight} kg</div>
                        </>
                      )}
                      {item.tgd_lots?.lot_number && (
                        <>
                          <div style={{ color: '#64748b' }}>Lot</div>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{item.tgd_lots.lot_number}</div>
                        </>
                      )}
                      {item.tgd_lots?.expiry_date && (
                        <>
                          <div style={{ color: '#64748b' }}>วันหมดอายุ</div>
                          <div style={{ fontWeight: 600, color: '#e07b00' }}>
                            {new Date(item.tgd_lots.expiry_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </div>
                        </>
                      )}
                      {item.pallet_id && (
                        <>
                          <div style={{ color: '#64748b' }}>Pallet</div>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{item.pallet_id}</div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
