import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { MovementLedgerTable } from '../../components/reports/MovementLedgerTable.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { InventoryMovementReportTemplate } from '../../components/reports/InventoryMovementReportTemplate.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  getMovementLedgerRows,
  getConfirmedDepositReceiptRows,
  getConfirmedWithdrawalRows,
  summarizeMovements,
} from '../../services/movementLedgerReportService.js';
import { mapMovementLedgerToInventoryReportData } from '../../services/operationalReportMapper.js';
import { getCustomers, getProducts } from '../../services/masterDataService.js';
import { getActiveLocations } from '../../services/warehouseLayoutService.js';
import { EmptyState } from '../../components/ui/EmptyState.jsx';

const initialState = {
  rows: [],
  summary: null,
  loading: false,
  error: null,
};

export function MovementLedgerReportPage() {
  const { language } = useLanguage();
  const { session } = useAuth();
  const goLive = isGoLivePresentationEnabled();
  const [pendingFilters, setPendingFilters] = useState({});
  const [committedFilters, setCommittedFilters] = useState(null);
  const [state, setState] = useState(initialState);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  useEffect(() => {
    Promise.all([
      getCustomers({ isActive: true }),
      getProducts({ isActive: true }),
      getActiveLocations(),
    ]).then(([customerResult, productResult, locResult]) => {
      const customersData = customerResult.data ?? [];
      const productsData = productResult.data ?? [];
      const locsData = locResult.data ?? [];

      setCustomerOptions(customersData.map((c) => ({
        value: c.id,
        label: c.customer_name ?? c.customer_code ?? c.id,
        address: c.address,
        phone: c.phone,
        contact_name: c.contact_name
      })));

      setProductOptions(productsData.map((p) => ({
        value: p.id,
        label: p.sku ? `${p.sku} — ${p.name}` : (p.name ?? p.id),
      })));

      setLocationOptions(locsData.map((l) => ({
        value: l.id,
        label: l.label ?? l.code ?? l.id,
      })));
    });
  }, []);

  useEffect(() => {
    if (!committedFilters) return;

    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    const serviceFilters = {
      dateFrom: committedFilters.dateFrom || undefined,
      dateTo: committedFilters.dateTo || undefined,
      customerId: committedFilters.customerId || undefined,
      locationId: (Array.isArray(committedFilters.locationId) || !committedFilters.locationId) ? undefined : committedFilters.locationId,
      warehouseId: committedFilters.warehouseId || undefined,
      referenceType: committedFilters.referenceType || undefined,
    };

    // Inbound receipts from confirmed deposit lines (authoritative source with correct lot_no)
    // Outbound movements from stock_movements (DISPATCH, DELIVERY, etc.)
    const INBOUND_SKIP = new Set(['RECEIVE', 'RECEIVE_CONFIRM', 'RECEIVE_PENDING', 'INBOUND', 'RETURN', 'ADJUSTMENT_IN']);

    Promise.all([
      getMovementLedgerRows(serviceFilters),
      getConfirmedDepositReceiptRows(serviceFilters),
      getConfirmedWithdrawalRows(serviceFilters),
    ]).then(([result, depositResult, withdrawalResult]) => {
      if (!isMounted) return;

      // Keep outbound/neutral movements; exclude draft and inbound (deposit lines cover all inbound)
      let outboundRows = (result.data ?? []).filter((r) => {
        const movType = String(r.movement_type_raw || '').toUpperCase();
        return !movType.includes('DRAFT') && !INBOUND_SKIP.has(movType);
      });

      let depositRows = depositResult.data ?? [];
      let withdrawalRows = withdrawalResult.data ?? [];

      // Apply product filter
      if (committedFilters.productId && committedFilters.productId.length > 0) {
        const applyProd = (rowSet) => Array.isArray(committedFilters.productId)
          ? rowSet.filter((r) => committedFilters.productId.includes(r.product_id))
          : rowSet.filter((r) => r.product_id === committedFilters.productId);
        outboundRows = applyProd(outboundRows);
        depositRows = applyProd(depositRows);
      }

      // Apply location filter
      if (committedFilters.locationId && committedFilters.locationId.length > 0) {
        if (Array.isArray(committedFilters.locationId)) {
          outboundRows = outboundRows.filter((r) =>
            committedFilters.locationId.includes(r.location_id) ||
            committedFilters.locationId.includes(r.to_location_id) ||
            committedFilters.locationId.includes(r.from_location_id));
        } else {
          outboundRows = outboundRows.filter((r) =>
            r.location_id === committedFilters.locationId ||
            r.to_location_id === committedFilters.locationId ||
            r.from_location_id === committedFilters.locationId);
        }
      }

      // Merge and sort by movement_date ascending; same date: inbound before outbound
      let rows = [...depositRows, ...withdrawalRows, ...outboundRows].sort((a, b) => {
        const aTime = new Date(a.movement_date ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.movement_date ?? b.created_at ?? 0).getTime();
        if (aTime !== bTime) return aTime - bTime;
        const aOut = (a.movement_type === 'DISPATCH' || a.movement_type_canonical === 'DISPATCH') ? 1 : 0;
        const bOut = (b.movement_type === 'DISPATCH' || b.movement_type_canonical === 'DISPATCH') ? 1 : 0;
        return aOut - bOut;
      });

      // Enrich with display names
      const productMap = Object.fromEntries(productOptions.map((p) => [p.value, p.label]));
      const customerMap = Object.fromEntries(customerOptions.map((c) => [c.value, c.label]));
      rows = rows.map((row) => ({
        ...row,
        product_name: row.product_name ?? productMap[row.product_id] ?? row.product_id,
        customer_name: row.customer_name ?? customerMap[row.customer_id] ?? row.customer_id,
      }));

      setState({
        rows,
        summary: summarizeMovements(rows),
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => { isMounted = false; };
  }, [committedFilters]);

  const t = (key) => getTranslation(key, language);

  return (
    <section className={`page-shell${goLive ? ' page-shell--golive' : ''}`}>
      <PageHeader
        title={t('movement_ledger_report', 'รายงานการเคลื่อนไหวสินค้าของลูกค้า (Movement Ledger)')}
        description={goLive
          ? t('movement_ledger_report_description_golive', 'รายงานการเคลื่อนไหวสินค้า — ข้อมูลจริงสำหรับตรวจสอบการปฏิบัติงาน')
          : t('movement_ledger_report_description', 'รายงานการเคลื่อนไหวสินค้าสำหรับเตรียมการตรวจสอบ')}
      />

      <ReportFilterPanel
        onChange={setCommittedFilters}
        customerOptions={customerOptions}
        productOptions={productOptions}
        locationOptions={locationOptions}
        showMovementType={false}
        multiProduct={true}
        multiLocation={true}
      />

      {committedFilters && !state.loading && state.rows.length > 0 ? (
        <div className="section-card operational-report-actions-card" style={{ marginTop: 12 }}>
          <ReportPrintActions
            title={t('entry_delivery_inventory_report') || 'Entry-Delivery Inventory Report'}
            disabled={false}
            orientation="landscape"
            renderReport={(reportLanguage) => {
              const selectedCustomer = customerOptions.find((c) => c.value === committedFilters.customerId);
              const customerLabel = selectedCustomer?.label ?? committedFilters.customerId ?? 'ทั้งหมด';
              return (
                <InventoryMovementReportTemplate
                  printedBy={session?.user?.email ?? session?.user?.user_metadata?.full_name ?? null}
                  data={mapMovementLedgerToInventoryReportData({
                    rows: state.rows,
                    filters: {
                      ...committedFilters,
                      customer_name: customerLabel,
                      customer_address: selectedCustomer?.address,
                      date_from: committedFilters.dateFrom,
                      date_to: committedFilters.dateTo,
                    },
                    summary: state.summary,
                  })}
                  language={reportLanguage}
                  customerDetails={selectedCustomer}
                />
              );
            }}
          />
        </div>
      ) : null}

      <DashboardSection title={t('movement_ledger', 'รายการเคลื่อนไหว (Movement Ledger)')}>
        {!committedFilters ? (
          <EmptyState message="รอการค้นหา" description="กรุณาเลือกช่วงเวลาและกด Search เพื่อดูข้อมูลรายการเคลื่อนไหว" />
        ) : (
          <MovementLedgerTable data={state.rows} loading={state.loading} error={state.error} />
        )}
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
