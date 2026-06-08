import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20M_FRIDAY_TEST_RUN_ENVIRONMENT_FILL_IN_GUARD.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20M Friday Test Run Environment Fill-In Guard', () => {
  it('1. 20M document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20M is documentation and test-only');
    expect(source).toContain('This document does not authorize Production Go Live');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('Friday test run is controlled UAT only');
    expect(source).toContain('No direct database edits are allowed');
    expect(source).toContain('No uncontrolled Production stock movement is allowed');
  });

  it('3. Document contains fill-in guard checklist fields', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Fill-In Guard Checklist');
    const fields = [
      'Environment URL',
      'Vercel Deployment URL',
      'Supabase Project Reference',
      'Supabase Anon Key Confirmation',
      'Test Date/Time',
      'Evidence Folder Link',
      'Defect Log Link',
      'Controller Reviewer',
      'IT / System Owner',
      'Warehouse Owner',
      'Operations Owner',
    ];

    for (const field of fields) {
      expect(source).toContain(field);
    }
  });

  it('4. Document contains user readiness checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('User Readiness Checklist');
    expect(source).toContain('Admin');
    expect(source).toContain('Warehouse User');
    expect(source).toContain('Operations User');
    expect(source).toContain('Viewer / Read-Only User');
    expect(source).toContain('Permission Expected Result');
    expect(source).toContain('Login Evidence Link');
    expect(source).toContain('Status');
  });

  it('5. Document contains master data readiness checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Master Data Readiness Checklist');
    const fields = [
      'Customer',
      'Product',
      'Lot',
      'Warehouse',
      'Location',
      'Pallet',
      'UOM',
      'Barcode Alias',
      'Opening Stock Balance',
      'Status',
    ];

    for (const field of fields) {
      expect(source).toContain(field);
    }
  });

  it('6. Document contains transaction readiness checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Transaction Readiness Checklist');
    const items = [
      'Sample Receiving Document',
      'Sample Putaway Document',
      'Sample Transfer Document',
      'Sample Adjustment Document',
      'Sample Withdrawal Request',
      'Sample Allocation',
      'Sample Picking',
      'Sample Dispatch',
      'Expected Stock Movement',
      'Expected Closing Balance',
    ];

    for (const item of items) {
      expect(source).toContain(item);
    }
  });

  it('7. Document contains report readiness checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Report Readiness Checklist');
    expect(source).toContain('Receiving Information preview');
    expect(source).toContain('Receiving Information print/PDF');
    expect(source).toContain('Delivery Slip preview');
    expect(source).toContain('Delivery Slip print/PDF');
    expect(source).toContain('Entry-Delivery Inventory Report preview');
    expect(source).toContain('Entry-Delivery Inventory Report print/PDF');
  });

  it('8. Document contains start-blocking rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Start-Blocking Rules');
    expect(source).toContain('Missing environment URL');
    expect(source).toContain('Login not verified');
    expect(source).toContain('Missing master data');
    expect(source).toContain('Missing opening balance');
    expect(source).toContain('Missing evidence folder');
    expect(source).toContain('Missing defect log');
    expect(source).toContain('Report preview not verified');
    expect(source).toContain('Any Critical issue');
  });

  it('9. Document contains final controller fill-in decision options', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Final Controller Fill-In Decision');
    expect(source).toContain('READY TO START FRIDAY TEST RUN');
    expect(source).toContain('READY WITH CONDITIONS');
    expect(source).toContain('HOLD');
    expect(source).toContain('NOT READY');
  });

  it('10. Document references 20J and 20L packs', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md');
    expect(source).toContain('20L_FINAL_FRIDAY_RUN_COMMAND_PACK.md');
    expect(source).toContain('Relationship to 20C through 20L');
  });
});
