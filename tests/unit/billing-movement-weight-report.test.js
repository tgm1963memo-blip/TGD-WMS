import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BILLING_MOVEMENT_WEIGHT_VIEW_NAME,
  shapeBillingMovementWeightRow,
} from '../../src/services/billingMovementWeightService.js';
import {
  applyBillingMovementWeightFilters,
  buildBillingMovementWeightCsv,
  calculateBillingMovementWeightSummary,
  classifyBillingMovementWeightError,
} from '../../src/utils/billingMovementWeightReportUtils.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

const sampleRows = [
  {
    movement_id: 'mv-1',
    movement_type: 'RECEIVE_CONFIRM',
    canonical_movement_type: 'RECEIVE',
    movement_date: '2026-06-01T10:00:00.000Z',
    customer_id: 'cust-1',
    customer_name: 'Alpha',
    product_id: 'prod-1',
    product_code: 'FSHR-001',
    product_name: 'Frozen Shrimp',
    qty: 10,
    net_weight: 0,
    gross_weight: 0,
    chargeable_weight: 0,
    is_billable: true,
    billing_status: 'NEEDS_WEIGHT_REVIEW',
    billing_exclusion_reason: null,
    billing_service_type: 'INBOUND_HANDLING',
    source_document_no: 'RCV-001',
  },
  {
    movement_id: 'mv-2',
    movement_type: 'PICK_CONFIRM',
    canonical_movement_type: 'PICK_CONFIRM',
    movement_date: '2026-06-02T10:00:00.000Z',
    customer_id: 'cust-2',
    customer_name: 'Beta',
    product_id: 'prod-2',
    product_code: 'FFSH-001',
    product_name: 'Frozen Fish',
    qty: 5,
    net_weight: 50,
    gross_weight: 50,
    chargeable_weight: 50,
    is_billable: false,
    billing_status: 'READY_FOR_PREVIEW',
    billing_exclusion_reason: 'PICK_NOT_FINAL_DISPATCH',
    billing_service_type: 'NON_BILLABLE',
    source_document_no: null,
  },
];

describe('Gate 3A billing movement weight report', () => {
  it('creates billing movement weight report page and components', () => {
    [
      'src/features/reports/BillingMovementWeightReportPage.jsx',
      'src/components/reports/BillingMovementWeightFilterPanel.jsx',
      'src/components/reports/BillingMovementWeightTable.jsx',
      'src/utils/billingMovementWeightReportUtils.js',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('routes and menus billing movement weight report', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');
    const navigationSource = readProjectFile('src/app/navigation.js');
    const permissionSource = readProjectFile('src/security/routePermissionCatalog.js');

    expect(routesSource).toContain('/reports/billing-movement-weight');
    expect(routesSource).toContain('BillingMovementWeightReportPage');
    expect(navigationSource).toContain('billing-menu-item');
    expect(navigationSource).toContain('/reports/billing-movement-weight');
    expect(permissionSource).toContain('/reports/billing-movement-weight');
  });

  it('includes required data-testid markers', () => {
    const pageSource = readProjectFile('src/features/reports/BillingMovementWeightReportPage.jsx');
    const filterSource = readProjectFile('src/components/reports/BillingMovementWeightFilterPanel.jsx');
    const tableSource = readProjectFile('src/components/reports/BillingMovementWeightTable.jsx');

    [
      'billing-movement-weight-report-page',
      'billing-movement-weight-filter-form',
      'billing-movement-weight-table',
      'billing-movement-weight-empty-state',
      'billing-movement-weight-error-alert',
      'create-invoice-draft-button',
      'billing-movement-weight-export-button',
      'billing-status-badge',
      'billing-exclusion-reason-badge',
    ].forEach((testId) => {
      expect(pageSource.includes(testId) || filterSource.includes(testId) || tableSource.includes(testId)).toBe(true);
    });
  });

  it('shapes billing movement weight rows from database view fields', () => {
    const shaped = shapeBillingMovementWeightRow({
      movement_id: 'mv-9',
      movement_type: 'RECEIVE_CONFIRM',
      movement_type_canonical: 'RECEIVE',
      customer_name: 'Demo',
      product_code: 'SKU-1',
      is_billable: true,
      billing_status: 'NEEDS_WEIGHT_REVIEW',
    });

    expect(shaped.movement_id).toBe('mv-9');
    expect(shaped.canonical_movement_type).toBe('RECEIVE');
    expect(shaped.billing_status).toBe('NEEDS_WEIGHT_REVIEW');
  });

  it('filters rows by billable status, billing status, and movement type', () => {
    const billableOnly = applyBillingMovementWeightFilters(sampleRows, { isBillable: 'true' });
    const needsReview = applyBillingMovementWeightFilters(sampleRows, { billingStatus: 'NEEDS_WEIGHT_REVIEW' });
    const receiveOnly = applyBillingMovementWeightFilters(sampleRows, { movementType: 'RECEIVE' });

    expect(billableOnly).toHaveLength(1);
    expect(needsReview).toHaveLength(1);
    expect(receiveOnly).toHaveLength(1);
  });

  it('calculates summary cards for qty and weight totals', () => {
    const summary = calculateBillingMovementWeightSummary(sampleRows);

    expect(summary.totalMovements).toBe(2);
    expect(summary.billableMovements).toBe(1);
    expect(summary.excludedMovements).toBe(1);
    expect(summary.totalQty).toBe(15);
    expect(summary.totalChargeableWeight).toBe(50);
    expect(summary.needsWeightReviewCount).toBe(1);
  });

  it('classifies schema cache and RLS errors for empty/error states', () => {
    expect(classifyBillingMovementWeightError({ code: 'PGRST205', message: 'Could not find the table' }).type)
      .toBe('schema_cache');
    expect(classifyBillingMovementWeightError({ message: 'permission denied for view' }).type)
      .toBe('rls_block');
  });

  it('builds CSV export with billing columns and escaped values', () => {
    const csv = buildBillingMovementWeightCsv(sampleRows);

    expect(csv.split('\n')[0]).toContain('movement_date');
    expect(csv).toContain('NEEDS_WEIGHT_REVIEW');
    expect(csv).toContain('PICK_NOT_FINAL_DISPATCH');
  });

  it('reads billing movement weight view from approved service', () => {
    const serviceSource = readProjectFile('src/services/billingMovementWeightService.js');

    expect(serviceSource).toContain(BILLING_MOVEMENT_WEIGHT_VIEW_NAME);
    expect(serviceSource).toContain('getBillingMovementWeightRows');
    expect(serviceSource).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    expect(serviceSource).not.toContain('invoice');
    expect(serviceSource).not.toContain('BILLED');
  });

  it('keeps gate 3B-2 page bounded without approve/export/mark billed workflow', () => {
    const pageSource = readProjectFile('src/features/reports/BillingMovementWeightReportPage.jsx');

    expect(pageSource).toContain('create-invoice-draft-button');
    expect(pageSource).not.toContain('approve-invoice-draft-button');
    expect(pageSource).not.toContain('export-bplus-button');
    expect(pageSource).not.toContain('mark-billed-button');
    expect(pageSource).not.toContain('bplus-invoice-no-input');
    expect(pageSource).not.toContain('billingExportService');
    expect(pageSource).not.toContain('AccountingChargeHandoff');
    expect(pageSource).toContain('NEEDS_WEIGHT_REVIEW');
  });
});
