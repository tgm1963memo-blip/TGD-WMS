import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20C_FRIDAY_TEST_RUN_READINESS_PACK.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20C Friday Test Run Readiness Pack', () => {
  it('1. 20C document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20C is documentation and test-only');
    expect(source).toContain('20C does not touch Production data');
    expect(source).toContain('20C does not authorize FINAL GO');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('3. Document contains Friday test run scope modules', () => {
    const source = readProjectFile(docPath);
    const scopeModules = [
      'Login / Role',
      'Master Data',
      'Receiving',
      'Putaway',
      'Transfer',
      'Adjustment',
      'Withdrawal Request',
      'Allocation',
      'Picking',
      'Dispatch',
      'Barcode Receiving / Putaway',
      'Stock Balance',
      'Receiving Information Report',
      'Delivery Slip Report',
      'Entry-Delivery Inventory Report',
    ];

    for (const moduleName of scopeModules) {
      expect(source).toContain(moduleName);
    }
  });

  it('4. Document contains required test data sections', () => {
    const source = readProjectFile(docPath);
    const testDataSections = [
      'Customer',
      'Product',
      'Lot',
      'Warehouse',
      'Location',
      'Pallet',
      'User Roles',
      'Barcode Aliases',
      'Sample Receiving Document',
      'Sample Dispatch Document',
    ];

    for (const section of testDataSections) {
      expect(source).toContain(section);
    }
  });

  it('5. Document contains pass/fail evidence format fields', () => {
    const source = readProjectFile(docPath);
    const evidenceFields = [
      'Scenario ID',
      'Tester',
      'Date/Time',
      'Input Document',
      'Expected Result',
      'Actual Result',
      'Screenshot/Evidence',
      'Defect ID',
      'Status',
    ];

    for (const field of evidenceFields) {
      expect(source).toContain(field);
    }
  });

  it('6. Document contains defect severity levels', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Critical');
    expect(source).toContain('High');
    expect(source).toContain('Medium');
    expect(source).toContain('Low');
  });

  it('7. Document contains Friday go/no-go rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Friday Go / No-Go Rules');
    expect(source).toContain('Critical = 0');
    expect(source).toContain('workaround');
    expect(source).toContain('must preview and print');
    expect(source).toContain('Stock balance must reconcile');
    expect(source).toContain('No direct DB edits during UAT');
  });

  it('8. Document references operational report preview and print', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Receiving Information');
    expect(source).toContain('Delivery Slip');
    expect(source).toContain('Entry-Delivery Inventory Report');
    expect(source).toContain('Preview / Print');
  });
});
