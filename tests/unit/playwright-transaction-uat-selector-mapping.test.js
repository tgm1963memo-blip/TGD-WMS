import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22N Playwright Transaction UAT Selector Mapping', () => {
  it('should verify document exists and contains required rules and scope', () => {
    const docPath = path.resolve(__dirname, '../../docs/22N_PLAYWRIGHT_TRANSACTION_UAT_SELECTOR_MAPPING.md');
    
    // verify document exists
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf-8');

    // Receiving-only scope is stated
    expect(docContent).toContain('restricted strictly to the **Receiving** module');

    // no direct DB write rule exists
    expect(docContent).toContain('**No Direct DB Writes:**');

    // missing selectors must be BLOCKED not PASS
    expect(docContent).toContain('Missing Selectors = BLOCKED');

    // movement ledger evidence required
    expect(docContent).toContain('Movement Ledger Evidence:** Verification of stock movement against the movement ledger UI is strictly required');

    // stock balance evidence required
    expect(docContent).toContain('Stock Balance Evidence:** Verification of stock balance against the stock balance UI is strictly required');

    // Production remains HOLD
    expect(docContent).toContain('Production remains **HOLD**');

    // FINAL GO is NOT AUTHORIZED
    expect(docContent).toContain('FINAL GO is **NOT AUTHORIZED**');

    // does not imply Go Live approval
    expect(docContent).not.toContain('Go Live is **AUTHORIZED**');
    expect(docContent).not.toContain('Go Live is **APPROVED**');
    expect(docContent).not.toContain('FINAL GO is **AUTHORIZED**');
  });
});
