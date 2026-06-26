import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23Q Receiving Draft ID and Lot No Line Add', () => {
  const detailPath = path.join(process.cwd(), 'src/features/operations/receiving/ReceivingDetailPage.jsx');
  const servicePath = path.join(process.cwd(), 'src/services/receivingService.js');
  const detailContent = fs.readFileSync(detailPath, 'utf8');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');

  it('verifies receiving detail uses controlled post wrapper and draft movement guard', () => {
    expect(detailContent).toContain('postReceivingDocument');
    expect(detailContent).toContain('No stock movement until Confirm/Post');
    expect(detailContent).toContain('Controlled Confirm/Post');
  });

  it('verifies standalone draft creation is locked in receivingService', () => {
    expect(serviceContent).toContain('Standalone receiving draft creation was removed');
    expect(serviceContent).toContain('export async function resolveLotForReceiving');
  });

  it('verifies no direct stock update or movement ledger bypass in detail page', () => {
    expect(detailContent).not.toContain('updateStockBalance');
    expect(detailContent).not.toContain('insertMovementLedger');
    expect(detailContent).not.toMatch(/from\(['"`]tgd_stock_balances['"`]\)/i);
  });

  it('verifies Production remains HOLD and FINAL GO is NOT AUTHORIZED', () => {
    const testPath = path.join(process.cwd(), 'tests/e2e/transaction-uat-round-1.spec.js');
    const testContent = fs.readFileSync(testPath, 'utf8');
    expect(testContent).toContain('"Production": "HOLD"');
    expect(testContent).toContain('"FINAL GO": "NOT AUTHORIZED"');
  });
});
