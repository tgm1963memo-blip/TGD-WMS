import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23B Controlled Receiving Create UI Implementation', () => {
  it('should verify document exists and contains required technical implementation details', () => {
    const docPath = path.resolve(__dirname, '../../docs/23B_CONTROLLED_RECEIVING_CREATE_UI_IMPLEMENTATION.md');
    
    // verify document exists
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf-8');

    // includes service/RPC usage
    expect(docContent).toContain('tgd_rpc_create_receiving_draft');
    expect(docContent).toContain('tgd_rpc_add_receiving_line');
    expect(docContent).toContain('tgd_rpc_post_receiving_document');

    // includes no direct stock balance update
    expect(docContent).toContain('No direct `INSERT` or `UPDATE` statements to the stock balance');

    // includes draft no stock rule
    expect(docContent).toContain('Draft Does Not Affect Stock');

    // includes post creates movement ledger
    expect(docContent).toContain('Post Creates Movement Ledger');

    // includes posted read-only rule
    expect(docContent).toContain('Posted Read-Only Rule');

    // includes Playwright retest command
    expect(docContent).toContain('npx playwright test "tests/e2e/transaction-uat-round-1.spec.js"');

    // includes Production HOLD
    expect(docContent).toContain('**Production remains HOLD.**');

    // includes FINAL GO is NOT AUTHORIZED
    expect(docContent).toContain('**FINAL GO is NOT AUTHORIZED.**');

    // does not imply Go Live approval
    expect(docContent).not.toContain('Go Live is **AUTHORIZED**');
    expect(docContent).not.toContain('FINAL GO is **AUTHORIZED**');
  });

  it('should verify no direct stock balance update exists in the receiving UI code', () => {
    const createPagePath = path.resolve(__dirname, '../../src/features/operations/receiving/ReceivingCreatePage.jsx');
    const createPageContent = fs.readFileSync(createPagePath, 'utf-8');

    // UI should not contain supabase.from('tgd_stock_balances') or similar direct writes
    expect(createPageContent).not.toMatch(/from\(['"`]tgd_stock_balances['"`]\)/i);
    expect(createPageContent).not.toMatch(/from\(['"`]tgd_stock_movements['"`]\)/i);

    // UI should import and use receivingService methods
    expect(createPageContent).toContain('createReceivingDocument');
    expect(createPageContent).toContain('addReceivingLine');
    expect(createPageContent).toContain('postReceivingDocument');
  });
});
