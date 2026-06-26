import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const detailPagePath = path.resolve(__dirname, '../../src/features/operations/receiving/ReceivingDetailPage.jsx');
const servicePath = path.resolve(__dirname, '../../src/services/receivingService.js');

describe('23B Controlled Receiving Create UI Implementation', () => {
  it('should verify document exists and contains required technical implementation details', () => {
    const docPath = path.resolve(__dirname, '../../docs/23B_CONTROLLED_RECEIVING_CREATE_UI_IMPLEMENTATION.md');
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf-8');
    expect(docContent).toContain('tgd_rpc_create_receiving_draft');
    expect(docContent).toContain('tgd_rpc_add_receiving_line');
    expect(docContent).toContain('tgd_rpc_post_receiving_document');
    expect(docContent).toContain('No direct `INSERT` or `UPDATE` statements to the stock balance');
    expect(docContent).toContain('Draft Does Not Affect Stock');
    expect(docContent).toContain('Post Creates Movement Ledger');
    expect(docContent).toContain('Posted Read-Only Rule');
    expect(docContent).toContain('**Production remains HOLD.**');
    expect(docContent).toContain('**FINAL GO is NOT AUTHORIZED.**');
  });

  it('should verify no direct stock balance update exists in the receiving detail UI code', () => {
    const detailPageContent = fs.readFileSync(detailPagePath, 'utf-8');

    expect(detailPageContent).not.toMatch(/from\(['"`]tgd_stock_balances['"`]\)/i);
    expect(detailPageContent).not.toMatch(/from\(['"`]tgd_stock_movements['"`]\)/i);
    expect(detailPageContent).toContain('postReceivingDocument');
    expect(detailPageContent).toContain('No stock movement until Confirm/Post');
    expect(detailPageContent).not.toContain('tgd_rpc_post_receiving_document');
  });
});
