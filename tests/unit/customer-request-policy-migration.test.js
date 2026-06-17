import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'database/migrations/053_tgd_wms_customer_request_policy.sql',
);

describe('053 customer request policy migration', () => {
  it('exists and defines policy table and RPCs', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('tgd_customer_request_policy');
    expect(migration).toContain('tgd_get_customer_request_policy');
    expect(migration).toContain('tgd_update_customer_request_policy');
    expect(migration).toContain('deposit_cancel_lead_days');
    expect(migration).toContain('withdrawal_cancel_lead_days');
  });

  it('enforces lead time in customer cancel RPCs', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('current_date + v_policy.deposit_cancel_lead_days');
    expect(migration).toContain('current_date + v_policy.withdrawal_cancel_lead_days');
    expect(migration).toContain("'ADMIN_REVIEWING', 'ADMIN_ACCEPTED'");
  });
});
