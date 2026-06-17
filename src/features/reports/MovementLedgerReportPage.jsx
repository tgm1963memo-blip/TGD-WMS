import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { MovementLedgerTable } from '../../components/reports/MovementLedgerTable.jsx';
import { MovementTypeBreakdown } from '../../components/reports/MovementTypeBreakdown.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { InventoryMovementReportTemplate } from '../../components/reports/InventoryMovementReportTemplate.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import {
  getMovementLedgerRows,
  summarizeMovements,
  groupByMovementType,
} from '../../services/movementLedgerReportService.js';
import { mapMovementLedgerToInventoryReportData } from '../../services/operationalReportMapper.js';

const initialState = {
  rows: [],
  summary: null,
  breakdown: [],
  loading: true,
  error: null,
};

export function MovementLedgerReportPage() {
  const { language } = useLanguage();
  const goLive = isGoLivePresentationEnabled();
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    getMovementLedgerRows(filters).then((result) => {
      if (!isMounted) return;

      const rows = result.data ?? [];
      setState({
        rows,
        summary: summarizeMovements(rows),
        breakdown: groupByMovementType(rows),
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => { isMounted = false; };
  }, [filters]);

  const t = (key) => getTranslation(key, language);

  return (
    <section className={`page-shell${goLive ? ' page-shell--golive' : ''}`}>
      <PageHeader
        title={t('movement_ledger_report') || 'Customer Stock Movement Ledger'}
        description={goLive
          ? (t('movement_ledger_report_description_golive') || 'Cold storage movement report — live data for operations review.')
          : (t('movement_ledger_report_description') || 'Read-only cold storage movement report for operations and audit preparation.')}
      />
      <div className="section-card operational-report-actions-card">
        <ReportPrintActions
          title={t('entry_delivery_inventory_report') || 'Entry-Delivery Inventory Report'}
          disabled={state.loading || !state.rows.length}
          renderReport={(reportLanguage) => (
            <InventoryMovementReportTemplate
              data={mapMovementLedgerToInventoryReportData({
                rows: state.rows,
                filters,
                summary: state.summary,
              })}
              language={reportLanguage}
            />
          )}
        />
      </div>
      <ReportFilterPanel onChange={setFilters} />

      <DashboardSection title={t('movement_stock_summary') || 'Stock Movement Summary'}>
        <div className="summary-grid summary-grid--4col">
          <ReportSummaryCard label={t('movement_inbound_qty') || 'Deposit / Inbound Qty'} value={state.summary?.totalInboundQty} />
          <ReportSummaryCard label={t('movement_outbound_qty') || 'Withdrawal / Outbound Qty'} value={state.summary?.totalOutboundQty} />
          <ReportSummaryCard label={t('movement_net_qty') || 'Net Movement'} value={state.summary?.netMovementQty} />
          <ReportSummaryCard label={t('movement_total_rows') || 'Total Rows'} value={state.summary?.totalMovementRows} />
          <ReportSummaryCard label={t('movement_unique_customers') || 'Customers'} value={state.summary?.uniqueCustomers} />
          <ReportSummaryCard label={t('movement_unique_lots') || 'Lots'} value={state.summary?.uniqueLots} />
          <ReportSummaryCard label={t('movement_unique_pallets') || 'Pallets'} value={state.summary?.uniquePallets} />
        </div>
      </DashboardSection>

      <DashboardSection title={t('movement_type_breakdown') || 'Movement Type Breakdown'}>
        <MovementTypeBreakdown data={state.breakdown} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title={t('movement_ledger') || 'Movement Ledger'}>
        <MovementLedgerTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      {!goLive ? (
        <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <h3 style={{ color: 'var(--tgd-danger)', fontSize: 16 }}>Production remains HOLD</h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>No Production migration applied</li>
            <li>UI polish does not change stock movement behavior</li>
            <li>UI polish does not change stock balance calculation</li>
            <li>Existing services and RPC calls are unchanged</li>
          </ul>
        </section>
      ) : null}
    </section>
  );
}
