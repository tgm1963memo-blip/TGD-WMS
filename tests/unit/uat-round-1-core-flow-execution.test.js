import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22D UAT Round 1 Core Flow Execution Framework', () => {
  it('should contain the 22D_UAT_ROUND_1_CORE_FLOW_EXECUTION.md file', () => {
    const docPath = path.resolve(__dirname, '../../docs/22D_UAT_ROUND_1_CORE_FLOW_EXECUTION.md');
    expect(fs.existsSync(docPath)).toBe(true);
    
    const content = fs.readFileSync(docPath, 'utf8');
    
    // Environment Baseline
    expect(content).toContain('Actual Environment Baseline');
    
    // Scenarios (Core Flows)
    expect(content).toContain('Round 1 Core Flow Execution Result');
    expect(content).toContain('UAT-001'); // Login
    expect(content).toContain('UAT-005'); // Receiving
    expect(content).toContain('UAT-007'); // Putaway
    
    // Flow/Reconciliation
    expect(content).toContain('Core Stock Flow Result');
    expect(content).toContain('Final Core Flow Balance');
    
    // Ledger Check
    expect(content).toContain('Movement Ledger Verification Check');
    
    // Blockers & Decisions
    expect(content).toContain('Round 1 Blocker Log');
    expect(content).toContain('Round 1 Decision');
    
    // Hard boundaries
    expect(content).toContain('This UAT round **does not** authorize Production Go Live');
    expect(content).toContain('FINAL GO is NOT AUTHORIZED');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('Any Critical defect automatically triggers a **HOLD** state');
    expect(content).toContain('Stock mismatch triggers **HOLD**');
    expect(content).toContain('Schema/table missing error triggers **HOLD**');
  });
});
