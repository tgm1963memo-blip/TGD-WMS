import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260819080000_withdrawal_request_services.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

// Regression coverage for Part G: the new withdrawal-side auxiliary service
// table/RPCs must be additive only and mirror the deposit-side role gates
// exactly (write restricted to admin/accounting/warehouse_admin/warehouse_manager,
// customers can read only their own requests, never write).
describe('withdrawal request services migration', () => {
  it('exists and never drops a table/column or truncates anything', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/truncate/i);
  });

  it('the only "delete from" is a single-row delete scoped by id inside the delete RPC, mirroring the deposit-side pattern', () => {
    const sql = readMigration();
    const deleteMatches = [...sql.matchAll(/delete\s+from\s+\S+/gi)];
    expect(deleteMatches).toHaveLength(1);
    expect(sql).toContain('delete from public.tgd_customer_withdrawal_request_services where id = p_id');
  });

  it('creates the table scoped to withdrawal requests with a positive-quantity check', () => {
    const sql = readMigration();
    expect(sql).toContain('create table if not exists public.tgd_customer_withdrawal_request_services');
    expect(sql).toContain('references public.tgd_customer_withdrawal_requests(id) on delete cascade');
    expect(sql).toContain('check (quantity > 0)');
  });

  it('restricts write access to staff roles only, matching the deposit-side gate', () => {
    const sql = readMigration();
    const policyBlockMatch = sql.match(/create policy rls_withdrawal_request_services_write[\s\S]*?with check \([\s\S]*?\);/);
    expect(policyBlockMatch).not.toBeNull();
    const policyBlock = policyBlockMatch[0];
    expect(policyBlock).toContain("'admin', 'accounting', 'warehouse_admin', 'warehouse_manager'");
    expect(policyBlock).not.toContain('customer_admin');
    expect(policyBlock).not.toContain('customer_user');
  });

  it('lets a customer read only their own withdrawal request\'s services', () => {
    const sql = readMigration();
    expect(sql).toContain("public.tgd_current_user_customer_id() = wr.customer_id");
  });

  it('gates both RPCs behind the same staff-role check as the table write policy', () => {
    const sql = readMigration();
    const upsertFnMatch = sql.match(/tgd_upsert_customer_withdrawal_request_service[\s\S]*?\$\$;/);
    const deleteFnMatch = sql.match(/tgd_delete_customer_withdrawal_request_service[\s\S]*?\$\$;/);
    expect(upsertFnMatch).not.toBeNull();
    expect(deleteFnMatch).not.toBeNull();
    expect(upsertFnMatch[0]).toContain("'admin', 'accounting', 'warehouse_admin', 'warehouse_manager'");
    expect(deleteFnMatch[0]).toContain("'admin', 'accounting', 'warehouse_admin', 'warehouse_manager'");
  });

  it('grants execute on both RPCs to authenticated', () => {
    const sql = readMigration();
    expect(sql).toMatch(/grant execute on function public\.tgd_upsert_customer_withdrawal_request_service[\s\S]*?to authenticated/);
    expect(sql).toMatch(/grant execute on function public\.tgd_delete_customer_withdrawal_request_service[\s\S]*?to authenticated/);
  });
});
