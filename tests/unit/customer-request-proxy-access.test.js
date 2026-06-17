import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/052_tgd_wms_customer_request_proxy_access.sql',
);

describe('052 customer request proxy access migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('defines proxy role helpers and RLS updates', () => {
    expect(sql).toContain('tgd_is_customer_request_proxy_role');
    expect(sql).toContain('warehouse_admin');
    expect(sql).toContain('rls_customer_deposit_requests_select');
    expect(sql).toContain('rls_customer_withdrawal_requests_select');
  });

  it('extends create and submit RPCs for proxy customer_id', () => {
    expect(sql).toContain('tgd_create_customer_deposit_request');
    expect(sql).toContain('p_customer_id uuid default null');
    expect(sql).toContain('tgd_submit_customer_deposit_request');
    expect(sql).toContain('tgd_upsert_customer_deposit_request_line');
    expect(sql).toContain('tgd_assert_customer_request_document_scope');
  });
});
