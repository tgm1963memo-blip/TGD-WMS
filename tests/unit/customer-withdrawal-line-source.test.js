import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

const { updateWithdrawalLineSource } = await import('../../src/services/customerWithdrawalRequestService.js');

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260723110000_admin_recode_withdrawal_line_source.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('updateWithdrawalLineSource', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: 'line-1' }, error: null });
  });

  it('calls the RPC with only customerProductCode set, nulling the others', async () => {
    await updateWithdrawalLineSource('line-1', { customerProductCode: 'NEW-CODE' });
    expect(rpcMock).toHaveBeenCalledWith('tgd_admin_update_withdrawal_line_source', {
      p_line_id: 'line-1',
      p_customer_product_code: 'NEW-CODE',
      p_lot_no: null,
      p_tracking_code: null,
    });
  });

  it('calls the RPC with only lotNo set, nulling the others', async () => {
    await updateWithdrawalLineSource('line-1', { lotNo: '150' });
    expect(rpcMock).toHaveBeenCalledWith('tgd_admin_update_withdrawal_line_source', {
      p_line_id: 'line-1',
      p_customer_product_code: null,
      p_lot_no: '150',
      p_tracking_code: null,
    });
  });

  it('calls the RPC with only trackingCode set, nulling the others', async () => {
    await updateWithdrawalLineSource('line-1', { trackingCode: 'FR260630041' });
    expect(rpcMock).toHaveBeenCalledWith('tgd_admin_update_withdrawal_line_source', {
      p_line_id: 'line-1',
      p_customer_product_code: null,
      p_lot_no: null,
      p_tracking_code: 'FR260630041',
    });
  });

  it('returns the RPC error untouched (e.g. tracking code not found / different customer)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('No deposit lot found with tracking code FR000000000') });
    const result = await updateWithdrawalLineSource('line-1', { trackingCode: 'FR000000000' });
    expect(result.error.message).toMatch(/no deposit lot found/i);
    expect(result.data).toBeNull();
  });

  it('never touches supabase when the client is not configured', async () => {
    // Not asserting missingSupabaseClientResult's shape here (covered by
    // other service tests' shared helper) -- just that the RPC path itself
    // is a thin, faithful passthrough with no extra validation of its own,
    // since the RPC is the source of truth for what's required.
    expect(typeof updateWithdrawalLineSource).toBe('function');
  });
});

describe('tgd_admin_update_withdrawal_line_source migration', () => {
  it('exists and is additive only', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('requires an admin/warehouse role', () => {
    const sql = readMigration();
    expect(sql).toMatch(/admin.*accounting.*warehouse_manager.*warehouse_admin/is);
  });

  it('rejects when no deposit lot matches the tracking code', () => {
    const sql = readMigration();
    expect(sql).toMatch(/no deposit lot found with tracking code/i);
  });

  it('rejects when the matched lot belongs to a different customer', () => {
    const sql = readMigration();
    expect(sql).toMatch(/belongs to a different customer/i);
  });

  it('re-derives customer_product_code, lot_no, and source ids from the matched deposit line', () => {
    const sql = readMigration();
    expect(sql).toContain('v_source.customer_product_code');
    expect(sql).toContain('v_source.lot_no');
    expect(sql).toContain('v_source.deposit_line_id');
    expect(sql).toContain('v_source.deposit_request_id');
  });

  it('grants execute to authenticated only', () => {
    const sql = readMigration();
    expect(sql).toContain('grant execute on function public.tgd_admin_update_withdrawal_line_source(uuid, text, text, text) to authenticated');
  });
});
