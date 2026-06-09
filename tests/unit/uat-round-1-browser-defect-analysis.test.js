import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22F UAT Round 1 Browser Defect Analysis Framework', () => {
  it('should contain the 22F_UAT_ROUND_1_BROWSER_DEFECT_ANALYSIS.md file', () => {
    const docPath = path.resolve(__dirname, '../../docs/22F_UAT_ROUND_1_BROWSER_DEFECT_ANALYSIS.md');
    expect(fs.existsSync(docPath)).toBe(true);
    
    const content = fs.readFileSync(docPath, 'utf8');
    
    // Check required defect analysis components
    expect(content).toContain('schema cache');
    expect(content).toContain('/executive/management');
    expect(content).toContain('HOLD FOR FIX');
    
    // Check defect table columns
    expect(content).toContain('Defect ID');
    expect(content).toContain('Observed Error');
    expect(content).toContain('Likely Root Cause');
    
    // Check safe diagnostic SQL
    expect(content).toContain("select table_name");
    expect(content).toContain("information_schema.tables");
    expect(content).toContain("select routine_name");
    expect(content).toContain("information_schema.routines");
    
    // Negative check for destructive commands
    expect(content.toLowerCase()).not.toContain('delete from');
    expect(content.toLowerCase()).not.toContain('truncate table');
    expect(content.toLowerCase()).not.toContain('update stock_balance');
    
    // Hard boundaries
    expect(content).toContain('This defect analysis **does not** authorize Production Go Live');
    expect(content).toContain('FINAL GO is NOT AUTHORIZED');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('Schema cache errors explicitly trigger a **HOLD**');
    expect(content).toContain('stock/RPC/ledger defects require a controlled fix');
  });
});
