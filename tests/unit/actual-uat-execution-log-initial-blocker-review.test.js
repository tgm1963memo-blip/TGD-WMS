import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22C Actual UAT Execution Log and Initial Blocker Review Framework', () => {
  it('should contain the 22C_ACTUAL_UAT_EXECUTION_LOG_AND_INITIAL_BLOCKER_REVIEW.md file', () => {
    const docPath = path.resolve(__dirname, '../../docs/22C_ACTUAL_UAT_EXECUTION_LOG_AND_INITIAL_BLOCKER_REVIEW.md');
    expect(fs.existsSync(docPath)).toBe(true);
    
    const content = fs.readFileSync(docPath, 'utf8');
    
    // UAT Execution Baseline
    expect(content).toContain('UAT Execution Baseline');
    expect(content).toContain('Tester');
    
    // Logs
    expect(content).toContain('Actual Execution Log');
    expect(content).toContain('Initial Blocker Review');
    expect(content).toContain('Defect Triage Table');
    expect(content).toContain('Stock Reconciliation Observation');
    expect(content).toContain('Initial Go Live Readiness Status');
    
    // Blockers explicitly checked
    expect(content).toContain('Login Failure');
    expect(content).toContain('Role/Permission Failure');
    expect(content).toContain('Missing Supabase Table/Schema');
    expect(content).toContain('Stock Balance Mismatch');
    expect(content).toContain('Movement Ledger Mismatch');
    expect(content).toContain('Dispatch/Post Outbound Failure');
    
    // Safety & Rules
    expect(content).toContain('Safety Statements & Operational Directives');
    expect(content).toContain('This execution log **does not** authorize Production Go Live');
    expect(content).toContain('FINAL GO is NOT AUTHORIZED');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('Any Critical defect automatically triggers a **HOLD** state');
    expect(content).toContain('Stock mismatch triggers **HOLD**');
    expect(content).toContain('Schema/table missing error triggers **HOLD**');
  });
});
