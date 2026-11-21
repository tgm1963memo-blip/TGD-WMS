import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Info,
  Receipt,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WarehouseLayoutWidget } from './WarehouseLayoutWidget.jsx';
import { RevenueOverview, formatTHB, monthLabel } from './RevenueOverview.jsx';
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

const initialState = {
  data: getReadOnlyDashboardEmptySummary(),
  loading: false,
  error: null,
};

function fmtDate(val) {
  if (!val) return '-';
  try { return new Date(val).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return val; }
}

function fmtNumber(val) {
  return Number(val ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

function KpiCell({ label, value, helper, to }) {
  const body = (
    <>
      <h3 className="dash-kpi-label">{label}</h3>
      <div className="dash-kpi-value">{value}</div>
      {helper ? <div className="dash-kpi-helper">{helper}</div> : null}
    </>
  );
  return to
    ? <Link className="dash-kpi" to={to}>{body}</Link>
    : <div className="dash-kpi">{body}</div>;
}

function FlowStep({ label, value, helper, to }) {
  const hot = typeof value === 'number' && value > 0;
  const className = `dash-flow-step${hot ? ' dash-flow-step--hot' : ''}`;
  const body = (
    <>
      <span className="dash-kpi-label">{label}</span>
      <span className="dash-kpi-value">{value}</span>
      <span className="dash-kpi-helper">{helper}</span>
    </>
  );
  return to ? <Link className={className} to={to}>{body}</Link> : <div className={className}>{body}</div>;
}

export function DashboardPage() {
  const [state, setState] = useState(initialState);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDocs, setPendingDocs] = useState({ data: null, loading: true });
  const [revenue, setRevenue] = useState({ data: null, loading: true, error: null });
  const { session } = useAuth();
  const { role: userRole } = useUserRole();
  const canViewRevenue = REVENUE_VISIBLE_ROLES.includes(userRole)
    || REVENUE_VISIBLE_EMAILS.includes((session?.user?.email ?? '').toLowerCase());
  const { language } = useLanguage();
  const t = useTranslation();
  const th = language === 'th';
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
  const show = (value) => (state.loading ? loadingLabel : value);
  const openTotal = (d.openReceivingRows ?? 0) + (d.openPutawayRows ?? 0) + (d.openPickingRows ?? 0) + (d.openDispatchRows ?? 0);
  const docs = pendingDocs.data ?? [];

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

      <div className="dash">
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

        {/* ── Summary strip ── */}
        <div className="dash-kpis" aria-label={goLive ? t('dashboard_overview_golive') : (th ? 'ภาพรวม' : 'Overview')}>
          {canViewRevenue ? (
            <KpiCell
              label={th ? 'รายได้ค่าฝากเดือนนี้ (ประมาณ)' : 'Storage revenue this month (est.)'}
              value={revenue.loading ? '...' : formatTHB(revenue.data?.currentMonth?.amount)}
              helper={monthLabel(revenue.data?.currentMonth?.monthKey, language, { withYear: true })}
            />
          ) : null}
          <KpiCell
            label={t('stock_balance')}
            value={show(d.stockBalanceRows)}
            helper={`${t('customer')}: ${d.customerRows}`}
            to="/inventory"
          />
          {goLive ? (
            <KpiCell label={t('total_stock_qty')} value={show(fmtNumber(d.totalStockQuantity))} helper={t('stock_balance')} />
          ) : null}
          <KpiCell label={t('total_products')} value={show(d.productRows)} helper={t('master_data')} />
          <KpiCell label={t('warehouses')} value={show(d.locationRows)} helper={t('locations')} to="/admin/warehouse-locations" />
          {goLive ? (
            <KpiCell label={t('movement_rows')} value={show(fmtNumber(d.stockMovementRows))} helper={t('movement_ledger_report')} to="/reports/movement-ledger" />
          ) : null}
        </div>

        {/* ── Work flow: receive → putaway → pick → dispatch ── */}
        <div className="dash-panel">
          <div className="dash-panel-h">
            <h3>{th ? 'สายงานคลัง' : 'Warehouse flow'}</h3>
            <span className="dash-sub">{th ? 'รับเข้า → จัดเก็บ → หยิบ → จ่ายออก' : 'Receive → Putaway → Pick → Dispatch'}</span>
          </div>
          <div className="dash-flow">
            <FlowStep
              label={t('open_receiving')}
              value={show(goLive ? (d.openReceivingRows ?? '—') : '—')}
              helper={goLive ? t('open_documents') : t('demo_uat_placeholder')}
              to="/customer/admin/deposit-review"
            />
            <FlowStep label={th ? 'รอจัดเก็บ (Putaway)' : 'Pending putaway'} value={show(d.openPutawayRows)} helper={th ? 'งาน' : 'sessions'} />
            <FlowStep label={th ? 'รอหยิบสินค้า' : 'Pending picking'} value={show(d.openPickingRows ?? '—')} helper={th ? 'คิว' : 'queue'} to="/customer/admin/withdrawal-review" />
            <FlowStep label={th ? 'รอจ่ายออก' : 'Pending dispatch'} value={show(d.openDispatchRows)} helper={th ? 'เอกสาร' : 'documents'} to="/customer/admin/withdrawal-review" />
          </div>
        </div>

        {/* ── Revenue (admin / accounting only) ── */}
        {canViewRevenue ? (
          <div className="dash-panel">
            <div className="dash-panel-h">
              <Receipt size={16} aria-hidden="true" />
              <h3>{th ? 'รายได้จากการให้เช่าคลังสินค้า (ประมาณ)' : 'Storage Rental Revenue (Estimate)'}</h3>
              <div className="dash-right"><span className="dash-role-tag">{th ? 'เห็นเฉพาะผู้บริหาร / บัญชี' : 'Admin / accounting only'}</span></div>
            </div>
            {revenue.loading ? (
              <div className="dash-empty">{th ? 'กำลังโหลดข้อมูล...' : 'Loading...'}</div>
            ) : revenue.error ? (
              <div className="dash-panel-body"><div className="banner banner-danger" role="alert">{revenue.error.message ?? String(revenue.error)}</div></div>
            ) : (
              <RevenueOverview data={revenue.data} language={language} />
            )}
          </div>
        ) : null}

        {/* ── Today queue + alerts ── */}
        <div className="dash-grid-2">
          <div className="dash-panel">
            <div className="dash-panel-h">
              <h3>{th ? 'งานวันนี้' : 'Today task list'}</h3>
              <span className="dash-sub">{th ? 'เอกสารจากลูกค้าที่รอธุรการดำเนินการ' : 'Customer documents awaiting admin action'}</span>
              {!pendingDocs.loading && docs.length > 0 ? (
                <div className="dash-right"><span className="dash-pill dash-pill--gold">{docs.length} {th ? 'รายการ' : 'items'}</span></div>
              ) : null}
            </div>
            {pendingDocs.loading ? (
              <div className="dash-empty">{th ? 'กำลังโหลด...' : 'Loading...'}</div>
            ) : docs.length === 0 ? (
              <div className="dash-empty">
                <Check size={16} aria-hidden="true" />
                {openTotal === 0
                  ? (th ? 'ไม่มีงานค้างสำหรับวันนี้' : 'No pending tasks for today')
                  : (th ? 'ไม่มีเอกสารค้างดำเนินการ' : 'No documents awaiting action')}
              </div>
            ) : (
              <div className="dash-queue">
                {docs.map((doc) => {
                  const isDeposit = doc.docType === 'deposit';
                  const Icon = isDeposit ? ArrowDownToLine : ArrowUpFromLine;
                  return (
                    <Link
                      key={`${doc.docType}-${doc.id}`}
                      className="dash-q"
                      to={isDeposit ? `/customer/admin/deposit-review/${doc.id}` : '/customer/admin/withdrawal-review'}
                    >
                      <span className={`dash-q-icon ${isDeposit ? 'dash-q-icon--frost' : 'dash-q-icon--gold'}`}><Icon size={16} aria-hidden="true" /></span>
                      <span style={{ minWidth: 0 }}>
                        <span className="dash-q-title">
                          {isDeposit ? 'ฝากสินค้า' : 'เบิกสินค้า'} <span className="num">{doc.request_no ?? doc.id.slice(0, 8)}</span>
                        </span>
                        <span className="dash-q-sub">{doc.customer?.customer_name ?? doc.customer?.customer_code ?? '-'}</span>
                      </span>
                      <span className="dash-q-meta">
                        <span className="num">{fmtDate(doc.submitted_at ?? doc.created_at)}</span>
                        <span className={`dash-pill ${isDeposit ? 'dash-pill--frost' : 'dash-pill--gold'}`}>{th ? 'รอตรวจ' : 'To review'}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="dash-panel">
            <div className="dash-panel-h"><h3>{th ? 'แจ้งเตือนระบบ' : 'System alerts'}</h3></div>
            {state.loading ? (
              <div className="dash-empty">{th ? 'กำลังโหลดข้อมูล...' : 'Loading...'}</div>
            ) : (
              <div role="list">
                {d.locationRows === 0 ? (
                  <div className="dash-alert dash-alert--warn" role="listitem"><AlertTriangle size={16} aria-hidden="true" />{th ? 'ยังไม่ได้ตั้งค่าผังคลังสินค้า' : 'Warehouse layout not configured'}</div>
                ) : null}
                {d.productRows === 0 ? (
                  <div className="dash-alert dash-alert--warn" role="listitem"><AlertTriangle size={16} aria-hidden="true" />{th ? 'ยังไม่ได้นำเข้าข้อมูลสินค้าพื้นฐาน' : 'Product master data missing'}</div>
                ) : null}
                {d.customerRows === 0 ? (
                  <div className="dash-alert dash-alert--warn" role="listitem"><AlertTriangle size={16} aria-hidden="true" />{th ? 'ยังไม่ได้เพิ่มข้อมูลลูกค้า' : 'Customer master data missing'}</div>
                ) : null}
                {d.openReceivingRows === 0 && d.openPutawayRows === 0 && d.stockBalanceRows === 0 ? (
                  <div className="dash-alert dash-alert--info" role="listitem"><Info size={16} aria-hidden="true" />{th ? 'ยังไม่มีสต๊อกสินค้าในระบบ' : 'No stock balance in system'}</div>
                ) : null}
                {d.locationRows > 0 && d.productRows > 0 && d.customerRows > 0 ? (
                  <div className="dash-alert dash-alert--ok" role="listitem"><CheckCircle2 size={16} aria-hidden="true" />{th ? 'ระบบพร้อมใช้งาน ข้อมูลพื้นฐานครบถ้วน' : 'System ready and master data complete'}</div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {!goLive ? (
          <div className="dash-panel">
            <div className="dash-panel-h">
              <h3>{th ? 'ความปลอดภัย Production' : 'Production Safety Panel'}</h3>
              <div className="dash-right">
                <span className="dash-pill dash-pill--mute">{readiness.ready && readiness.safe ? 'Supabase OK' : 'Review config'}</span>
              </div>
            </div>
            <div className="dash-panel-body safety-panel">
              <h3 style={{ color: 'var(--tgd-danger)', marginTop: 0 }}>{t('production_hold')}</h3>
              <p>{t('final_go_not_authorized')}</p>
              <p>{th ? 'Post Outbound feature gate ยังปิดเป็นค่าเริ่มต้น' : 'Post Outbound feature gate remains OFF by default.'}</p>
              <p>{th ? 'Controlled write smoke แยกจาก UAT นี้' : 'Controlled write smoke remains separate.'}</p>
              <div className="safety-actions">
                <div className="safety-action-box">
                  <strong>FINAL GO: Apply Outbound migrations 025-030 to Production</strong>
                </div>
                <div className="safety-action-box">
                  <strong>APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1</strong>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Warehouse layout ── */}
        <div className="dash-panel">
          <div className="dash-panel-h">
            <h3>{th ? 'แผนผังคลังสินค้า' : 'Warehouse Layout Map'}</h3>
            <span className="dash-sub">{th ? 'จำนวน pallet ที่ใช้ต่อแถว · คลิกแถวเพื่อดูรายละเอียด' : 'Pallets used per row · click a row for detail'}</span>
          </div>
          <div className="dash-layout-body">
            {/* No key={refreshKey} here -- that forced a full unmount/remount
                on every 30s poll tick and every realtime stock change, which
                caused visible flicker/reset. The widget refreshes its own data
                (own polling + realtime subscription). */}
            <WarehouseLayoutWidget />
          </div>
        </div>
      </div>
    </section>
  );
}
