import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { getCustomerStockBalance } from '../../services/customerDepositRequestService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatFixed2 } from '../../utils/numberFormat.js';
import { exportCustomerStockBalanceExcel } from '../../utils/customerStockBalanceExcelUtils.js';

function TempBadge({ type }) {
  const map = { FROZEN: '#1d6fcf', CHILLED: '#0e7a3a', AMBIENT: '#c97d00' };
  return (
    <span style={{
      display: 'inline-block',
      background: map[type] ?? '#888',
      color: '#fff',
      borderRadius: 4,
      padding: '1px 8px',
      fontSize: 11,
      fontWeight: 600,
    }}>
      {type ?? '-'}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return iso; }
}


export function CustomerStockBalancePage() {


  const t = useTranslation();
  const { customerId, loading: profileLoading } = useCustomerPortalProfile();
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const { sortedData, requestSort, getSortIndicator } = useTableSort(lines);

  useEffect(() => {
    let active = true;
    if (profileLoading) return undefined;
    if (!customerId) { setLoading(false); return undefined; }

    setLoading(true);
    setError(null);

    getCustomerStockBalance(customerId).then(({ data, error: err }) => {
      if (!active) return;
      setLines(data ?? []);
      setError(err ?? null);
      setLoading(false);
    });

    return () => { active = false; };
  }, [customerId, profileLoading]);

  function toggleKey(key) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const filtered = lines.filter((l) => {
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

  // Group by product (code + name)
  const productMap = {};
  for (const line of filtered) {
    const pk = `${line.customer_product_code ?? ''}|${line.product_name ?? ''}`;
    if (!productMap[pk]) productMap[pk] = [];
    productMap[pk].push(line);
  }
  const productGroups = Object.entries(productMap).map(([pk, pLines]) => {
    const first = pLines[0];
    return {
      productKey: pk,
      productCode: first?.customer_product_code ?? '-',
      productName: first?.product_name ?? '-',
      temperatureType: first?.temperature_type,
      totalBoxes: pLines.reduce((s, l) => s + (l.actual_boxes ?? 0), 0),
      totalWeight: pLines.reduce((s, l) => s + (Number(l.actual_weight) ?? 0), 0),
      lines: pLines,
    };
  });

  const grandBoxes = productGroups.reduce((s, g) => s + g.totalBoxes, 0);
  const grandWeight = productGroups.reduce((s, g) => s + g.totalWeight, 0);

  if (profileLoading || loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-stock-balance-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-stock-balance-page">
      <PageHeader
        title={t('customer_stock_balance_title')}
        description={t('customer_stock_balance_description')}
        actions={<span className="status-badge status-badge--open" data-testid="customer-stock-live-badge">{t('customer_live_data_badge')}</span>}
      />

      <CustomerPortalLiveBanner />

      {!customerId ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}

      {error ? (
        <div className="banner banner-danger" role="alert">{error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      {customerId && !error && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: '1 1 140px', background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #8b5cf6' }}>
              <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)', marginBottom: 4 }}>ประเภทสินค้า</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{productGroups.length} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--tgd-muted-text)' }}>รายการ</span></div>
            </div>
            <div style={{ flex: '1 1 140px', background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #22c55e' }}>
              <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)', marginBottom: 4 }}>กล่องคงเหลือรวม</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{grandBoxes.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--tgd-muted-text)' }}>กล่อง</span></div>
            </div>
            <div style={{ flex: '1 1 140px', background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #f59e0b' }}>
              <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)', marginBottom: 4 }}>น้ำหนักคงเหลือรวม</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{formatFixed2(grandWeight)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--tgd-muted-text)' }}>กก.</span></div>
            </div>
          </div>

          {/* Search + expand */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <label className="form-field" style={{ margin: 0, flex: '1 1 220px' }}>
              <span>ค้นหาสินค้า</span>
              <input
                className="form-control"
                type="search"
                placeholder="ชื่อสินค้า / รหัส / LOT / รหัสติดตาม / เลขที่ใบฝาก"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </label>
            {productGroups.length > 0 && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => setExpandedKeys(expandedKeys.size > 0 ? new Set() : new Set(productGroups.map((p) => p.productKey)))}
              >
                {expandedKeys.size > 0 ? '▲ ย่อทั้งหมด' : '▼ ขยายทั้งหมด'}
              </button>
            )}
            {filtered.length > 0 && (
              <button
                type="button"
                className="btn btn-outline"
                data-testid="customer-stock-balance-export-excel"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => exportCustomerStockBalanceExcel(filtered, `customer-stock-balance-${new Date().toISOString().slice(0, 10)}.xlsx`)}
              >
                ดาวน์โหลด Excel
              </button>
            )}
          </div>

          <div className="table-card" style={{ overflow: 'hidden', padding: 0 }}>
            {productGroups.length === 0 ? (
              <p style={{ padding: '24px', textAlign: 'center', color: 'var(--tgd-muted-text)' }}>
                {lines.length === 0 ? 'ยังไม่มีสินค้าที่รับเข้าคลัง' : 'ไม่พบสินค้าที่ตรงกับเงื่อนไข'}
              </p>
            ) : productGroups.map((pg) => {
              const isExpanded = expandedKeys.has(pg.productKey);
              return (
                <div key={pg.productKey}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleKey(pg.productKey)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleKey(pg.productKey); } }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      textAlign: 'left', background: isExpanded ? '#f0f7ff' : 'var(--tgd-surface)',
                      border: 'none', borderBottom: '1px solid var(--tgd-border)',
                      padding: '16px 16px', cursor: 'pointer', color: 'var(--tgd-text)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 14, color: 'var(--tgd-muted-text)', width: 16, flexShrink: 0 }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{pg.productCode}</span>
                      {pg.productCode !== pg.productName && (
                        <span style={{ color: 'var(--tgd-muted-text)', fontSize: 13, marginLeft: 8 }}>{pg.productName}</span>
                      )}
                      {pg.temperatureType && <span style={{ marginLeft: 10 }}><TempBadge type={pg.temperatureType} /></span>}
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>กล่อง</div>
                        <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>{pg.totalBoxes.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>น้ำหนัก</div>
                        <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>{formatFixed2(pg.totalWeight)} กก.</div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>{pg.lines.length} ใบฝาก</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ padding: '8px 16px 8px 32px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>เลขที่ใบฝาก</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>วันที่รับเข้า</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>LOT</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>รหัสติดตาม</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>วันผลิต</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>วันหมดอายุ</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>คงเหลือ (กล่อง)</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>คงเหลือ (กก.)</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, maxWidth: 140 }}>หมายเหตุลูกค้า</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11, maxWidth: 140 }}>หมายเหตุ Admin</th>
                            <th style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>รายละเอียด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pg.lines.map((l) => (
                            <tr key={l.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '10px 16px 10px 32px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--tgd-primary, #2563eb)' }}>
                                {l.request?.request_no ?? '-'}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                {formatDate(l.request?.last_action_at ?? l.request?.expected_arrival_date)}
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--tgd-muted-text)' }}>
                                {l.lot_no || '-'}
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {l.tracking_code || '-'}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatDate(l.mfg_date)}</td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatDate(l.exp_date)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                                {l.actual_boxes?.toLocaleString() ?? (
                                  <span style={{ color: 'var(--tgd-muted-text)', fontWeight: 400 }}>{l.expected_boxes ?? '-'}</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                                {l.actual_weight != null ? formatFixed2(l.actual_weight) : (
                                  <span style={{ color: 'var(--tgd-muted-text)', fontWeight: 400 }}>{formatFixed2(l.expected_weight)}</span>
                                )}
                              </td>
                              <td
                                style={{ padding: '10px 12px', color: 'var(--tgd-muted-text)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={l.note ?? ''}
                              >
                                {l.note ?? '-'}
                              </td>
                              <td
                                style={{ padding: '10px 12px', color: 'var(--tgd-muted-text)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={l.actual_note ?? ''}
                              >
                                {l.actual_note ?? '-'}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                {l.tracking_code ? (
                                  <Link
                                    className="btn btn-outline"
                                    style={{ padding: '4px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                                    to={`/customer/movement-ledger?trackingCode=${encodeURIComponent(l.tracking_code)}`}
                                  >
                                    ดูรายละเอียด
                                  </Link>
                                ) : '-'}
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

            {productGroups.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--tgd-muted-text)', padding: '8px 16px' }}>
                แสดง {filtered.length} รายการ (เฉพาะรายการที่มียอดคงเหลือ — หักการเบิกสินค้าแล้ว)
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
