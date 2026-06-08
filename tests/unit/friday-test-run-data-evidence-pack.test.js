import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20E Friday Test Run Data and Evidence Pack', () => {
  it('1. 20E document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20E is documentation and test-only');
    expect(source).toContain('20E does not touch Production data');
    expect(source).toContain('20E does not authorize FINAL GO');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('3. Document contains fillable master data fields', () => {
    const source = readProjectFile(docPath);
    const masterDataFields = [
      'Customer ID',
      'Customer Name',
      'Product ID',
      'Product Code',
      'Product Name',
      'Lot No',
      'Warehouse',
      'Location',
      'Pallet',
      'UOM',
      'Barcode Alias',
      'Role / User',
    ];

    for (const field of masterDataFields) {
      expect(source).toContain(field);
    }
  });

  it('4. Document contains sample transaction data sections', () => {
    const source = readProjectFile(docPath);
    const transactionSections = [
      'Receiving Document',
      'Receiving Lines',
      'Putaway Document',
      'Transfer Document',
      'Adjustment Document',
      'Withdrawal Request',
      'Allocation',
      'Picking',
      'Dispatch',
      'Expected Stock Movement',
    ];

    for (const section of transactionSections) {
      expect(source).toContain(section);
    }
  });

  it('5. Document contains report evidence section', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Receiving Information preview result');
    expect(source).toContain('Receiving Information print result');
    expect(source).toContain('Delivery Slip preview result');
    expect(source).toContain('Delivery Slip print result');
    expect(source).toContain('Entry-Delivery Inventory Report preview result');
    expect(source).toContain('Entry-Delivery Inventory Report print result');
  });

  it('6. Document contains stock reconciliation evidence fields', () => {
    const source = readProjectFile(docPath);
    const reconciliationFields = [
      'Opening balance',
      'Receiving increase',
      'Putaway location movement',
      'Transfer movement',
      'Adjustment in/out',
      'Allocation reserved quantity',
      'Picking status',
      'Dispatch decrease',
      'Closing balance',
      'Variance',
      'Reconciliation status',
    ];

    for (const field of reconciliationFields) {
      expect(source).toContain(field);
    }
  });

  it('7. Document contains screenshot/evidence naming standard', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FTR-{scenario}-{module}-{YYYYMMDD}-{tester}.png');
  });

  it('8. Document contains defect reference standard', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('DEF-FTR-{running no}');
  });

  it('9. Document contains sign-off section roles', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Warehouse tester');
    expect(source).toContain('Operations tester');
    expect(source).toContain('Admin / manager');
    expect(source).toContain('IT / system owner');
    expect(source).toContain('Controller reviewer');
  });

  it('10. Document references 20C and 20D packs', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20C_FRIDAY_TEST_RUN_READINESS_PACK.md');
    expect(source).toContain('20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md');
    expect(source).toContain('Relationship to 20C and 20D');
  });
});
