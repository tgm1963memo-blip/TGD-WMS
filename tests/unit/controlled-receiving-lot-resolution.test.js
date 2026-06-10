import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23M: Controlled Receiving Lot Resolution', () => {
  it('should verify document contents include Production HOLD and FINAL GO boundaries', () => {
    const docPath = path.join(process.cwd(), 'docs', '23M_CONTROLLED_RECEIVING_LOT_RESOLUTION.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('should verify document includes required diagnosis regarding lot resolution model', () => {
    const docPath = path.join(process.cwd(), 'docs', '23M_CONTROLLED_RECEIVING_LOT_RESOLUTION.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('lot_no');
    expect(docContent).toContain('lot_id');
    expect(docContent).toContain('movement ledger bypass');
    expect(docContent).toContain('delete/truncate');
    expect(docContent).toContain('stock balance');
  });

  it('should verify migration file exists', () => {
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', '032_tgd_wms_controlled_receiving_lot_resolution.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);
  });
});
