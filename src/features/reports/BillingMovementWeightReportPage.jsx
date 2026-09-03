import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { BillingMovementWeightFilterPanel } from '../../components/reports/BillingMovementWeightFilterPanel.jsx';
import { BillingMovementWeightTable } from '../../components/reports/BillingMovementWeightTable.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import { enrichClientMergedBillingMovementWeightRow } from '../../services/billingMovementWeightService.js';
import {
  getMovementLedgerRows,
  getConfirmedDepositReceiptRows,
  getConfirmedWithdrawalRows,
  getStorageOpeningBalanceRows,
} from '../../services/movementLedgerReportService.js';
import {
  createBillingInvoiceDraftFromMovements,
  findActiveDuplicateDraftLines,
} from '../../services/billingInvoiceDraftService.js';
import { listAllProductServiceRates } from '../../services/productServiceRatesService.js';
import { getCustomers, getProducts } from '../../services/masterDataService.js';
import {
  applyActiveDuplicateDraftGuards,
  formatInvoiceDraftError,
  getMovementDraftSelectionState,
  validateInvoiceDraftSourceRows,
} from '../../utils/billingInvoiceDraftUtils.js';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { canWriteBillingInvoiceDrafts } from '../../security/billingInvoiceDraftPermissions.js';
import {
  applyBillingMovementWeightFilters,
  calculateBillingMovementWeightSummary,
  classifyBillingMovementWeightError,
  downloadBillingMovementWeightCsv,
} from '../../utils/billingMovementWeightReportUtils.js';

const initialState = {
  rows: [],
  loading: true,
  error: null,
  source: null,
};

export function BillingMovementWeightReportPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { role: userRole, ready: roleReady } = useUserRole();
  const goLive = isGoLivePresentationEnabled();
  const canCreateDraft = roleReady && canWriteBillingInvoiceDrafts(userRole);
  const [filters, setFilters] = useState({});
  const [committedFilters, setCommittedFilters] = useState(null);
  const [state, setState] = useState({ ...initialState, loading: false });
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedMovementIds, setSelectedMovementIds] = useState(() => new Set());
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftValidationError, setDraftValidationError] = useState(null);
  const [draftSuccess, setDraftSuccess] = useState(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getCustomers(), getProducts()]).then(([customerResult, productResult]) => {
      if (!isMounted) return;
      setCustomers(customerResult.data ?? []);
      setProducts(productResult.data ?? []);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!committedFilters) return;

    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    const INBOUND_SKIP = new Set(['RECEIVE', 'RECEIVE_CONFIRM', 'RECEIVE_PENDING', 'INBOUND', 'RETURN', 'ADJUSTMENT_IN']);

    // Storage billing needs weight-basis for lots deposited before the
    // selected period's start too (the "ยอดยกมา" opening balance) — but
    // computing that requires a full deposit/withdrawal history for one
    // customer, so it's only fetched when both a customer and a Date From
    // are selected (mirrors canUseAuthoritativeTotals-style gating used
    // elsewhere for this same reason).
    const openingBalanceFetch = committedFilters.customerId && committedFilters.dateFrom
      ? getStorageOpeningBalanceRows(committedFilters.customerId, committedFilters.dateFrom)
      : Promise.resolve({ data: [], error: null });

    Promise.all([
      getMovementLedgerRows(committedFilters),
      getConfirmedDepositReceiptRows(committedFilters),
      getConfirmedWithdrawalRows(committedFilters),
      openingBalanceFetch,
    ]).then(async ([movResult, depositResult, withdrawalResult, openingResult]) => {
      if (!isMounted) return;

      const err = movResult.error ?? depositResult.error ?? withdrawalResult.error ?? openingResult.error;
      if (err) {
        setState({ rows: [], loading: false, error: err, source: null });
        return;
      }

      const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.customer_name ?? c.name]));
      const productMap = Object.fromEntries(products.map((p) => [p.id, p.product_name ?? p.sku ?? p.name]));
      // Movement rows don't carry temperature themselves (it's a product attribute);
      // deposit/withdrawal lines do carry their own temperature_type snapshot, so
      // that takes priority, falling back to the product catalog's current value.
      const productTemperatureMap = Object.fromEntries(products.map((p) => [p.id, p.temperature_type ?? null]));

      let outboundRows = (movResult.data ?? []).filter((r) => {
        const mt = String(r.movement_type_raw || '').toUpperCase();
        if (mt.includes('DRAFT')) return false;

        // tgd_stock_movements actually stores 'CUSTOMER_DEPOSIT_REQUEST' (confirmed via
        // direct query), not the bare 'CUSTOMER_DEPOSIT' this used to check for — that
        // exact-match never fired, so every deposit confirmation was double counted here:
        // once from this generic stock_movements row (blank lot_no, raw movement-id
        // reference) and once from the richer, lot_no-bearing row depositResult.data
        // already supplies for the same event. startsWith so any other
        // 'CUSTOMER_DEPOSIT*' source_module variant is caught too. Mirrors the identical
        // guard in MovementLedgerReportPage.jsx's fetchMergedRows — both pages merge the
        // exact same three sources and must apply the same de-dup.
        if (String(r.source_module || '').startsWith('CUSTOMER_DEPOSIT')) return false;

        // Fallback for legacy records that might not have source_module populated:
        // If it's an inbound movement but has no source_module, we assume it's a legacy
        // deposit and skip it to prevent double-counting.
        if (!r.source_module && INBOUND_SKIP.has(mt)) return false;

        return true;
      });

      // Same withdrawal de-dup as MovementLedgerReportPage.jsx's fetchMergedRows: a
      // legacy DISPATCH/CUSTOMER_WITHDRAWAL row in tgd_stock_movements referencing the
      // same WD- withdrawal document that withdrawalResult.data already supplies (richer
      // fields, e.g. tracking_code) must not also be counted from outboundRows.
      const withdrawalDocNumbers = new Set((withdrawalResult.data ?? []).map((r) => String(r.source_document_no)));
      outboundRows = outboundRows.filter((r) => {
        const isWithdrawal = r.movement_type_raw === 'CUSTOMER_WITHDRAWAL' || (r.movement_type_raw === 'DISPATCH' && String(r.source_document_no).startsWith('WD-'));
        if (isWithdrawal && withdrawalDocNumbers.has(String(r.source_document_no))) return false;
        return true;
      });

      const allRaw = [
        ...(depositResult.data ?? []),
        ...(withdrawalResult.data ?? []),
        ...(openingResult.data ?? []),
        ...outboundRows,
      ].sort((a, b) => new Date(a.movement_date ?? 0) - new Date(b.movement_date ?? 0));

      const shaped = allRaw.map((row) => ({
        ...enrichClientMergedBillingMovementWeightRow(row),
        customer_name: customerMap[row.customer_id] ?? row.customer_name ?? null,
        product_name: productMap[row.product_id] ?? row.product_name ?? null,
        temperature_type: row.temperature_type ?? productTemperatureMap[row.product_id] ?? null,
      }));

      const filtered = applyBillingMovementWeightFilters(shaped, committedFilters);

      let guardedRows = filtered;
      if (canCreateDraft) {
        const movementIds = filtered.map((r) => r.movement_id).filter(Boolean);
        const duplicateResult = await findActiveDuplicateDraftLines(movementIds);
        if (!isMounted) return;
        if (!duplicateResult.error) {
          guardedRows = applyActiveDuplicateDraftGuards(filtered, duplicateResult.data ?? []);
        }
      }

      setState({ rows: guardedRows, loading: false, error: null, source: 'merged' });
    });

    return () => { isMounted = false; };
  }, [canCreateDraft, committedFilters, customers, products]);

  useEffect(() => {
    setSelectedMovementIds(new Set());
    setDraftValidationError(null);
    setDraftSuccess(null);
  }, [committedFilters, state.rows]);

  const selectedRows = useMemo(
    () => state.rows.filter((row) => selectedMovementIds.has(String(row.movement_id))),
    [state.rows, selectedMovementIds],
  );

  const summary = useMemo(
    () => calculateBillingMovementWeightSummary(state.rows),
    [state.rows],
  );

  const classifiedError = state.error ? classifyBillingMovementWeightError(state.error) : null;

  const hasActiveFilter = committedFilters && (committedFilters.customerId || committedFilters.productId || committedFilters.dateFrom || committedFilters.dateTo || committedFilters.movementType || committedFilters.billingStatus || committedFilters.isBillable || committedFilters.temperatureType);

  const emptyMessage = state.loading
    ? null
    : !committedFilters
      ? 'รอการค้นหา — กรุณาเลือกช่วงเวลาและกด Search เพื่อดูข้อมูล'
      : classifiedError
        ? null
        : hasActiveFilter
          ? 'ไม่พบรายการที่ตรงกับเงื่อนไขที่เลือก — ลองล้างตัวกรองเพื่อดูข้อมูลทั้งหมด'
          : 'ยังไม่มีข้อมูลการเคลื่อนไหว — ข้อมูลจะปรากฏเมื่อมีการยืนยันรับสินค้าเข้าคลังผ่านหน้า Operations › Receiving';

  function handleExport() {
    if (!state.rows.length) return;
    downloadBillingMovementWeightCsv(state.rows);
  }

  function toggleRowSelection(movementId) {
    setDraftValidationError(null);
    setDraftSuccess(null);
    setSelectedMovementIds((current) => {
      const next = new Set(current);
      if (next.has(movementId)) next.delete(movementId);
      else next.add(movementId);
      return next;
    });
  }

  function toggleAllSelectable(movementIds = []) {
    setDraftValidationError(null);
    setDraftSuccess(null);
    setSelectedMovementIds((current) => {
      const allSelected = movementIds.every((id) => current.has(id));
      if (allSelected) return new Set();
      return new Set(movementIds);
    });
  }

  async function handleCreateDraft() {
    const movementIds = [...selectedMovementIds];
    const clientValidation = validateInvoiceDraftSourceRows(selectedRows);
    if (!clientValidation.valid) {
      setDraftValidationError(new Error(clientValidation.errors.join(' ')));
      setDraftSuccess(null);
      return;
    }

    // This page only ever resolves HANDLING_IN/HANDLING_OUT rates (see the
    // banner above) — a customer whose billing is entirely period-based
    // STORAGE will always get a draft with every rate/amount blank, which
    // has repeatedly been mistaken for a bug rather than the wrong flow.
    // Warn before creating one instead of just explaining it after the
    // fact.
    const customersInSelection = [...new Map(
      selectedRows.map((row) => [row.customer_id, row.customer_name ?? row.customer_id]),
    ).entries()];
    const customersMissingHandlingRate = [];
    await Promise.all(customersInSelection.map(async ([customerId, customerName]) => {
      if (!customerId) return;
      const result = await listAllProductServiceRates({ customerId, isActive: true });
      const rates = result?.data ?? [];
      const hasHandlingRate = rates.some((r) => r.service_type === 'HANDLING_IN' || r.service_type === 'HANDLING_OUT');
      if (!hasHandlingRate) customersMissingHandlingRate.push(customerName);
    }));

    if (customersMissingHandlingRate.length > 0) {
      const proceed = window.confirm(
        `ลูกค้าต่อไปนี้ไม่มีอัตราค่ายก-ขน (HANDLING_IN/HANDLING_OUT) กำหนดไว้ — ใบร่างที่จะสร้างจะมีอัตรา/ยอดเงินว่างเปล่าทุกบรรทัด:\n\n`
        + `${customersMissingHandlingRate.join(', ')}\n\n`
        + `หากลูกค้ารายนี้คิดค่าฝาก (STORAGE) แบบคิดเป็นรอบ ให้ไปใช้ปุ่ม "+ สร้างบิลค่าฝาก/ค่าบริการตามช่วงเวลา" ที่หน้า Invoice Draft List แทน\n\n`
        + `ยืนยันจะสร้างใบร่างนี้ต่อหรือไม่?`,
      );
      if (!proceed) return;
    }

    setCreatingDraft(true);
    setDraftValidationError(null);
    setDraftSuccess(null);

    const result = await createBillingInvoiceDraftFromMovements({
      movementIds,
      note: 'E2E_TEST',
    });

    setCreatingDraft(false);

    if (result.error) {
      setDraftValidationError(result.error);
      return;
    }

    const draft = result.data?.draft;
    setDraftSuccess(draft);
    setSelectedMovementIds(new Set());

    if (draft?.id) {
      navigate(`/billing/invoice-drafts/${draft.id}`);
    }
  }

  if (!roleReady) {
    return (
      <section className={`page-shell${goLive ? ' page-shell--golive' : ''}`} data-testid="billing-movement-weight-report-page">
        <LoadingState message="Loading permissions..." />
      </section>
    );
  }

  return (
    <section className={`page-shell${goLive ? ' page-shell--golive' : ''}`} data-testid="billing-movement-weight-report-page">
      <PageHeader
        title={getTranslation('billing_movement_weight_report', language) || 'Billing Movement Weight Report'}
        description={goLive
          ? (getTranslation('billing_movement_weight_report_description_golive', language)
            || 'Movement weight and billable status for billing review and invoice draft preparation.')
          : (getTranslation('billing_movement_weight_report_description', language) || 'Read-only preview of movement weight and billable status before billing approval.')}
      />

      {!goLive ? (
        <div className="section-card" style={{ marginBottom: 16, padding: 12, background: '#fff8e8', border: '1px solid var(--tgd-primary-gold)' }}>
          <strong>Gate 3B-2 Billing Preview</strong>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>
            Select READY_FOR_PREVIEW billable rows to create invoice drafts.
            No approve, no Bplus export, no Mark BILLED.
            NEEDS_WEIGHT_REVIEW rows remain review-only and cannot be selected.
          </p>
        </div>
      ) : null}

      <div className="section-card" style={{ marginBottom: 16, padding: 12, background: '#eff6ff', border: '1px solid #93c5fd' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#1e3a5f' }}>
          ⓘ หน้านี้คำนวณเฉพาะ<strong>ค่ายก-ขน (HANDLING_IN/HANDLING_OUT)</strong> ต่อรายการเคลื่อนไหว — ถ้าลูกค้าไม่มีอัตรา
          ค่ายก-ขนกำหนดไว้ (มีแต่อัตรา<strong>ค่าฝาก/STORAGE</strong> แบบคิดเป็นรอบ) แถว "อัตรา"/"งวด" จะว่างเสมอ ไม่ใช่ข้อผิดพลาด —
          ให้ไปสร้างบิลค่าฝากที่หน้า Invoice Draft List ปุ่ม <strong>"+ สร้างบิลค่าฝาก/ค่าบริการตามช่วงเวลา"</strong> แทน
        </p>
      </div>

      <BillingMovementWeightFilterPanel
        value={filters}
        onChange={(f) => { setFilters(f); setCommittedFilters(f); }}
        customers={customers}
        products={products}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, margin: '12px 0', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: 'var(--tgd-muted-text)' }}>
          Selected rows: {selectedMovementIds.size}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canCreateDraft ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateDraft}
              disabled={state.loading || creatingDraft || selectedMovementIds.size === 0}
              data-testid="create-invoice-draft-button"
            >
              {creatingDraft ? 'Creating Draft...' : 'Create Draft'}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleExport}
            disabled={state.loading || !state.rows.length}
            data-testid="billing-movement-weight-export-button"
          >
            Export CSV
          </button>
        </div>
      </div>

      {draftValidationError ? (
        <div
          className="section-card"
          role="alert"
          data-testid="invoice-draft-validation-alert"
          style={{ border: '1px solid var(--tgd-danger)', background: '#fff5f5', padding: 16, marginBottom: 16 }}
        >
          {formatInvoiceDraftError(draftValidationError)}
        </div>
      ) : null}

      {draftSuccess ? (
        <div
          className="section-card"
          role="status"
          data-testid="invoice-draft-success-alert"
          style={{ border: '1px solid #86efac', background: '#f0fdf4', padding: 16, marginBottom: 16 }}
        >
          Invoice draft <strong>{draftSuccess.draft_no}</strong> created.
          {draftSuccess.id ? (
            <>
              {' '}
              <Link to={`/billing/invoice-drafts/${draftSuccess.id}`}>View draft detail</Link>
            </>
          ) : null}
        </div>
      ) : null}

      {classifiedError ? (
        <div
          className="section-card"
          role="alert"
          style={{ border: '1px solid var(--tgd-danger)', background: '#fff5f5', padding: 16, marginBottom: 16 }}
          data-testid="billing-movement-weight-error-alert"
        >
          <strong>{classifiedError.title}</strong>
          <p style={{ margin: '8px 0 0' }}>{classifiedError.message}</p>
          {classifiedError.type === 'schema_cache' ? (
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>
              Suggested UAT fix: reload PostgREST schema in Supabase Dashboard and grant SELECT on
              {' '}
              <code>tgd_billing_movement_weight_v</code>
              {' '}
              to authenticated/anon as approved.
            </p>
          ) : null}
        </div>
      ) : null}

      <DashboardSection title="Billing Movement Weight Detail">
        <BillingMovementWeightTable
          data={state.rows}
          loading={state.loading}
          error={state.error}
          selectedMovementIds={selectedMovementIds}
          onToggleRow={canCreateDraft ? toggleRowSelection : null}
          onToggleAllSelectable={canCreateDraft ? toggleAllSelectable : null}
          getSelectionState={canCreateDraft ? getMovementDraftSelectionState : null}
          emptyState={(
            <div
              className="section-card"
              style={{ padding: 24, textAlign: 'center' }}
              data-testid="billing-movement-weight-empty-state"
            >
              <strong>{emptyMessage ?? 'Loading billing movement weight report...'}</strong>
              {!state.loading && !state.error && state.source === 'billing_database_view' && !goLive ? (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--tgd-muted-text)' }}>
                  Data source: UAT billing movement weight view.
                </p>
              ) : null}
            </div>
          )}
        />
      </DashboardSection>

      {!goLive ? (
        <section className="safety-panel" style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <h3 style={{ color: 'var(--tgd-danger)', fontSize: 16 }}>Production remains HOLD</h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>Gate 3B-2 supports create/list/cancel invoice drafts only</li>
            <li>No approve / Bplus export / Mark BILLED</li>
            <li>No billing amount calculation when weight is incomplete</li>
            <li>FINAL GO is NOT AUTHORIZED</li>
          </ul>
        </section>
      ) : null}
    </section>
  );
}
