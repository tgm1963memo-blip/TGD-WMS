import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22E UAT Round 1 Actual Execution Result Framework', () => {
  it('should contain the 22E_UAT_ROUND_1_ACTUAL_EXECUTION_RESULT.md file', () => {
    const docPath = path.resolve(__dirname, '../../docs/22E_UAT_ROUND_1_ACTUAL_EXECUTION_RESULT.md');
    expect(fs.existsSync(docPath)).toBe(true);
    
    const content = fs.readFileSync(docPath, 'utf8');
    
    // Environment Baseline
    expect(content).toContain('Actual Environment Baseline');
    expect(content).toContain('663ae0c');
    
    // Scenarios (Core Flows)
    expect(content).toContain('Actual Round 1 Core Flow Execution Result');
    expect(content).toContain('NOT EXECUTED');
    
    // Flow/Reconciliation
    expect(content).toContain('Actual Core Stock Flow Result');
    expect(content).toContain('Actual Movement Ledger Verification Check');
    
    // Logs
    expect(content).toContain('Actual Blocker Log');
    expect(content).toContain('Actual Defect Log');
    
    // Summary
    expect(content).toContain('Execution Summary');
    expect(content).toContain('Total Scenarios');
    
    // Decisions
    expect(content).toContain('Round 1 Decision');
    
    // Hard boundaries
    expect(content).toContain('This UAT result **does not** authorize Production Go Live');
    expect(content).toContain('FINAL GO is NOT AUTHORIZED');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('Any Critical defect automatically triggers a **HOLD** state');
    expect(content).toContain('Stock mismatch triggers **HOLD**');
    expect(content).toContain('Schema/table missing error triggers **HOLD**');
  });
});
