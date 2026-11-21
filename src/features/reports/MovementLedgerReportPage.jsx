import { useEffect, useState, useMemo } from 'react';
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
import { fetchMergedMovementLedgerRows } from '../../services/movementLedgerMergedRows.js';
import {
  getAuthoritativeBalanceTotals,
  summarizeMovements,
} from '../../services/movementLedgerReportService.js';
import { mapMovementLedgerToInventoryReportData } from '../../services/operationalReportMapper.js';
import { downloadMovementLedgerExcel, aggregateFinalBalances, sortRowsByProductThenLot, movementBalanceKey, addMovement } from '../../utils/movementLedgerExcelUtils.js';
import { getCustomers, getProducts } from '../../services/masterDataService.js';
import { listCustomerProductCategories } from '../../services/customerProductCatalogService.js';
import { getActiveLocations } from '../../services/warehouseLayoutService.js';
import { EmptyState } from '../../components/ui/EmptyState.jsx';

const initialState = {
  rows: [],
  summary: null,
  loading: false,
  error: null,
};

function dayBefore(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// getAuthoritativeBalanceTotals accepts an asOfDate AND per-row filters
// (temperatureType/customerProductCode/lotNo/trackingCode/productCategory/
// productId/locationId), resolving whichever of these aren't directly on
// the RPC's own row shape via one extra lookup each (product_category via
// the catalog; product_id/location_id via each row's own deposit line) — so
// it stays a valid stand-in for "this report's remaining total" for every
// filter except the two below, which the RPC's row shape has no way to
// answer at all:
//   - warehouseId: the RPC has no warehouse dimension in its balance rows
//     (this is a single-deposit-line, not a per-warehouse, aggregation).
//   - referenceType: a property of individual movement transactions, not
//     meaningful against a point-in-time remaining-balance row.
function canUseAuthoritativeTotals(committedFilters) {
  if (!committedFilters) return false;
  if (committedFilters.warehouseId || committedFilters.referenceType) return false;
  return true;
}

export function MovementLedgerReportPage() {
  const { language } = useLanguage();
  const { session } = useAuth();
  const goLive = isGoLivePresentationEnabled();
  const [pendingFilters, setPendingFilters] = useState({});
  const [committedFilters, setCommittedFilters] = useState(null);
  const [state, setState] = useState(initialState);
  // Every movement strictly before the report's Date From — kept in state
  // (not just fed once into a single openingBalances computation) so
  // switching sortMode can recompute opening balances under the newly
  // selected grouping without a refetch.
  const [priorRows, setPriorRows] = useState([]);
  // Authoritative "remaining" total — sourced from the same algorithm as
  // the stock balance page's RPC (see getAuthoritativeBalanceTotals), not
  // re-derived from date-filtered movement rows, so the report's grand
  // TOTAL always agrees with that page exactly.
  const [authoritativeTotals, setAuthoritativeTotals] = useState(null);
  // Controls row order for the on-screen table, the PDF report, and the
  // Excel export all at once: plain chronological order, or grouped by
  // product then lot / product then tracking code (a stock-card view
  // showing each lot's or each physical batch's full history together
  // instead of interleaved with every other product by date).
  const [sortMode, setSortMode] = useState('productLot');
  // A LOT can span several tracking codes (several receiving batches under
  // one lot label) — grouping by lot pools those batches' balances
  // together, while grouping by tracking code keeps each physical batch's
  // own balance separate. Both the on-screen table and the Excel/PDF
  // exports below key off this same mapping.
  const groupBy = sortMode === 'productTrackingCode' ? 'trackingCode' : 'lot';
  const openingBalances = useMemo(
    () => aggregateFinalBalances(priorRows, groupBy),
    [priorRows, groupBy],
  );
  const [customerOptions, setCustomerOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

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
        temperatureType: p.temperature_type,
      })));

      setLocationOptions(locsData.map((l) => ({
        value: l.id,
        label: l.label ?? l.code ?? l.id,
      })));
    });
  }, []);

  // Free-text catalog field, so options come from whatever's actually in
  // use rather than a fixed enum — scoped to the selected customer once
  // one is chosen (categories are only unique per-customer, not global),
  // covering every customer's categories otherwise.
  useEffect(() => {
    listCustomerProductCategories({ customerId: committedFilters?.customerId || undefined }).then((result) => {
      setCategoryOptions((result.data ?? []).map((c) => ({ value: c, label: c })));
    });
  }, [committedFilters?.customerId]);

  useEffect(() => {
    if (!committedFilters) return;

    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    const serviceFilters = {
      dateFrom: committedFilters.dateFrom || undefined,
      dateTo: committedFilters.dateTo || undefined,
      customerId: committedFilters.customerId || undefined,
      productId: (Array.isArray(committedFilters.productId) && committedFilters.productId.length === 0) ? undefined : committedFilters.productId || undefined,
      locationId: (Array.isArray(committedFilters.locationId) || !committedFilters.locationId) ? undefined : committedFilters.locationId,
      warehouseId: committedFilters.warehouseId || undefined,
      referenceType: committedFilters.referenceType || undefined,
      trackingCode: committedFilters.trackingCode || undefined,
      lotNo: committedFilters.lotNo || undefined,
      productCode: committedFilters.productCode || undefined,
    };

    const enrich = (rowsToEnrich) => {
      const productMap = Object.fromEntries(productOptions.map((p) => [p.value, p.label]));
      const productTempMap = Object.fromEntries(productOptions.map((p) => [p.value, p.temperatureType]));
      const customerMap = Object.fromEntries(customerOptions.map((c) => [c.value, c.label]));
      const locationMap = Object.fromEntries(locationOptions.map((l) => [l.value, l.label]));
      return rowsToEnrich.map((row) => ({
        ...row,
        product_name: row.product_name ?? productMap[row.product_id] ?? row.product_id,
        customer_name: row.customer_name ?? customerMap[row.customer_id] ?? row.customer_id,
        temperature_type: row.temperature_type ?? productTempMap[row.product_id] ?? null,
        // A withdrawal row may already carry a joined multi-pallet location
        // string (e.g. "42-L-01-01, 42-L-01-02") from getConfirmedWithdrawalRows
        // — only fall back to the single location_id -> label lookup when it
        // doesn't (deposit rows, and withdrawal rows the pallet-pick trail
        // couldn't resolve).
        location_name: row.location_name ?? (row.location_id ? (locationMap[row.location_id] ?? row.location_id) : null),
      }));
    };

    // Prior-period fetch (everything strictly before Date From) computes each
    // lot's ยกมา opening balance for the Excel export — skipped when there's
    // no Date From, since the main query already covers all history then.
    const priorFetch = committedFilters.dateFrom
      ? fetchMergedMovementLedgerRows(
          { ...serviceFilters, dateFrom: undefined, dateTo: dayBefore(committedFilters.dateFrom) },
          committedFilters,
        )
      : Promise.resolve({ rows: [], error: null });

    const authoritativeFetch = canUseAuthoritativeTotals(committedFilters)
      ? getAuthoritativeBalanceTotals(committedFilters.customerId || null, committedFilters.dateTo || null, {
          temperatureType: committedFilters.temperatureType,
          customerProductCode: committedFilters.productCode,
          lotNo: committedFilters.lotNo,
          trackingCode: committedFilters.trackingCode,
          productCategory: committedFilters.productCategory,
          productId: committedFilters.productId,
          locationId: committedFilters.locationId,
        })
      : Promise.resolve({ data: null, error: null });

    Promise.all([
      fetchMergedMovementLedgerRows(serviceFilters, committedFilters),
      priorFetch,
      authoritativeFetch,
    ]).then(([main, prior, authoritative]) => {
      if (!isMounted) return;

      setAuthoritativeTotals(authoritative.error ? null : authoritative.data);

      let rows = enrich(main.rows);
      let priorRows = enrich(prior.rows);

      if (committedFilters.temperatureType && committedFilters.temperatureType.length > 0) {
        const types = Array.isArray(committedFilters.temperatureType) ? committedFilters.temperatureType : [committedFilters.temperatureType];
        
        const filterFn = (r) => {
          const t = r.temperature_type || '-';
          return types.includes(t);
        };

        rows = rows.filter(filterFn);
        priorRows = priorRows.filter(filterFn);
      }

      if (committedFilters.productCategory && committedFilters.productCategory.length > 0) {
        const categories = Array.isArray(committedFilters.productCategory) ? committedFilters.productCategory : [committedFilters.productCategory];
        const filterFn = (r) => categories.includes(r.product_category || '-');
        rows = rows.filter(filterFn);
        priorRows = priorRows.filter(filterFn);
      }

      if (committedFilters.trackingCode && committedFilters.trackingCode.trim()) {
        const query = committedFilters.trackingCode.trim().toLowerCase();
        const filterFn = (r) => (r.tracking_code || '').toLowerCase().includes(query);
        rows = rows.filter(filterFn);
        priorRows = priorRows.filter(filterFn);
      }

      if (committedFilters.lotNo && committedFilters.lotNo.trim()) {
        const query = committedFilters.lotNo.trim().toLowerCase();
        const filterFn = (r) => (r.lot_no || '').toLowerCase().includes(query);
        rows = rows.filter(filterFn);
        priorRows = priorRows.filter(filterFn);
      }

      // Matches each row's own customer_product_code directly, not via the
      // productId dropdown's internal-master lookup (see ReportFilterPanel's
      // showProductCode comment) - this is what makes a real deposit/
      // withdrawal line searchable by its actual product code even when
      // that code was never added to tgd_products.
      if (committedFilters.productCode && committedFilters.productCode.trim()) {
        const query = committedFilters.productCode.trim().toLowerCase();
        const filterFn = (r) => (r.customer_product_code || '').toLowerCase().includes(query);
        rows = rows.filter(filterFn);
        priorRows = priorRows.filter(filterFn);
      }

      setState({
        rows,
        summary: summarizeMovements(rows),
        loading: false,
        error: main.error,
      });
      setPriorRows(priorRows);
    });

    return () => { isMounted = false; };
  }, [committedFilters]);

  const t = (key) => getTranslation(key, language);
  const isGrouped = sortMode !== 'date';
  const displayRows = useMemo(() => {
    const ordered = isGrouped ? sortRowsByProductThenLot(state.rows, groupBy) : state.rows;
    const running = new Map();
    let currentKey = null;
    let balance = { qty: 0, weight: 0 };

    return ordered.map((row) => {
      const key = movementBalanceKey(row, groupBy);
      if (isGrouped) {
        if (key !== currentKey) {
          currentKey = key;
          balance = openingBalances.get(key) ?? { qty: 0, weight: 0 };
        }
      } else {
        balance = running.get(key) ?? openingBalances.get(key) ?? { qty: 0, weight: 0 };
      }

      const nextBalance = addMovement(balance, row);

      if (isGrouped) {
        balance = nextBalance;
      } else {
        running.set(key, nextBalance);
      }

      return {
        ...row,
        balanceQty: nextBalance.qty,
        balanceWeight: nextBalance.weight,
      };
    });
  }, [state.rows, isGrouped, groupBy, openingBalances]);

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
        categoryOptions={categoryOptions}
        showMovementType={true}
        multiProduct={true}
        multiLocation={true}
        showTrackingCode={true}
        showLotNo={true}
        showProductCode={true}
        showCategory={true}
      />

      {committedFilters && !state.loading && state.rows.length > 0 ? (
        <div className="section-card" style={{ marginTop: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>เรียงตาม:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="radio"
              name="movement-ledger-sort-mode"
              value="date"
              checked={sortMode === 'date'}
              onChange={() => setSortMode('date')}
            />
            วันที่
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="radio"
              name="movement-ledger-sort-mode"
              value="productLot"
              checked={sortMode === 'productLot'}
              onChange={() => setSortMode('productLot')}
            />
            สินค้าและ Lot
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="radio"
              name="movement-ledger-sort-mode"
              value="productTrackingCode"
              checked={sortMode === 'productTrackingCode'}
              onChange={() => setSortMode('productTrackingCode')}
            />
            สินค้าและรหัสติดตาม
          </label>
        </div>
      ) : null}

      {committedFilters && !state.loading && state.rows.length > 0 ? (
        <div className="section-card operational-report-actions-card" style={{ marginTop: 12 }}>
          <ReportPrintActions
            title={t('entry_delivery_inventory_report') || 'Entry-Delivery Inventory Report'}
            disabled={false}
            orientation="landscape"
            extraActions={(
              <button
                type="button"
                className="btn"
                onClick={() => downloadMovementLedgerExcel(state.rows, openingBalances, sortMode, 'movement-ledger', authoritativeTotals)}
                disabled={state.rows.length === 0}
              >
                Export Excel
              </button>
            )}
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
                    openingBalances,
                    sortMode,
                    authoritativeTotals,
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
          <div data-testid="movement-ledger-table">
            <MovementLedgerTable data={displayRows} loading={state.loading} error={state.error} grouped={isGrouped} groupBy={groupBy} />
          </div>
        )}
      </DashboardSection>

      {!goLive ? (
        <section className="safety-panel" style={{ padding: 16, background: 'var(--color-danger-soft)', border: '1px solid var(--color-danger-border)', borderRadius: 8 }}>
          <h3 style={{ color: 'var(--tgd-danger)', fontSize: 16 }}>Production remains HOLD</h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: 'var(--color-danger-strong)', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
