import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 7A accounting charge plugin interface foundation', () => {
  const sprintFiles = [
    'integrations/accounting-charge/README.md',
    'integrations/accounting-charge/accountingChargePluginInterface.js',
    'integrations/accounting-charge/accountingChargeAdapterRegistry.js',
    'integrations/accounting-charge/validation/accountingChargePayloadValidator.js',
    'integrations/accounting-charge/mapping/accountingChargeCanonicalSchema.js',
    'integrations/accounting-charge/adapters/bplusAdapter.placeholder.js',
    'integrations/accounting-charge/adapters/inforM3Adapter.placeholder.js',
    'docs/sprints/sprint-7a-accounting-charge-plugin-interface.md',
  ];

  it('creates all Sprint 7A accounting charge plugin files', () => {
    sprintFiles.forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('defines the required plugin interface exports', () => {
    const source = readProjectFile('integrations/accounting-charge/accountingChargePluginInterface.js');

    [
      'ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES',
      'ACCOUNTING_CHARGE_HANDOFF_STATUS',
      'createAccountingChargePluginContract',
      'createAccountingChargeHandoffPayload',
      'normalizeAccountingChargePayload',
      'validateAccountingChargePlugin',
    ].forEach((name) => {
      expect(source).toContain(name);
    });
  });

  it('defines an in-memory adapter registry only', () => {
    const source = readProjectFile('integrations/accounting-charge/accountingChargeAdapterRegistry.js');

    [
      'createAccountingChargeAdapterRegistry',
      'registerAccountingChargeAdapter',
      'getAccountingChargeAdapter',
      'listAccountingChargeAdapters',
      'validateAccountingChargeAdapter',
      'new Map()',
    ].forEach((name) => {
      expect(source).toContain(name);
    });
  });

  it('defines payload validation and canonical schema helpers', () => {
    const validatorSource = readProjectFile('integrations/accounting-charge/validation/accountingChargePayloadValidator.js');
    const schemaSource = readProjectFile('integrations/accounting-charge/mapping/accountingChargeCanonicalSchema.js');

    [
      'validateAccountingChargePayload',
      'validateAccountingChargeRow',
      'validateBillingPeriod',
      'validateCustomerReference',
      'validateChargeSummaryAmounts',
      'collectAccountingChargeValidationWarnings',
    ].forEach((name) => {
      expect(validatorSource).toContain(name);
    });

    [
      'ACCOUNTING_CHARGE_CANONICAL_FIELDS',
      'ACCOUNTING_CHARGE_EXCLUDED_INVENTORY_FIELDS',
      'createCanonicalAccountingChargeRow',
      'createCanonicalAccountingChargeSummary',
      'describeAccountingChargeCanonicalSchema',
      'stock_movement_transaction',
      'inventory_adjustment',
      'location_movement',
      'pallet_movement',
      'picking_allocation',
    ].forEach((name) => {
      expect(schemaSource).toContain(name);
    });
  });

  it('creates placeholder-only Bplus and Infor ERP M3 adapters', () => {
    const bplusSource = readProjectFile('integrations/accounting-charge/adapters/bplusAdapter.placeholder.js');
    const inforSource = readProjectFile('integrations/accounting-charge/adapters/inforM3Adapter.placeholder.js');

    [
      'BPLUS_ADAPTER_NAME',
      'createBplusAdapterPlaceholder',
      'describeBplusAccountingChargeMapping',
      'placeholderOnly: true',
    ].forEach((name) => {
      expect(bplusSource).toContain(name);
    });

    [
      'INFOR_M3_ADAPTER_NAME',
      'createInforM3AdapterPlaceholder',
      'describeInforM3AccountingChargeMapping',
      'placeholderOnly: true',
    ].forEach((name) => {
      expect(inforSource).toContain(name);
    });
  });

  it('keeps Sprint 7A implementation files pure and disconnected', () => {
    const implementationSource = sprintFiles
      .filter((path) => path.endsWith('.js'))
      .map(readProjectFile)
      .join('\n');

    [
      'supabase',
      'fetch(',
      'axios',
      'XMLHttpRequest',
      'fs.writeFile',
      'writeFile',
      'createInvoice',
      'generateInvoice',
      'finalizeBilling',
      'lockBillingPeriod',
      'postAccounting',
      'syncInventory',
      'inventorySync',
      'stockImport',
      'stockExport',
      'exportStockMovement',
      'tgd_post_inventory_movement',
    ].forEach((term) => {
      expect(implementationSource).not.toContain(term);
    });

    expect(implementationSource).not.toMatch(/tgd_stock_balances\s+update/i);
  });

  it('keeps Sprint 7A docs and implementation free of disallowed commercial terminology', () => {
    const source = sprintFiles.map(readProjectFile).join('\n');

    [
      'Sales Order',
      'sales order',
      'sales invoice',
      'sales revenue',
      'sales margin',
      'order fulfillment',
      'outbound_orders',
      'tgd_outbound_orders',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
  });

  it('does not create database, policy, legacy, Express, or live connector artifacts', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/029_accounting_charge_plugin_interface.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/009_accounting_charge_plugin_interface.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'integrations/express/accounting-charge'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'integrations/accounting-charge/adapters/bplusAdapter.js'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'integrations/accounting-charge/adapters/inforM3Adapter.js'))).toBe(false);
  });
});
