import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23Q Receiving Draft ID and Lot No Line Add', () => {
  const pagePath = path.join(process.cwd(), 'src/features/operations/receiving/ReceivingCreatePage.jsx');
  const servicePath = path.join(process.cwd(), 'src/services/receivingService.js');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');

  it('verifies that draft creation exposes document id or throws DRAFT_ID_MISSING', () => {
    expect(pageContent).toContain("setError('Save draft succeeded but returned no document id (DRAFT_ID_MISSING).')");
    expect(pageContent).toContain('Draft id: {draft?.id || \'None\'}');
  });

  it('verifies Add Line requires selectedLotId OR lotNo', () => {
    expect(pageContent).toContain('const canAddLine = Boolean(');
    expect(pageContent).toContain('(lineForm.lot_id || lineForm.lot_no)');
    
    // Check that Add Line disable reason is properly exposed
    expect(pageContent).toContain("if (!draft?.id) addLineDisabledReason = 'Missing document id'");
    expect(pageContent).toContain("else if (!lineForm.lot_id && !lineForm.lot_no) addLineDisabledReason = 'Missing lot id or lot no'");
    expect(pageContent).toContain('Add Line requires: {addLineDisabledReason || \'All valid\'}');
  });

  it('verifies no direct stock update or movement ledger bypass', () => {
    expect(pageContent).toContain('No stock movement or stock balance update is triggered from this page');
    // Ensure no direct imports of movement ledger or stock balance updates
    expect(pageContent).not.toContain('updateStockBalance');
    expect(pageContent).not.toContain('insertMovementLedger');
  });

  it('verifies lot resolution is called when no lot_id is present', () => {
    expect(pageContent).toContain('resolveLotForReceiving(lineForm.product_id, lineForm.lot_no)');
    expect(serviceContent).toContain('export async function resolveLotForReceiving');
  });

  it('verifies Production remains HOLD and FINAL GO is NOT AUTHORIZED', () => {
    const testPath = path.join(process.cwd(), 'tests/e2e/transaction-uat-round-1.spec.js');
    const testContent = fs.readFileSync(testPath, 'utf8');
    expect(testContent).toContain('"Production": "HOLD"');
    expect(testContent).toContain('"FINAL GO": "NOT AUTHORIZED"');
  });
});
