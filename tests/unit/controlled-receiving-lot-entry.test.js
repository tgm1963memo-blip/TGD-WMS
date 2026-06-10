import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23L: Controlled Receiving Lot Entry', () => {
  it('should verify document contents include Production HOLD and FINAL GO boundaries', () => {
    const docPath = path.join(process.cwd(), 'docs', '23L_CONTROLLED_RECEIVING_LOT_ENTRY.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('should verify document includes required diagnosis regarding lot_id', () => {
    const docPath = path.join(process.cwd(), 'docs', '23L_CONTROLLED_RECEIVING_LOT_ENTRY.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('UAT-LOT-001');
    expect(docContent).toContain('Lot No');
    expect(docContent).toContain('seed data');
    expect(docContent).toContain('DB writes');
  });

  it('should verify transaction-uat-round-1.spec.js prefers Lot No input', () => {
    const testPath = path.join(process.cwd(), 'tests', 'e2e', 'transaction-uat-round-1.spec.js');
    const testContent = fs.readFileSync(testPath, 'utf8');
    
    expect(testContent).toContain('\'input[aria-label="Lot No"]\'');
  });
});
