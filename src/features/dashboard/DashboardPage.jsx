import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ControlledFrontendWriteDryRunPanel } from '../../components/dashboard/ControlledFrontendWriteDryRunPanel.jsx';
import { DashboardCard } from '../../components/dashboard/DashboardCard.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { StagingLoginPanel } from '../../components/dashboard/StagingLoginPanel.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import {
  getReadOnlyDashboardEmptySummary,
  getReadOnlyDashboardSummary,
} from '../../services/readOnlyDashboardService.js';
import { getStagingSession, subscribeToStagingAuth } from '../../services/stagingAuthService.js';
import { summarizeSupabaseReadiness } from '../../services/supabaseConnectionReadinessService.js';

const initialState = {
  data: getReadOnlyDashboardEmptySummary(),
  loading: false,
  error: null,
};

export function DashboardPage() {
  const [state, setState] = useState(initialState);
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const readiness = summarizeSupabaseReadiness();

  useEffect(() => {
    let isMounted = true;

    getStagingSession().then((result) => {
      if (!isMounted) return;

      setSession(result.data ?? null);
      setSessionError(result.error ?? null);
      setSessionLoading(false);
    });

    const subscription = subscribeToStagingAuth((nextSession) => {
      setSession(nextSession);
      setSessionError(null);
      setSessionLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!session?.user) {
      setState({
        data: getReadOnlyDashboardEmptySummary(),
        loading: false,
        error: null,
      });

      return () => {
        isMounted = false;
      };
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

    return () => {
      isMounted = false;
    };
  }, [session]);

  const statusText = readiness.ready && readiness.safe ? 'พร้อมเชื่อมต่อ Supabase' : 'ต้องตรวจสอบการตั้งค่า Supabase';
  const statusTone = readiness.ready && readiness.safe ? '#166534' : '#92400e';
  const statusBackground = readiness.ready && readiness.safe ? '#dcfce7' : '#fef3c7';

  return (
    <section className="page-shell">
      <PageHeader
        title="แดชบอร์ดคลังสินค้า"
        description="สรุปข้อมูล Staging จาก Supabase แบบอ่านอย่างเดียว สำหรับตรวจสอบภาพรวมสต็อกก่อนใช้งานจริง"
        actions={<Link className="action-link" to="/dashboard/inventory">เปิดแดชบอร์ดสินค้าคงคลัง</Link>}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <span
          className="status-badge"
          style={{ background: statusBackground, borderRadius: 999, color: statusTone, fontWeight: 700, padding: '6px 12px' }}
        >
          {statusText}
        </span>
        <span className="status-badge" style={{ background: '#e0f2fe', borderRadius: 999, color: '#075985', fontWeight: 700, padding: '6px 12px' }}>
          โหมดอ่านอย่างเดียว / Read-only
        </span>
        <span className="status-badge" style={{ background: '#ede9fe', borderRadius: 999, color: '#5b21b6', fontWeight: 700, padding: '6px 12px' }}>
          Staging
        </span>
      </div>

      <StagingLoginPanel session={session} onSessionChange={setSession} />

      {sessionError ? (
        <section
          className="warning-panel"
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
            marginBottom: 18,
            padding: 14,
          }}
        >
          ตรวจสอบ Supabase Auth ไม่สำเร็จ: {sessionError.message ?? String(sessionError)}
        </section>
      ) : null}

      {!sessionLoading && !session?.user ? (
        <section
          className="warning-panel"
          role="status"
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            color: '#92400e',
            marginBottom: 18,
            padding: 14,
          }}
        >
          กรุณาเข้าสู่ระบบ Staging เพื่ออ่านข้อมูล Stock ตามสิทธิ์ RLS
        </section>
      ) : null}

      {state.error ? (
        <section
          className="warning-panel"
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
            marginBottom: 18,
            padding: 14,
          }}
        >
          อ่านข้อมูลจาก Supabase ไม่สำเร็จ: {state.error.message ?? String(state.error)}
        </section>
      ) : null}

      <ControlledFrontendWriteDryRunPanel session={session} />

      <DashboardSection title="สรุปข้อมูล Staging แบบอ่านอย่างเดียว">
        <div className="summary-grid">
          <DashboardCard
            label="Supabase connection"
            value={readiness.ready && readiness.safe ? 'Ready' : 'Review'}
            helperText="ใช้ public anon key สำหรับ frontend เท่านั้น"
          />
          <DashboardCard
            label="Authenticated"
            value={session?.user ? 'Yes' : 'No'}
            helperText={session?.user?.email ?? 'ต้องเข้าสู่ระบบ Staging ก่อนอ่านข้อมูล Stock'}
          />
          <DashboardCard
            label="Stock balance rows"
            value={state.loading ? '...' : state.data.stockBalanceRows}
            helperText="จำนวนแถวจาก tgd_stock_balances"
          />
          <DashboardCard
            label="Stock movement rows"
            value={state.loading ? '...' : state.data.stockMovementRows}
            helperText="จำนวนแถวจาก tgd_stock_movements"
          />
          <DashboardCard
            label="Total stock quantity"
            value={state.loading ? '...' : state.data.totalStockQuantity}
            helperText="รวม quantity จาก stock balance"
          />
          <DashboardCard
            label="Customers"
            value={state.loading ? '...' : state.data.customerRows}
            helperText="จำนวนข้อมูลลูกค้าในระบบ Staging"
          />
          <DashboardCard
            label="Products / Lots / Locations"
            value={state.loading ? '...' : `${state.data.productRows} / ${state.data.lotRows} / ${state.data.locationRows}`}
            helperText="ข้อมูลอ้างอิงที่เกี่ยวข้องกับสต็อก"
          />
        </div>
      </DashboardSection>
    </section>
  );
}
