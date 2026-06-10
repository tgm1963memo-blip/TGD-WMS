import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22P Transaction UAT Blocker: Receiving UI Not Operational', () => {
  it('should verify document exists and contains required facts and blocker rules', () => {
    const docPath = path.resolve(__dirname, '../../docs/22P_TRANSACTION_UAT_BLOCKER_RECEIVING_UI_NOT_OPERATIONAL.md');
    
    // verify document exists
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf-8');

    // includes Receiving UI blocked
    expect(docContent).toContain('Receiving UI Not Operational');

    // includes missing create/new/add button
    expect(docContent).toContain('Missing create/new/add button');

    // includes missing product input/select
    expect(docContent).toContain('Missing product input/select');

    // includes missing save/post/confirm button
    expect(docContent).toContain('Missing save/post/confirm button');

    // includes ledger/balance blocked due to no posted transaction
    expect(docContent).toContain('**Ledger/balance checks:** BLOCKED (Due to no posted transaction)');
    
    // alternatively, verify the core facts
    expect(docContent).toContain('Due to no posted transaction');

    // includes Adjustment blocked due to missing tgd_reason_codes
    expect(docContent).toContain('tgd_reason_codes');

    // includes HOLD FOR RECEIVING UI IMPLEMENTATION
    expect(docContent).toContain('HOLD FOR RECEIVING UI IMPLEMENTATION');

    // includes Production HOLD
    expect(docContent).toContain('Production:** HOLD');

    // includes FINAL GO is NOT AUTHORIZED
    expect(docContent).toContain('FINAL GO:** NOT AUTHORIZED');

    // does not imply Go Live approval
    expect(docContent).not.toContain('Go Live is **AUTHORIZED**');
    expect(docContent).not.toContain('FINAL GO is **AUTHORIZED**');
  });
});
