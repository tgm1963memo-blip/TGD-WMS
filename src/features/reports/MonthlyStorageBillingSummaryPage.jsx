import { useEffect, useMemo, useState } from 'react';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { AccountingHandoffNote } from '../../components/reports/AccountingHandoffNote.jsx';
import { BillingValidationWarningPanel } from '../../components/reports/BillingValidationWarningPanel.jsx';
import { MonthlyBillingSummaryTable } from '../../components/reports/MonthlyBillingSummaryTable.jsx';
import { OperationChargePreviewTable } from '../../components/reports/OperationChargePreviewTable.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import {
  classifyBillingValidationStatus,
  getCustomerBillingSummaryPreview,
  getMonthlyStorageBillingPreview,
  summarizeBillingPreviewRows,
  validateBillingPreviewRows,
} from '../../services/monthlyStorageBillingSummaryService.js';

const currentDate = new Date();

const initialFilters = {
  month: String(currentDate.getMonth() + 1).padStart(2, '0'),
  year: String(currentDate.getFullYear()),
  customerId: '',
};

const initialState = {
  rows: [],
  customerRows: [],
  validation: { valid: true, errors: [] },
  loading: true,
  error: null,
};

function billingPeriod(filters) {
  return `${filters.year}-${filters.month}`;
}

function toPreviewFilters(filters) {
  const dateFrom = `${filters.year}-${filters.month}-01`;
  const endDate = new Date(Number(filters.year), Number(filters.month), 0);
  const dateTo = `${filters.year}-${filters.month}-${String(endDate.getDate()).padStart(2, '0')}`;

  return {
    dateFrom,
    dateTo,
    customerId: filters.customerId,
  };
}

function enrichRows(rows, filters) {
  return rows.map((row, index) => {
    const validationStatus = classifyBillingValidationStatus(row);

    return {
      ...row,
      id: row.id ?? `${row.preview_source ?? 'PREVIEW'}-${index}`,
      billing_period: billingPeriod(filters),
      validation_status: validationStatus,
      accounting_note: validationStatus === 'READY_FOR_REVIEW'
        ? 'Ready for accounting review'
        : 'Missing data requires review',
    };
  });
}

export function MonthlyStorageBillingSummaryPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [state, setState] = useState(initialState);

  const previewFilters = useMemo(() => toPreviewFilters(filters), [filters]);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      getMonthlyStorageBillingPreview(previewFilters),
      getCustomerBillingSummaryPreview(previewFilters),
    ]).then(([previewResult, customerResult]) => {
      if (!isMounted) return;

      const rows = enrichRows(previewResult.data ?? [], filters);
      const validation = validateBillingPreviewRows(rows);

      setState({
        rows,
        customerRows: customerResult.data ?? [],
        validation,
        loading: false,
        error: previewResult.error ?? customerResult.error ?? null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [filters, previewFilters]);

  const summary = summarizeBillingPreviewRows(state.rows);
  const operationRows = state.rows.filter((row) => row.preview_source === 'OPERATION_CHARGE');

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Monthly Storage Billing Summary"
        description="Preview-only cold storage billing support report for customer-owned inventory and accounting review."
      />

      <section className="document-filter-bar" aria-label="Billing period selector">
        <label>Month<input name="month" type="number" min="1" max="12" value={filters.month} onChange={updateFilter} /></label>
        <label>Year<input name="year" type="number" min="2020" value={filters.year} onChange={updateFilter} /></label>
        <label>Customer<input name="customerId" value={filters.customerId} onChange={updateFilter} placeholder="Customer ID" /></label>
      </section>

      <DashboardSection title="Monthly Storage Billing Preview Summary">
        <div className="summary-grid">
          <ReportSummaryCard label="Total Customers" value={summary.total_customers} />
          <ReportSummaryCard label="Total Deposit / Inbound Qty" value={summary.total_deposit_qty} />
          <ReportSummaryCard label="Total Withdrawal / Outbound Qty" value={summary.total_withdrawal_qty} />
          <ReportSummaryCard label="Total Remaining Qty" value={summary.total_remaining_qty} />
          <ReportSummaryCard label="Estimated Chargeable Weight / Qty" value={summary.estimated_chargeable_weight_qty} />
          <ReportSummaryCard label="Operation Charge Activity Count" value={summary.operation_charge_activity_count} />
          <ReportSummaryCard label="Rows Missing Rate" value={summary.rows_missing_rate} />
          <ReportSummaryCard label="Rows Missing Weight" value={summary.rows_missing_weight} />
          <ReportSummaryCard label="Rows Requiring Accounting Review" value={summary.rows_requiring_accounting_review} />
        </div>
      </DashboardSection>

      <DashboardSection title="Monthly Billing Summary Table">
        <MonthlyBillingSummaryTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Customer Billing Summary Preview">
        <MonthlyBillingSummaryTable data={state.customerRows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Operation Charge Preview Section">
        <OperationChargePreviewTable data={operationRows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="Missing Data / Validation Warning Section">
        <BillingValidationWarningPanel rows={state.rows} loading={state.loading} error={state.error} />
        {!state.validation.valid ? <p className="sprint-status">Validation warnings require accounting review.</p> : null}
      </DashboardSection>

      <AccountingHandoffNote />
    </section>
  );
}
