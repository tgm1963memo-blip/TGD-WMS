import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const detailPagePath = resolve(process.cwd(), 'src/features/operations/receiving/ReceivingDetailPage.jsx');
const servicePath = resolve(process.cwd(), 'src/services/receivingService.js');

describe('controlled receiving RPC dry run', () => {
  it('ReceivingDetailPage uses controlled post wrapper only and no direct writes', () => {
    const page = readFileSync(detailPagePath, 'utf8');
    const service = readFileSync(servicePath, 'utf8');

    expect(page).toContain('postReceivingDocument');
    expect(page).toContain('No stock movement until Confirm/Post');
    expect(page).not.toContain('tgd_rpc_post_receiving_document');
    expect(page).not.toMatch(/\.insert\s*\(/);
    expect(page).not.toMatch(/\.update\s*\(/);
    expect(service).toContain('tgd_rpc_post_receiving_document');
    expect(service).not.toMatch(/from\(['"`]tgd_stock_balances['"`]\)/i);
  });
});
