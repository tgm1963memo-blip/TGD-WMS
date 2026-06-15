import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { useLanguage, useTranslation } from '../../i18n/languageProvider.jsx';
import {
  getReadOnlyDashboardEmptySummary,
  getReadOnlyDashboardSummary,
} from '../../services/readOnlyDashboardService.js';
import { summarizeSupabaseReadiness } from '../../services/supabaseConnectionReadinessService.js';
import { useAuth } from '../auth/AuthContext.jsx';

const initialState = {
  data: getReadOnlyDashboardEmptySummary(),
  loading: false,
  error: null,
};

export function DashboardPage() {
  const [state, setState] = useState(initialState);
  const { session } = useAuth();
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

    return () => { isMounted = false; };
  }, [session]);

  const d = state.data;
  const loadingLabel = state.loading ? '...' : '—';

  return (
    <section className={`page-shell dashboard-page${goLive ? ' dashboard-page--golive' : ''}`}>
      <PageHeader
        title={t('operations_dashboard')}
        description={goLive ? t('dashboard_description_golive') : t('dashboard_description')}
        actions={(
          <div className="dashboard-header-actions action-row">
            {!goLive ? (
              <>
                <span className="production-hold-badge">{t('production_hold')}</span>
                <span className="status-badge status-badge--uat">{t('uat_mode')}</span>
              </>
            ) : null}
            <Link className="btn-primary-gold" to="/dashboard/inventory">{t('inventory_view')}</Link>
          </div>
        )}
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

      <DashboardSection title={t('system_status')}>
        <div className="workflow-panel">
          <div className="workflow-step">
            <div className="workflow-step-name">{t('receiving')}</div>
            <div className="workflow-step-value">{state.loading ? loadingLabel : (goLive ? d.openReceivingRows : d.stockMovementRows)}</div>
            <div className="workflow-step-status info">{goLive ? t('status_open') : t('status_open')}</div>
          </div>
          <div className="workflow-connector">→</div>
          <div className="workflow-step">
            <div className="workflow-step-name">{t('putaway')}</div>
            <div className="workflow-step-value">{state.loading ? loadingLabel : (goLive ? d.openPutawayRows : '—')}</div>
            <div className="workflow-step-status warning">{goLive ? t('status_open') : t('demo_uat_placeholder')}</div>
          </div>
          <div className="workflow-connector">→</div>
          <div className="workflow-step">
            <div className="workflow-step-name">{t('stock_balance')}</div>
            <div className="workflow-step-value">{state.loading ? loadingLabel : d.totalStockQuantity}</div>
            <div className="workflow-step-status success">{t('status_pass')}</div>
          </div>
          <div className="workflow-connector">→</div>
          <div className="workflow-step">
            <div className="workflow-step-name">{t('picking')}</div>
            <div className="workflow-step-value">{state.loading ? loadingLabel : (goLive ? d.openPickingRows : '—')}</div>
            <div className="workflow-step-status info">{goLive ? t('status_open') : t('status_draft')}</div>
          </div>
          <div className="workflow-connector">→</div>
          <div className="workflow-step">
            <div className="workflow-step-name">{t('dispatch')}</div>
            <div className="workflow-step-value">{state.loading ? loadingLabel : (goLive ? d.openDispatchRows : '—')}</div>
            <div className="workflow-step-status danger">{goLive ? t('status_open') : t('status_hold')}</div>
          </div>
        </div>
      </DashboardSection>

      <div className="dashboard-grid-2col">
        <DashboardSection title={language === 'th' ? 'งานวันนี้' : 'Today task list'}>
          <ul className="task-list">
            <li className="task-item">{language === 'th' ? 'ตรวจสอบเอกสารรับเข้าที่ค้าง' : 'Review pending receiving documents'}</li>
            <li className="task-item">{language === 'th' ? 'ตรวจสอบงานจัดเก็บ (Putaway)' : 'Complete putaway sessions'}</li>
            <li className="task-item">{language === 'th' ? 'ตรวจสอบคิวหยิบสินค้า' : 'Review picking confirmation queue'}</li>
            <li className="task-item">{language === 'th' ? 'ตรวจสอบคิวตัดจ่ายออก' : 'Review dispatch queue'}</li>
          </ul>
        </DashboardSection>

        <DashboardSection title={language === 'th' ? 'แจ้งเตือนระบบ' : 'System alerts'}>
          <ul className="alert-list">
            {goLive ? (
              <>
                <li className="alert-item info">{language === 'th' ? 'ข้อมูลอ่านอย่างเดียวจากระบบจริง' : 'Read-only data from live system'}</li>
                <li className="alert-item info">{language === 'th' ? 'พร้อมสำหรับการทดสอบผู้ใช้งาน' : 'Ready for business user walkthrough'}</li>
                <li className="alert-item success">{language === 'th' ? 'ยอดคงเหลือและการเคลื่อนไหวอัปเดตตามข้อมูลล่าสุด' : 'Balances and movements reflect latest data'}</li>
              </>
            ) : (
              <>
                <li className="alert-item warning">{t('production_hold')}</li>
                <li className="alert-item info">{t('final_go_not_authorized')}</li>
                <li className="alert-item info">{t('uat_mode')}</li>
                <li className="alert-item info">{language === 'th' ? 'UI polish — ไม่เปลี่ยน business logic' : 'UI polish — no business logic changed'}</li>
              </>
            )}
          </ul>
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
    </section>
  );
}
