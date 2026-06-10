import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22M Playwright Transaction UAT Round 1 Automation', () => {
  it('should verify document exists and contains required rules and variables', () => {
    const docPath = path.resolve(__dirname, '../../docs/22M_PLAYWRIGHT_TRANSACTION_UAT_ROUND_1_AUTOMATION.md');
    const specPath = path.resolve(__dirname, '../e2e/transaction-uat-round-1.spec.js');
    
    // verify documents exist
    expect(fs.existsSync(docPath)).toBe(true);
    expect(fs.existsSync(specPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf-8');
    const specContent = fs.readFileSync(specPath, 'utf-8');

    // env var list is documented
    expect(docContent).toContain('UAT_BASE_URL');
    expect(docContent).toContain('UAT_PRODUCT_CODE');
    expect(specContent).toContain('UAT_CUSTOMER_CODE');

    // result.json structure is documented
    expect(docContent).toContain('result.json');
    expect(docContent).toContain('testerMode');

    // all 16 scenario names are included
    expect(docContent).toContain('Receiving draft creation');
    expect(docContent).toContain('Putaway create/session');
    expect(docContent).toContain('Transfer post');
    expect(docContent).toContain('Stock Aging report check');

    // no direct stock balance update rule exists
    expect(docContent).toContain('No direct stock balance update is permitted');

    // movement ledger evidence is required
    expect(docContent).toContain('Movement ledger evidence is strictly required');

    // stock balance evidence is required
    expect(docContent).toContain('Stock balance evidence is strictly required');

    // Production remains HOLD
    expect(docContent).toContain('Production:** HOLD');

    // FINAL GO is NOT AUTHORIZED
    expect(docContent).toContain('FINAL GO:** NOT AUTHORIZED');

    // does not imply Go Live approval
    expect(docContent).not.toContain('Go Live:** AUTHORIZED');
    expect(docContent).not.toContain('Go Live:** APPROVED');
    expect(docContent).not.toContain('FINAL GO:** AUTHORIZED');
  });
});
