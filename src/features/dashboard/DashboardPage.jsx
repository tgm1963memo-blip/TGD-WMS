import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { WarehouseLayoutWidget } from './WarehouseLayoutWidget.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { useLanguage, useTranslation } from '../../i18n/languageProvider.jsx';
import {
  getReadOnlyDashboardEmptySummary,
  getReadOnlyDashboardSummary,
  getPendingAdminDocuments,
} from '../../services/readOnlyDashboardService.js';
import { getMonthlyStorageRevenueSummary } from '../../services/billingRateEngineService.js';
import { summarizeSupabaseReadiness } from '../../services/supabaseConnectionReadinessService.js';
import { supabase } from '../../services/supabaseClient.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useUserRole } from '../auth/UserRoleProvider.jsx';

const REVENUE_VISIBLE_ROLES = ['admin', 'accounting'];
// Granted to this specific person regardless of role, per direct request —
// everyone else's access is still role-based (REVENUE_VISIBLE_ROLES above).
const REVENUE_VISIBLE_EMAILS = ['prapaisri@tgm.co.th'];

function formatTHB(amount) {
  return `฿${Number(amount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthKeyLabel(monthKey) {
  const [y, m] = String(monthKey ?? '').split('-');
  const names = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const idx = Number(m) - 1;
  return names[idx] ? `${names[idx]} ${y}` : String(monthKey ?? '-');
}

const initialState = {
  data: getReadOnlyDashboardEmptySummary(),
  loading: false,
  error: null,
};

function fmtDate(val) {
  if (!val) return '-';
  try { return new Date(val).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return val; }
}

export function DashboardPage() {
  const [state, setState] = useState(initialState);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDocs, setPendingDocs] = useState({ data: null, loading: true });
  const [revenue, setRevenue] = useState({ data: null, loading: true, error: null });
  const [expandedMonths, setExpandedMonths] = useState(() => new Set());
  const { session } = useAuth();
  const { role: userRole } = useUserRole();
  const canViewRevenue = REVENUE_VISIBLE_ROLES.includes(userRole)
    || REVENUE_VISIBLE_EMAILS.includes((session?.user?.email ?? '').toLowerCase());
  const { language } = useLanguage();
  const t = useTranslation();
  const goLive = isGoLivePresentationEnabled();
  const readiness = summarizeSupabaseReadiness();

  useEffect(() => {
    let isMounted = true;

    if (!session?.user) {
      setState({
        data: getReadOnlyDashboardEmptySummary(),
        loading: false,
        error: null,
      });
      return () => { isMounted = false; };
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    getReadOnlyDashboardSummary().then((result) => {
      if (!isMounted) return;
      setState({
        data: result.data ?? getReadOnlyDashboardEmptySummary(),
        loading: false,
        error: result.error ?? null,
      });
    });

    setPendingDocs({ data: null, loading: true });
    getPendingAdminDocuments().then((result) => {
      if (!isMounted) return;
      setPendingDocs({ data: result.data ?? [], loading: false });
    });

    return () => { isMounted = false; };
  }, [session, refreshKey]);

  useEffect(() => {
    let isMounted = true;
    if (!session?.user || !canViewRevenue) {
      setRevenue({ data: null, loading: false, error: null });
      return () => { isMounted = false; };
    }

    setRevenue((current) => ({ ...current, loading: true, error: null }));
    getMonthlyStorageRevenueSummary({ monthsBack: 6 }).then((result) => {
      if (!isMounted) return;
      setRevenue({ data: result.data ?? null, loading: false, error: result.error ?? null });
    });

    return () => { isMounted = false; };
  }, [session, canViewRevenue]);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    const channel = supabase
      .channel('dashboard-stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tgd_stock_balances' }, () => {
        setRefreshKey((k) => k + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  // Polling fallback — fires every 30 s even when Supabase Realtime is not enabled
  useEffect(() => {
    if (!session?.user) return;
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 30000);
    return () => clearInterval(interval);
  }, [session]);

  const d = state.data;
  const loadingLabel = state.loading ? '...' : '—';

  function toggleMonth(monthKey) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey); else next.add(monthKey);
      return next;
    });
  }

  return (
    <section className={getPageShellClassName(`page-shell dashboard-page${goLive ? ' dashboard-page--golive' : ''}`)}>
      <PageHeader
        title={t('operations_dashboard')}
        description={goLive ? t('dashboard_description_golive') : t('dashboard_description')}
        actions={!goLive ? (
          <div className="dashboard-header-actions action-row">
            <span className="production-hold-badge">{t('production_hold')}</span>
            <span className="status-badge status-badge--uat">{t('uat_mode')}</span>
          </div>
        ) : null}
      />

      {!goLive ? (
        <div className="uat-banner" role="status">
          {t('controlled_uat_only')} · {t('production_hold')} · {t('final_go_not_authorized')}
        </div>
      ) : null}

      {state.error ? (
        <section className="alert-panel alert-danger" role="alert">
          Data Fetch Error: {state.error.message ?? String(state.error)}
        </section>
      ) : null}

      {canViewRevenue ? (
        <DashboardSection title={language === 'th' ? 'รายได้จากการให้เช่าคลังสินค้า (ประมาณ)' : 'Storage Rental Revenue (Estimate)'}>
          {revenue.loading ? (
            <div style={{ color: 'var(--tgd-text-light)' }}>{language === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading...'}</div>
          ) : revenue.error ? (
            <div className="banner banner-danger" role="alert">{revenue.error.message ?? String(revenue.error)}</div>
          ) : (
            <>
              <div className="kpi-grid" style={{ marginBottom: 16 }}>
                <div className="kpi-card success">
                  <h3 className="kpi-label">{language === 'th' ? 'รายได้เดือนนี้ (ประมาณ)' : 'This Month (Estimate)'}</h3>
                  <div className="kpi-value">{formatTHB(revenue.data?.currentMonth?.amount)}</div>
                  <div className="kpi-helper">{monthKeyLabel(revenue.data?.currentMonth?.monthKey)}</div>
                </div>
                <div className="kpi-card info">
                  <h3 className="kpi-label">{language === 'th' ? `รายได้รวม (${revenue.data?.months?.length ?? 0} เดือน)` : `Total (${revenue.data?.months?.length ?? 0} months)`}</h3>
                  <div className="kpi-value">{formatTHB(revenue.data?.totalAmount)}</div>
                  <div className="kpi-helper">{language === 'th' ? 'ค่าเช่าพื้นที่จัดเก็บ (ไม่รวมค่าบริการอื่น)' : 'Storage fee only, excludes other service charges'}</div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--tgd-border)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px', width: 28 }}></th>
                      <th style={{ padding: '6px 10px' }}>{language === 'th' ? 'เดือน' : 'Month'}</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>{language === 'th' ? 'รายได้ (บาท)' : 'Revenue (THB)'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(revenue.data?.months ?? []).map((m) => {
                      const isExpanded = expandedMonths.has(m.monthKey);
                      const hasBreakdown = (m.byCustomer ?? []).length > 0;
                      return (
                        <Fragment key={m.monthKey}>
                          <tr
                            style={{ borderBottom: '1px solid var(--tgd-border)', cursor: hasBreakdown ? 'pointer' : 'default' }}
                            onClick={() => hasBreakdown && toggleMonth(m.monthKey)}
                          >
                            <td style={{ padding: '6px 10px', color: 'var(--tgd-muted-text)' }}>
                              {hasBreakdown ? (isExpanded ? '▼' : '▶') : ''}
                            </td>
                            <td style={{ padding: '6px 10px' }}>{monthKeyLabel(m.monthKey)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-success, #16a34a)' }}>{formatTHB(m.amount)}</td>
                          </tr>
                          {isExpanded && hasBreakdown ? (
                            <tr>
                              <td colSpan={3} style={{ padding: 0, background: '#f8fafc' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <tbody>
                                    {m.byCustomer.map((c) => (
                                      <tr key={c.customerId} style={{ borderTop: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '6px 10px 6px 40px', color: 'var(--tgd-muted-text)' }}>{c.customerName}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right', width: 160 }}>{formatTHB(c.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: 'var(--tgd-muted-text)', marginTop: 8 }}>
                {language === 'th'
                  ? '* ประมาณการจากอัตราค่าเช่าที่ตั้งค่าไว้และประวัติการฝาก/เบิกจริง ยังไม่ใช่ยอดจากใบแจ้งหนี้ที่อนุมัติแล้ว'
                  : '* Estimated from configured storage rates and actual deposit/withdrawal history — not yet reconciled against approved invoices.'}
              </p>
            </>
          )}
        </DashboardSection>
      ) : null}

      <DashboardSection title={goLive ? t('dashboard_overview_golive') : (language === 'th' ? 'ภาพรวมสำหรับการนำเสนอ' : 'Meeting Overview')}>
        <div className="kpi-grid">
          <div className="kpi-card navy">
            <h3 className="kpi-label">{t('total_products')}</h3>
            <div className="kpi-value">{state.loading ? loadingLabel : d.productRows}</div>
            <div className="kpi-helper">{t('master_data')}</div>
          </div>
          <div className="kpi-card info">
            <h3 className="kpi-label">{t('warehouses')}</h3>
            <div className="kpi-value">{state.loading ? loadingLabel : d.locationRows}</div>
            <div className="kpi-helper">{t('locations')}</div>
          </div>
          <div className="kpi-card warning">
            <h3 className="kpi-label">{t('open_receiving')}</h3>
            <div className="kpi-value">{state.loading ? loadingLabel : (goLive ? d.openReceivingRows : '—')}</div>
            <div className="kpi-helper">{goLive ? t('open_documents') : t('demo_uat_placeholder')}</div>
          </div>
          <div className="kpi-card success">
            <h3 className="kpi-label">{t('stock_balance')}</h3>
            <div className="kpi-value">{state.loading ? loadingLabel : d.stockBalanceRows}</div>
            <div className="kpi-helper">{t('customer')}: {d.customerRows}</div>
          </div>
          {goLive ? (
            <>
              <div className="kpi-card info">
                <h3 className="kpi-label">{t('total_stock_qty')}</h3>
                <div className="kpi-value">{state.loading ? loadingLabel : d.totalStockQuantity}</div>
                <div className="kpi-helper">{t('stock_balance')}</div>
              </div>
              <div className="kpi-card success">
                <h3 className="kpi-label">{t('movement_rows')}</h3>
                <div className="kpi-value">{state.loading ? loadingLabel : d.stockMovementRows}</div>
                <div className="kpi-helper">{t('movement_ledger_report')}</div>
              </div>
            </>
          ) : (
            <>
              <div className="kpi-card info">
                <h3 className="kpi-label">{t('uat_status')}</h3>
                <div className="kpi-value">
                  <span className="status-badge status-badge--uat">{t('status_uat')}</span>
                </div>
                <div className="kpi-helper">{readiness.ready && readiness.safe ? 'Supabase OK' : 'Review config'}</div>
              </div>
              <div className="kpi-card danger">
                <h3 className="kpi-label">{t('production_gate')}</h3>
                <div className="kpi-value">
                  <span className="status-badge status-badge--hold">{t('status_hold')}</span>
                </div>
                <div className="kpi-helper">{t('final_go_not_authorized')}</div>
              </div>
            </>
          )}
        </div>
      </DashboardSection>

      <div className="dashboard-grid-2col">
        <DashboardSection title={language === 'th' ? 'งานวันนี้' : 'Today task list'}>
          {state.loading ? (
            <div style={{ color: 'var(--tgd-text-light)' }}>{language === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading...'}</div>
          ) : (
            <ul className="task-list">
              {d.openReceivingRows > 0 && (
                <li className="task-item">
                  <Link to="/operations/receiving" style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--tgd-primary)', cursor: 'pointer' }}>
                    {language === 'th' ? `เอกสารรับเข้าที่รอตรวจสอบ (${d.openReceivingRows} รายการ)` : `Pending receiving documents (${d.openReceivingRows})`}
                  </Link>
                </li>
              )}
              {d.openPutawayRows > 0 && <li className="task-item">{language === 'th' ? `งานจัดเก็บ Putaway ที่รอทำ (${d.openPutawayRows} รายการ)` : `Pending putaway sessions (${d.openPutawayRows})`}</li>}
              {d.openPickingRows > 0 && <li className="task-item">{language === 'th' ? `คิวหยิบสินค้าที่ค้างอยู่ (${d.openPickingRows} รายการ)` : `Pending picking queue (${d.openPickingRows})`}</li>}
              {d.openDispatchRows > 0 && <li className="task-item">{language === 'th' ? `เอกสารตัดจ่ายออกที่รอตรวจสอบ (${d.openDispatchRows} รายการ)` : `Pending dispatch queue (${d.openDispatchRows})`}</li>}
              
              {d.openReceivingRows === 0 && d.openPutawayRows === 0 && d.openPickingRows === 0 && d.openDispatchRows === 0 && (
                <li className="task-item" style={{ color: 'var(--tgd-text-light)', borderLeftColor: '#cbd5e1' }}>
                  {language === 'th' ? 'ไม่มีงานค้างสำหรับวันนี้ 🎉' : 'No pending tasks for today 🎉'}
                </li>
              )}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection title={language === 'th' ? 'แจ้งเตือนระบบ' : 'System alerts'}>
          {state.loading ? (
            <div style={{ color: 'var(--tgd-text-light)' }}>{language === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading...'}</div>
          ) : (
            <ul className="alert-list">
              {d.locationRows === 0 && <li className="alert-item warning">{language === 'th' ? 'ยังไม่ได้ตั้งค่าผังคลังสินค้า' : 'Warehouse layout not configured'}</li>}
              {d.productRows === 0 && <li className="alert-item warning">{language === 'th' ? 'ยังไม่ได้นำเข้าข้อมูลสินค้าพื้นฐาน' : 'Product master data missing'}</li>}
              {d.customerRows === 0 && <li className="alert-item warning">{language === 'th' ? 'ยังไม่ได้เพิ่มข้อมูลลูกค้า' : 'Customer master data missing'}</li>}
              {d.openReceivingRows === 0 && d.openPutawayRows === 0 && d.stockBalanceRows === 0 && (
                <li className="alert-item info">{language === 'th' ? 'ยังไม่มีสต๊อกสินค้าในระบบ' : 'No stock balance in system'}</li>
              )}
              
              {d.locationRows > 0 && d.productRows > 0 && d.customerRows > 0 && (
                <li className="alert-item success">{language === 'th' ? 'ระบบพร้อมใช้งาน ข้อมูลพื้นฐานครบถ้วน' : 'System ready and master data complete'}</li>
              )}
            </ul>
          )}
        </DashboardSection>
      </div>

      {!goLive ? (
        <DashboardSection title={language === 'th' ? 'ความปลอดภัย Production' : 'Production Safety Panel'}>
          <div className="safety-panel">
            <h3 style={{ color: 'var(--tgd-danger)', marginTop: 0 }}>{t('production_hold')}</h3>
            <p>{t('final_go_not_authorized')}</p>
            <p>{language === 'th' ? 'Post Outbound feature gate ยังปิดเป็นค่าเริ่มต้น' : 'Post Outbound feature gate remains OFF by default.'}</p>
            <p>{language === 'th' ? 'Controlled write smoke แยกจาก UAT นี้' : 'Controlled write smoke remains separate.'}</p>
            <div className="safety-actions">
              <div className="safety-action-box">
                <strong>FINAL GO: Apply Outbound migrations 025-030 to Production</strong>
              </div>
              <div className="safety-action-box">
                <strong>APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1</strong>
              </div>
            </div>
          </div>
        </DashboardSection>
      ) : null}

      {/* Pending Customer Documents */}
      <DashboardSection title={language === 'th' ? 'เอกสารจากลูกค้า — รอธุรการดำเนินการ' : 'Customer Documents — Awaiting Admin Action'}>
        {pendingDocs.loading ? (
          <div style={{ color: 'var(--tgd-text-light)' }}>{language === 'th' ? 'กำลังโหลด...' : 'Loading...'}</div>
        ) : !pendingDocs.data || pendingDocs.data.length === 0 ? (
          <div style={{ color: 'var(--tgd-text-light)', padding: '8px 0' }}>
            {language === 'th' ? 'ไม่มีเอกสารค้างดำเนินการ ✓' : 'No documents awaiting action ✓'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--tgd-border)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>ประเภท</th>
                  <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>เลขที่เอกสาร</th>
                  <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>ลูกค้า</th>
                  <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>วันที่แจ้ง</th>
                  <th style={{ padding: '6px 10px' }}></th>
                </tr>
              </thead>
              <tbody>
                {pendingDocs.data.map((doc) => (
                  <tr key={`${doc.docType}-${doc.id}`} style={{ borderBottom: '1px solid var(--tgd-border)' }}>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: doc.docType === 'deposit' ? '#dbeafe' : '#fef3c7',
                        color: doc.docType === 'deposit' ? '#1d4ed8' : '#92400e',
                      }}>
                        {doc.docType === 'deposit' ? 'ฝากสินค้า' : 'เบิกสินค้า'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>{doc.request_no ?? doc.id.slice(0, 8)}</td>
                    <td style={{ padding: '6px 10px' }}>{doc.customer?.customer_name ?? doc.customer?.customer_code ?? '-'}</td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: 'var(--tgd-text-light)' }}>{fmtDate(doc.submitted_at ?? doc.created_at)}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <Link
                        to={doc.docType === 'deposit' ? `/customer/admin/deposit-review/${doc.id}` : `/customer/admin/withdrawal-review`}
                        style={{ color: 'var(--tgd-primary)', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}
                      >
                        ดูเอกสาร →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Warehouse Layout Map */}
      <DashboardSection title={language === 'th' ? 'แผนผังคลังสินค้า' : 'Warehouse Layout Map'}>
        <div style={{ margin: '-8px -16px', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--tgd-border)' }}>
          <WarehouseLayoutWidget key={refreshKey} />
        </div>
      </DashboardSection>

    </section>
  );
}
