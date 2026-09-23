import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');
const servicePath = path.join(process.cwd(), 'src/services/customerWithdrawalRequestService.js');
const migrationPath = path.join(process.cwd(), 'database/migrations/114_withdrawal_line_temperature_type_edit.sql');

describe('admin withdrawal review temperature edit', () => {
  it('renders a temperature column and saves through the dedicated service', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('updateWithdrawalLineTemperatureType');
    expect(source).toContain('lineTemperatureTypes');
    expect(source).toContain('savingTemperatureType');
    expect(source).toContain('อุณหภูมิ');
    expect(source).toContain('WITHDRAWAL_LINE_TEMPERATURE_TYPES.map');
  });

  it('selects withdrawal line temperature_type and calls the RPC', () => {
    const source = readFileSync(servicePath, 'utf8');

    expect(source).toContain("'temperature_type'");
    expect(source).toContain('tgd_update_withdrawal_line_temperature_type');
  });

  it('adds the database column and validates supported temperature types', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('add column if not exists temperature_type text');
    expect(sql).toContain('tgd_update_withdrawal_line_temperature_type');
    expect(sql).toContain("'FREEZE_FROZEN'");
    expect(sql).toContain('grant execute on function public.tgd_update_withdrawal_line_temperature_type(uuid, text) to authenticated');
  });
});
