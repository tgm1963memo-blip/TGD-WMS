import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20D Friday Test Run Execution Control', () => {
  it('1. 20D document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20D is documentation and test-only');
    expect(source).toContain('20D does not touch Production data');
    expect(source).toContain('20D does not authorize FINAL GO');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('3. Document contains Friday execution schedule', () => {
    const source = readProjectFile(docPath);
    const scheduleBlocks = [
      '08:30',
      '09:00',
      '09:30',
      '10:00',
      '10:45',
      '11:30',
      '13:00',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
      '16:30',
      'Environment check',
      'Login / role check',
      'Master data check',
      'Receiving',
      'Putaway',
      'Transfer / Adjustment',
      'Withdrawal Request',
      'Allocation',
      'Picking',
      'Dispatch',
      'Reports preview/print',
      'Stock balance reconciliation',
      'Defect review',
      'Controller decision',
    ];

    for (const block of scheduleBlocks) {
      expect(source).toContain(block);
    }
  });

  it('4. Document contains tester assignment table fields', () => {
    const source = readProjectFile(docPath);
    const assignmentFields = [
      'Scenario ID',
      'Module',
      'Owner',
      'Tester',
      'Backup Tester',
      'Status',
      'Evidence Link',
      'Defect ID',
    ];

    for (const field of assignmentFields) {
      expect(source).toContain(field);
    }
  });

  it('5. Document contains test data execution sheet fields', () => {
    const source = readProjectFile(docPath);
    const executionSheetFields = [
      'Customer',
      'Product',
      'Lot',
      'Warehouse',
      'Location',
      'Pallet',
      'Barcode Alias',
      'Receiving Document',
      'Dispatch Document',
      'Expected Qty Movement',
    ];

    for (const field of executionSheetFields) {
      expect(source).toContain(field);
    }
  });

  it('6. Document contains defect log template fields', () => {
    const source = readProjectFile(docPath);
    const defectFields = [
      'Defect ID',
      'Severity',
      'Scenario ID',
      'Module',
      'Issue',
      'Expected',
      'Actual',
      'Screenshot/Evidence',
      'Owner',
      'Target Fix Time',
      'Status',
    ];

    for (const field of defectFields) {
      expect(source).toContain(field);
    }
  });

  it('7. Document contains stop rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Stop Rules');
    expect(source).toContain('Stock balance mismatch');
    expect(source).toContain('Report cannot preview/print');
    expect(source).toContain('Receiving/dispatch cannot complete');
    expect(source).toContain('Role permission failure');
    expect(source).toContain('Data corruption risk');
    expect(source).toContain('Any Critical defect');
  });

  it('8. Document contains end-of-day decision options', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('End-of-Day Decision');
    expect(source).toContain('PASS');
    expect(source).toContain('PASS WITH WORKAROUND');
    expect(source).toContain('HOLD');
    expect(source).toContain('FAIL');
  });

  it('9. Document references 20C readiness pack', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20C_FRIDAY_TEST_RUN_READINESS_PACK.md');
    expect(source).toContain('Relationship to 20C');
  });
});
