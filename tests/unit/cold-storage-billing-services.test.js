import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 6C-Prep cold storage billing support services', () => {
  const serviceFiles = [
    'src/services/storageWeightSnapshotService.js',
    'src/services/operationChargeLogService.js',
    'src/services/monthlyStorageBillingSummaryService.js',
    'src/services/rateCardService.js',
    'src/services/billingExportService.js',
    'src/services/customerStorageBalanceReportService.js',
  ];

  const requiredFunctions = {
    'src/services/storageWeightSnapshotService.js': [
      'getDailyStorageWeightPreview',
      'getMonthlyStorageWeightPreview',
      'calculateChargeableWeight',
      'groupStorageWeightByCustomer',
      'groupStorageWeightByWarehouse',
      'groupStorageWeightByProduct',
    ],
    'src/services/operationChargeLogService.js': [
      'getOperationChargeLogs',
      'getOperationChargeSummary',
      'getOperationChargeTypes',
      'calculateOperationChargePreview',
    ],
    'src/services/monthlyStorageBillingSummaryService.js': [
      'getMonthlyStorageBillingPreview',
      'getCustomerBillingSummaryPreview',
      'combineStorageAndOperationCharges',
      'validateBillingPreviewRows',
    ],
    'src/services/rateCardService.js': [
      'getCustomerRateCards',
      'getRateCardByCustomer',
      'getDefaultStorageRateRules',
      'getDefaultOperationRateRules',
      'resolveRateForPreview',
    ],
    'src/services/billingExportService.js': [
      'getBillingExportPreview',
      'mapBillingSummaryToExportRows',
      'validateExportRows',
      'getSupportedExportFormats',
    ],
    'src/services/customerStorageBalanceReportService.js': [
      'getCustomerStorageBalanceRows',
      'getCustomerStorageBalanceSummary',
      'getStorageBalanceByCustomer',
      'getStorageBalanceByProduct',
      'getStorageBalanceByWarehouse',
      'getStorageBalanceByLot',
    ],
  };

  const forbiddenPostingTerms = [
    'tgd_post_inventory_movement',
    'tgd_post_receiving_document',
    'tgd_post_putaway_document',
    'tgd_post_transfer_document',
    'tgd_post_adjustment_document',
    'tgd_post_withdrawal_allocation',
    'tgd_confirm_picking_document',
    'tgd_post_dispatch_document',
    'tgd_complete_stock_count_document',
    'tgd_create_adjustment_from_stock_count',
  ];

  it('creates all billing support service files with required functions', () => {
    serviceFiles.forEach((path) => {
      const source = readProjectFile(path);

      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
      requiredFunctions[path].forEach((functionName) => {
        expect(source).toContain(functionName);
      });
    });
  });

  it('keeps service files read-only or pure calculation only', () => {
    const source = serviceFiles.map(readProjectFile).join('\n');

    expect(source).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    expect(source).not.toContain('.rpc(');
    expect(source).not.toMatch(/writeFile|createWriteStream|saveAs|download/i);

    forbiddenPostingTerms.forEach((term) => {
      expect(source).not.toContain(term);
    });
  });

  it('keeps service files free of disallowed billing and commercial terminology', () => {
    const source = serviceFiles.map(readProjectFile).join('\n');

    [
      'Sales Order',
      'sales order',
      'sales invoice',
      'sales revenue',
      'sales margin',
      'order fulfillment',
      'outbound_orders',
      'tgd_outbound_orders',
      'invoice generation',
      'billing finalization',
      'period locking',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
  });

  it('creates cold storage billing constants with operation charge examples', () => {
    const constantsPath = 'src/constants/coldStorageBilling.js';
    const source = readProjectFile(constantsPath);

    expect(statSync(resolve(projectRoot, constantsPath)).isFile()).toBe(true);
    [
      'OPERATION_CHARGE_TYPES',
      'BILLING_BASIS_TYPES',
      'STORAGE_CHARGE_BASIS',
      'BILLING_PREVIEW_STATUS',
      'SUPPORTED_BILLING_EXPORT_FORMATS',
      'LIFTING',
      'REPACK',
      'SORTING',
      'LABELING',
      'PALLETIZING',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('documents preview-only billing service foundation scope', () => {
    const docPath = 'docs/sprints/sprint-6c-prep-billing-services-foundation.md';
    const source = readProjectFile(docPath);

    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
    [
      'preview-only',
      'no invoice generation',
      'no billing engine',
      'no accounting posting',
      'no database schema change',
      'no export file generation',
      'Sprint 6C Customer Storage Balance Report',
      'Sprint 6F Monthly Storage Billing Summary Foundation',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('does not create database, policy, legacy, or Express sync artifacts for this sprint', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/023_cold_storage_billing_services.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/003_cold_storage_billing_services.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
  });
});
