import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

  const statusText = readiness.ready && readiness.safe ? 'Ready for Supabase' : 'Review Supabase Settings';
  const statusTone = readiness.ready && readiness.safe ? 'var(--tgd-success)' : 'var(--tgd-warning)';

  return (
    <section className="page-shell dashboard-page">
      <PageHeader
        title="Operations Dashboard"
        description="Cold storage WMS operational overview. Read-only staging data visualization."
        actions={
          <div className="dashboard-header-actions">
             <span className="production-hold-badge">Production HOLD</span>
             <Link className="btn-primary-gold" to="/dashboard/inventory">Inventory View</Link>
          </div>
        }
      />

      <StagingLoginPanel session={session} onSessionChange={setSession} />

      {sessionError ? (
        <section className="alert-panel alert-danger" role="alert">
          Auth Error: {sessionError.message ?? String(sessionError)}
        </section>
      ) : null}

      {!sessionLoading && !session?.user ? (
        <section className="alert-panel alert-warning" role="status">
          Please login to Staging to view live RLS data.
        </section>
      ) : null}

      {state.error ? (
        <section className="alert-panel alert-danger" role="alert">
          Data Fetch Error: {state.error.message ?? String(state.error)}
        </section>
      ) : null}

      {/* KPI Cards */}
      <DashboardSection title="Today's Overview">
        <div className="kpi-grid">
          <div className="kpi-card info">
            <h3 className="kpi-label">Receiving Today</h3>
            <div className="kpi-value">{state.loading ? '...' : '12'}</div>
            <div className="kpi-helper">Pallets expected</div>
          </div>
          <div className="kpi-card warning">
            <h3 className="kpi-label">Pending Putaway</h3>
            <div className="kpi-value">{state.loading ? '...' : '5'}</div>
            <div className="kpi-helper">Awaiting bin assignment</div>
          </div>
          <div className="kpi-card success">
            <h3 className="kpi-label">Pending Picking</h3>
            <div className="kpi-value">{state.loading ? '...' : '8'}</div>
            <div className="kpi-helper">Active reservations</div>
          </div>
          <div className="kpi-card danger">
            <h3 className="kpi-label">Pending Post Outbound</h3>
            <div className="kpi-value">{state.loading ? '...' : '3'}</div>
            <div className="kpi-helper">Awaiting final dispatch</div>
          </div>
        </div>
      </DashboardSection>

      {/* Workflow Status Panel */}
      <DashboardSection title="Workflow Status">
        <div className="workflow-panel">
          <div className="workflow-step">
            <div className="workflow-step-name">Receiving</div>
            <div className="workflow-step-value">12</div>
            <div className="workflow-step-status info">In Progress</div>
          </div>
          <div className="workflow-connector">→</div>
          <div className="workflow-step">
            <div className="workflow-step-name">Putaway</div>
            <div className="workflow-step-value">5</div>
            <div className="workflow-step-status warning">Pending</div>
          </div>
          <div className="workflow-connector">→</div>
          <div className="workflow-step">
            <div className="workflow-step-name">Storage</div>
            <div className="workflow-step-value">{state.loading ? '...' : state.data.totalStockQuantity}</div>
            <div className="workflow-step-status success">Active</div>
          </div>
          <div className="workflow-connector">→</div>
          <div className="workflow-step">
            <div className="workflow-step-name">Picking</div>
            <div className="workflow-step-value">8</div>
            <div className="workflow-step-status info">Drafts</div>
          </div>
          <div className="workflow-connector">→</div>
          <div className="workflow-step">
            <div className="workflow-step-name">Post Outbound</div>
            <div className="workflow-step-value">3</div>
            <div className="workflow-step-status danger">Queue</div>
          </div>
        </div>
      </DashboardSection>

      <div className="dashboard-grid-2col">
        {/* Today Task List */}
        <DashboardSection title="Today task list">
          <ul className="task-list">
            <li className="task-item">Review pending receiving documents</li>
            <li className="task-item">Complete putaway sessions</li>
            <li className="task-item">Review picking confirmation queue</li>
            <li className="task-item">Review Post Outbound queue</li>
          </ul>
        </DashboardSection>

        {/* System Alerts Panel */}
        <DashboardSection title="System alerts">
          <ul className="alert-list">
            <li className="alert-item warning">Production HOLD</li>
            <li className="alert-item info">Feature gate default OFF</li>
            <li className="alert-item info">No Production migration applied</li>
            <li className="alert-item info">UI-only sprint / no business logic changed</li>
          </ul>
        </DashboardSection>
      </div>

      {/* Production Safety Panel */}
      <DashboardSection title="Production Safety Panel">
        <div className="safety-panel">
          <h3 style={{ color: 'var(--tgd-danger)', marginTop: 0 }}>Production remains HOLD</h3>
          <p>FINAL GO is required before Production migration apply.</p>
          <p>Post Outbound feature gate remains OFF by default.</p>
          <p>Controlled write smoke remains separate.</p>
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

    </section>
  );
}
