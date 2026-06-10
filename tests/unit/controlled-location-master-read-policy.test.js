import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23N: Controlled Location Master Read Policy', () => {
  const docPath = path.join(process.cwd(), 'docs', '23N_CONTROLLED_LOCATION_MASTER_READ_POLICY.md');
  const migrationPath = path.join(process.cwd(), 'database', 'migrations', '033_tgd_wms_controlled_location_read_policy.sql');

  it('should verify document contents include Production HOLD and FINAL GO boundaries', () => {
    const docContent = fs.readFileSync(docPath, 'utf8');
    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
    expect(docContent).toContain('QC-HOLD-01');
  });

  it('should verify migration exists and is SELECT only for authenticated', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sqlContent = fs.readFileSync(migrationPath, 'utf8').toLowerCase();
    
    expect(sqlContent).toContain('tgd_locations');
    expect(sqlContent).toContain('for select');
    expect(sqlContent).toContain('to authenticated');
    expect(sqlContent).not.toContain('for all');
    expect(sqlContent).not.toContain('insert');
    expect(sqlContent).not.toContain('update');
    expect(sqlContent).not.toContain('delete');
    expect(sqlContent).not.toContain('truncate');
  });
});
