import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20J Friday Test Run Fill-In Templates', () => {
  it('1. 20J document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20J is documentation and test-only');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
    expect(source).toContain('No direct database edits are allowed');
    expect(source).toContain('Friday test run is controlled UAT only');
  });

  it('3. Template 1 contains environment and owner setup fields', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Template 1');
    expect(source).toContain('Environment and Owner Setup');
    const fields = [
      'Environment URL',
      'Vercel Deployment URL',
      'Supabase Project',
      'Test Date',
      'Test Coordinator',
      'Warehouse Owner',
      'Operations Owner',
      'IT / System Owner',
      'Controller Reviewer',
      'Evidence Folder Link',
      'Defect Log Link',
    ];

    for (const field of fields) {
      expect(source).toContain(field);
    }
  });

  it('4. Template 2 contains user and role setup fields', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Template 2');
    expect(source).toContain('User and Role Setup');
    const fields = [
      'User ID / Email',
      'Display Name',
      'Role',
      'Module Access',
      'Login Result',
      'Tester',
      'Evidence Link',
      'Status',
    ];

    for (const field of fields) {
      expect(source).toContain(field);
    }
  });

  it('5. Template 3 contains master data setup fields', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Template 3');
    expect(source).toContain('Master Data Setup');
    const fields = [
      'Customer ID/Name',
      'Product ID/Code/Name',
      'Lot No',
      'Warehouse',
      'Location',
      'Pallet',
      'UOM',
      'Barcode Alias',
      'Opening Qty',
      'Status',
    ];

    for (const field of fields) {
      expect(source).toContain(field);
    }
  });

  it('6. Template 4 contains transaction execution sheet fields', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Template 4');
    expect(source).toContain('Transaction Execution Sheet');
    const fields = [
      'Scenario ID',
      'Module',
      'Document No',
      'Input Qty',
      'Expected Movement',
      'Expected Balance',
      'Actual Result',
      'Screenshot/Evidence',
      'Defect ID',
      'Status',
    ];

    for (const field of fields) {
      expect(source).toContain(field);
    }
  });

  it('7. Template 5 contains report print evidence for all three reports', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Template 5');
    expect(source).toContain('Report Print Evidence Sheet');
    expect(source).toContain('Receiving Information');
    expect(source).toContain('Delivery Slip');
    expect(source).toContain('Entry-Delivery Inventory Report');
    const fields = [
      'Report Name',
      'Source Document',
      'Preview Result',
      'Print Result',
      'PDF/Save Result',
      'Tester',
      'Evidence Link',
      'Defect ID',
      'Status',
    ];

    for (const field of fields) {
      expect(source).toContain(field);
    }
  });

  it('8. Template 6 contains stock reconciliation sheet fields', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Template 6');
    expect(source).toContain('Stock Reconciliation Sheet');
    const fields = [
      'Opening Balance',
      'Receiving Increase',
      'Putaway Movement',
      'Transfer Movement',
      'Adjustment IN',
      'Adjustment OUT',
      'Allocation Reserved Qty',
      'Dispatch Decrease',
      'Expected Closing Balance',
      'Actual Closing Balance',
      'Variance',
      'Reconciliation Status',
    ];

    for (const field of fields) {
      expect(source).toContain(field);
    }
  });

  it('9. Document contains final controller sign-off template', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Final Controller Sign-Off Template');
    expect(source).toContain('READY TO START TEST RUN');
    expect(source).toContain('READY WITH CONDITIONS');
    expect(source).toContain('HOLD');
    expect(source).toContain('NOT READY');
    expect(source).toContain('Remarks');
    expect(source).toContain('Controller Name');
    expect(source).toContain('Date/Time');
  });

  it('10. Document references 20C through 20I packs', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20C_FRIDAY_TEST_RUN_READINESS_PACK.md');
    expect(source).toContain('20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md');
    expect(source).toContain('20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md');
    expect(source).toContain('20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md');
    expect(source).toContain('20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md');
    expect(source).toContain('20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md');
    expect(source).toContain('20I_FINAL_PRE_TEST_RUN_CONTROLLER_REVIEW.md');
  });
});
