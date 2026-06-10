import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23K: Controlled Master Data Read Policy', () => {
  it('should verify document contents include Production HOLD and FINAL GO boundaries', () => {
    const docPath = path.join(process.cwd(), 'docs', '23K_CONTROLLED_MASTER_DATA_READ_POLICY.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('should verify the migration file exists and contains SELECT policies', () => {
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', '031_tgd_wms_controlled_master_data_read_policy.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    expect(migrationContent).toContain('public.tgd_products');
    expect(migrationContent).toContain('public.tgd_warehouses');
    expect(migrationContent).toContain('for select');
    expect(migrationContent).toContain('to authenticated');
    
    expect(migrationContent).not.toContain('for all');
    expect(migrationContent).not.toMatch(/\binsert\b/i);
    expect(migrationContent).not.toMatch(/\bupdate\b/i);
    expect(migrationContent).not.toMatch(/\bdelete\b/i);
    expect(migrationContent).not.toMatch(/\btruncate\b/i);
  });
});
