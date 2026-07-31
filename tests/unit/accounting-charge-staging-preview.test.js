import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as previewService from '../../src/services/accountingChargeStagingPreviewService.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 7C: Accounting Charge Summary Staging Preview', () => {
  const servicePath = 'src/services/accountingChargeStagingPreviewService.js';
  const pagePath = 'src/features/reports/AccountingChargeStagingPreviewPage.jsx';
  const routesPath = 'src/app/routes.jsx';
  const reportsPagePath = 'src/features/reports/ReportsPage.jsx';

  const sprintFiles = [
    servicePath,
    pagePath,
    routesPath,
    reportsPagePath,
  ];

  it('verifies that Sprint 7C files exist', () => {
    sprintFiles.forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('defines all required service functions', () => {
    expect(typeof previewService.getAccountingChargeStagingPreview).toBe('function');
    expect(typeof previewService.buildCanonicalChargePayloadFromBillingSummary).toBe('function');
    expect(typeof previewService.buildBplusDraftPayloadPreview).toBe('function');
    expect(typeof previewService.validateAccountingChargeStagingPayload).toBe('function');
    expect(typeof previewService.summarizeAccountingChargeStagingRows).toBe('function');
    expect(typeof previewService.groupAccountingChargeWarnings).toBe('function');
    expect(typeof previewService.classifyStagingReadiness).toBe('function');
  });

  it('verifies backing service functions execute correct mapping and validation in-memory', () => {
    const mockSummaryRows = [
      {
        customer_id: 'CUST101',
        customer_name: 'Alpha Customer',
        warehouse_id: 'WH-COLD-A',
        deposit_qty: 120,
        withdrawal_qty: 40,
        remaining_qty: 80,
        chargeable_weight: 450.5,
        storage_charge_preview: 901.0,
        operation_charge_preview: 150.0,
        total_preview_amount: 1051.0,
        validation_status: 'READY_FOR_REVIEW',
        accounting_note: 'Validated row'
      }
    ];

    const options = {
      billingPeriod: '2026-05',
      targetSystem: 'Bplus',
      serviceCode: 'STORAGE',
      serviceDescription: 'Cold storage fee',
      unit: 'KG'
    };

    // 1. Build Canonical Payload
    const canonicalPayload = previewService.buildCanonicalChargePayloadFromBillingSummary(mockSummaryRows, options);
    expect(canonicalPayload.billing_period).toBe('2026-05');
    expect(canonicalPayload.target_system).toBe('Bplus');
    expect(canonicalPayload.rows.length).toBe(1);
    expect(canonicalPayload.rows[0].customer_code).toBe('CUST101');
    expect(canonicalPayload.rows[0].customer_name).toBe('Alpha Customer');
    // chargeable_qty has no source in a billing summary row (only
    // chargeable_weight does) -- it must NOT fall back to the Baht
    // total_preview_amount (see accountingChargeStagingPreviewService.js).
    expect(canonicalPayload.rows[0].chargeable_qty).toBe(0);

    // 2. Build Bplus Draft
    const bplusPayload = previewService.buildBplusDraftPayloadPreview(canonicalPayload, options);
    expect(bplusPayload.billing_period).toBe('2026-05');
    expect(bplusPayload.rows.length).toBe(1);
    expect(bplusPayload.rows[0].bplus_customer_code).toBe('CUST101');
    expect(bplusPayload.rows[0].bplus_service_code).toBe('STORAGE');
    expect(bplusPayload.rows[0].bplus_quantity).toBe(0);
    expect(bplusPayload.rows[0].bplus_weight).toBe(450.5); // matches mockSummaryRows chargeable_weight

    // 3. Validate
    const validation = previewService.validateAccountingChargeStagingPayload(bplusPayload, options);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);

    // 4. Summarize
    const summary = previewService.summarizeAccountingChargeStagingRows(bplusPayload.rows);
    expect(summary.total_staging_rows).toBe(1);
    expect(summary.ready_rows).toBe(1);
    expect(summary.warning_rows).toBe(0);

    // 5. Readiness Status
    const readiness = previewService.classifyStagingReadiness(bplusPayload);
    expect(readiness).toBe('READY_FOR_ACCOUNTING_REVIEW');
  });

  it('asserts that route is correctly registered in routes.jsx', () => {
    const routesContent = readProjectFile(routesPath);
    expect(routesContent).toContain('/reports/accounting-charge-staging-preview');
    expect(routesContent).toContain('AccountingChargeStagingPreviewPage');
  });

  it('asserts that ReportsPage links to the staging preview page', () => {
    const reportsPageContent = readProjectFile(reportsPagePath);
    expect(reportsPageContent).toContain('/reports/accounting-charge-staging-preview');
    expect(reportsPageContent).toContain('Accounting Charge Staging Preview');
  });

  it('asserts that no active button or control labels exist in the UI page', () => {
    const pageContent = readProjectFile(pagePath);

    // Forbidden active control labels (case-insensitive check)
    const activeTerms = ['Send', 'Export', 'Generate', 'Finalize', 'Lock', 'Post'];
    
    // We parse the file and inspect any buttons/controls
    // Buttons are typically defined with <button ...>Label</button>
    // We check that none of the labels inside UI actions contains active verbs
    // Ensure that none of the button labels in the page contain these terms
    const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/g;
    let match;
    const buttonLabels = [];
    while ((match = buttonRegex.exec(pageContent)) !== null) {
      buttonLabels.push(match[1].trim());
    }

    buttonLabels.forEach(label => {
      activeTerms.forEach(term => {
        // Assert button labels do not contain the active words
        expect(label.toLowerCase()).not.toContain(term.toLowerCase());
      });
    });

    // Check allowed read-only/preview labels are present
    const allowedTerms = ['Preview', 'Review', 'Inspect', 'Validate', 'View Mapping'];
    let foundAllowed = false;
    allowedTerms.forEach(term => {
      if (pageContent.toLowerCase().includes(term.toLowerCase())) {
        foundAllowed = true;
      }
    });
    expect(foundAllowed).toBe(true);
  });

  it('asserts that the Bplus Draft Mapping Preview has no button or handler for file export or handoff', () => {
    const tablePath = 'src/components/reports/BplusDraftPayloadTable.jsx';
    const tableContent = readProjectFile(tablePath);

    // Ensure absolutely no handlers like click/change exist for file write or handoffs, nor export keywords in controls
    const forbiddenToggles = ['click', 'onClick', 'download', 'csv', 'excel', 'pdf', 'xlsx'];
    forbiddenToggles.forEach(toggle => {
      // It should only render the DataTable. The only onClick might be tab changes or unrelated inside tables, but let's confirm the table has no interactive triggers.
      // The table renders DataTable with columns. Ensure no buttons exist in BplusDraftPayloadTable itself.
      expect(tableContent).not.toContain(`<button`);
      expect(tableContent).not.toContain(`onClick`);
    });
  });

  it('keeps Sprint 7C code strictly pure, offline, and safe', () => {
    const serviceSource = readProjectFile(servicePath);
    const pageSource = readProjectFile(pagePath);
    const combinedSource = serviceSource + '\n' + pageSource;

    // Use dynamic array joins to check for forbidden terms to avoid matching this test file
    const termsToCheck = [
      ['fe', 'tch'].join(''),
      ['ax', 'ios'].join(''),
      ['XML', 'Http', 'Request'].join(''),
      ['fs', '.', 'write', 'File'].join(''),
      ['write', 'File'].join(''),
      ['end', 'point'].join(''),
      ['api', 'Key'].join(''),
      ['se', 'cret'].join(''),
      ['pass', 'word'].join(''),
      ['create', 'Invoice'].join(''),
      ['generate', 'Invoice'].join(''),
      ['finalize', 'Billing'].join(''),
      ['lock', 'Billing', 'Period'].join(''),
      ['post', 'Accounting'].join(''),
      ['send', 'To', 'Bplus'].join(''),
      ['send', 'To', 'ERP'].join(''),
      ['sync', 'Inventory'].join(''),
      ['inventory', 'Sync'].join(''),
      ['stock', 'Import'].join(''),
      ['stock', 'Export'].join(''),
      ['export', 'Stock', 'Movement'].join(''),
      ['tgd', '_', 'post', '_', 'inventory', '_', 'movement'].join(''),
    ];

    termsToCheck.forEach((term) => {
      expect(combinedSource).not.toContain(term);
    });

    expect(combinedSource).not.toMatch(/tgd_stock_balances\s+update/i);
  });

  it('verifies Sprint 7C files and docs contain no commercial/ERP sales order terminology', () => {
    const serviceSource = readProjectFile(servicePath);
    const pageSource = readProjectFile(pagePath);
    const textData = serviceSource + '\n' + pageSource;

    const forbiddenCommercial = [
      ['Sales', 'Order'].join(' '),
      ['sales', 'order'].join(' '),
      ['sales', 'invoice'].join(' '),
      ['sales', 'revenue'].join(' '),
      ['sales', 'margin'].join(' '),
      ['order', 'fulfillment'].join(' '),
      ['outbound', 'orders'].join('_'),
      ['tgd', 'outbound', 'orders'].join('_'),
    ];

    forbiddenCommercial.forEach((term) => {
      expect(textData).not.toContain(term);
    });

    expect(textData).not.toMatch(/\bSO\b/);
  });

  it('does not touch database migrations, policies, legacy, or integrations/express', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/031_sprint_7c.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/011_sprint_7c.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'integrations/express/accounting-charge-preview'))).toBe(false);
  });
});
