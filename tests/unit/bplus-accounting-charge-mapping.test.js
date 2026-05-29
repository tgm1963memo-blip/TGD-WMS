import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  mapCanonicalRowToBplusDraft,
  mapCanonicalSummaryToBplusDraft,
  validateBplusMappingDraft,
} from '../../integrations/accounting-charge/mapping/bplusAccountingChargeMapping.js';
import {
  validateBplusAccountingChargeRow,
  validateBplusAccountingChargePayload,
  collectBplusMappingWarnings,
  classifyBplusMappingReadiness,
} from '../../integrations/accounting-charge/validation/bplusAccountingChargeValidator.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 7B Bplus accounting charge mapping foundation', () => {
  const mappingPath = 'integrations/accounting-charge/mapping/bplusAccountingChargeMapping.js';
  const validatorPath = 'integrations/accounting-charge/validation/bplusAccountingChargeValidator.js';
  const adapterPath = 'integrations/accounting-charge/adapters/bplusAdapter.placeholder.js';
  const docPath = 'docs/sprints/sprint-7b-bplus-accounting-charge-mapping.md';

  const sprintFiles = [
    mappingPath,
    validatorPath,
    adapterPath,
    docPath,
  ];

  it('verifies that Sprint 7B files exist', () => {
    sprintFiles.forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('defines the required Bplus mapping exports', () => {
    const source = readProjectFile(mappingPath);

    [
      'BPLUS_ACCOUNTING_CHARGE_TARGET_FIELDS',
      'BPLUS_ACCOUNTING_CHARGE_REQUIRED_FIELDS',
      'BPLUS_ACCOUNTING_CHARGE_OPTIONAL_FIELDS',
      'createBplusAccountingChargeMappingDraft',
      'mapCanonicalRowToBplusDraft',
      'mapCanonicalSummaryToBplusDraft',
      'validateBplusMappingDraft',
      'describeBplusAccountingChargeMapping',
    ].forEach((name) => {
      expect(source).toContain(name);
    });
  });

  it('defines the required Bplus validator exports', () => {
    const source = readProjectFile(validatorPath);

    [
      'validateBplusAccountingChargeRow',
      'validateBplusAccountingChargePayload',
      'collectBplusMappingWarnings',
      'classifyBplusMappingReadiness',
    ].forEach((name) => {
      expect(source).toContain(name);
    });
  });

  it('defines Bplus adapter supported modes and configuration validator exports', () => {
    const source = readProjectFile(adapterPath);

    [
      'BPLUS_ADAPTER_NAME',
      'createBplusAdapterPlaceholder',
      'describeBplusAccountingChargeMapping',
      'getBplusSupportedHandoffModes',
      'validateBplusAdapterConfiguration',
    ].forEach((name) => {
      expect(source).toContain(name);
    });
  });

  it('verifies mapping logic functions operate correctly and are pure', () => {
    const mockCanonicalRow = {
      customer_code: 'CUST001',
      customer_name: 'Customer A',
      billing_period: '2026-05',
      chargeable_qty: 100,
      chargeable_weight: 500,
      uom: 'KG',
      accounting_note: 'Storage for May',
      validation_status: 'READY_FOR_REVIEW',
    };

    const mappedRow = mapCanonicalRowToBplusDraft(mockCanonicalRow, { serviceCode: 'STOR_FEE' });
    expect(mappedRow.bplus_customer_code).toBe('CUST001');
    expect(mappedRow.bplus_service_code).toBe('STOR_FEE');
    expect(mappedRow.bplus_quantity).toBe(100);
    expect(mappedRow.bplus_weight).toBe(500);

    const mockCanonicalSummary = {
      customer_code: 'CUST002',
      customer_name: 'Customer B',
      billing_period: '2026-05',
      chargeable_qty: 0,
      chargeable_weight: 250,
      accounting_note: 'Summary for May',
      validation_status: 'READY_FOR_REVIEW',
    };

    const mappedSummary = mapCanonicalSummaryToBplusDraft(mockCanonicalSummary);
    expect(mappedSummary.bplus_customer_code).toBe('CUST002');
    expect(mappedSummary.bplus_service_code).toBe('STORAGE_SUMMARY');
    expect(mappedSummary.bplus_weight).toBe(250);

    const validationResult = validateBplusMappingDraft([mappedRow, mappedSummary]);
    expect(validationResult.valid).toBe(true);

    const invalidRow = { bplus_customer_code: '' };
    const invalidResult = validateBplusMappingDraft([invalidRow]);
    expect(invalidResult.valid).toBe(false);
  });

  it('verifies validator logic functions operate correctly and are pure', () => {
    const validRow = {
      bplus_customer_code: 'CUST001',
      bplus_billing_period: '2026-05',
      bplus_service_code: 'STOR',
      bplus_quantity: 10,
      bplus_weight: 50,
      bplus_accounting_note: 'Note',
      bplus_validation_status: 'READY_FOR_REVIEW',
    };

    expect(validateBplusAccountingChargeRow(validRow).valid).toBe(true);
    expect(validateBplusAccountingChargeRow({}).valid).toBe(false);

    const mockPayload = {
      billing_period: '2026-05',
      target_system: 'Bplus',
      rows: [validRow],
    };

    expect(validateBplusAccountingChargePayload(mockPayload).valid).toBe(true);
    expect(collectBplusMappingWarnings(mockPayload).length).toBe(0);
    expect(classifyBplusMappingReadiness(mockPayload)).toBe('READY_FOR_ACCOUNTING_REVIEW');

    const warningPayload = {
      billing_period: '2026-05',
      target_system: 'Bplus',
      rows: [{ ...validRow, bplus_quantity: 0, bplus_weight: 0, bplus_accounting_note: '' }],
    };
    expect(collectBplusMappingWarnings(warningPayload).length).toBe(2);
    expect(classifyBplusMappingReadiness(warningPayload)).toBe('MISSING_QUANTITY_OR_WEIGHT');
  });

  it('keeps Bplus adapter as placeholder only', () => {
    const bplusSource = readProjectFile(adapterPath);
    expect(bplusSource).toContain('placeholderOnly: true');
  });

  it('keeps Sprint 7B code strictly pure, offline, and safe', () => {
    const codeSource = [mappingPath, validatorPath, adapterPath]
      .map(readProjectFile)
      .join('\n');

    [
      'supabase',
      'fetch(',
      'axios',
      'XMLHttpRequest',
      'fs.writeFile',
      'writeFile',
      'endpoint',
      'apiKey',
      'secret',
      'password',
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
      expect(codeSource).not.toContain(term);
    });

    expect(codeSource).not.toMatch(/tgd_stock_balances\s+update/i);
  });

  it('verifies Sprint 7B files and docs contain no commercial/ERP sales order terminology', () => {
    const docSource = sprintFiles.map(readProjectFile).join('\n');

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
      expect(docSource).not.toContain(term);
    });

    expect(docSource).not.toMatch(/\bSO\b/);
  });

  it('does not create database, policy, legacy, or Express sync files', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/030_bplus_mapping.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/010_bplus_mapping.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'integrations/express/accounting-charge'))).toBe(false);
  });
});
