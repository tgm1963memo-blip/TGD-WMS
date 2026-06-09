import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22B Actual Full Function UAT Result Capture Framework', () => {
  it('should contain the 22B_ACTUAL_FULL_FUNCTION_UAT_RESULT_CAPTURE.md file', () => {
    const docPath = path.resolve(__dirname, '../../docs/22B_ACTUAL_FULL_FUNCTION_UAT_RESULT_CAPTURE.md');
    expect(fs.existsSync(docPath)).toBe(true);
    
    const content = fs.readFileSync(docPath, 'utf8');
    
    // UAT Execution Baseline
    expect(content).toContain('UAT Execution Baseline');
    expect(content).toContain('Tester Name');
    
    // Scenarios
    expect(content).toContain('Actual Full Function UAT Execution Scenarios');
    expect(content).toContain('UAT-001');
    expect(content).toContain('UAT-025');
    
    // Flow/Reconciliation
    expect(content).toContain('Actual Stock Reconciliation Result');
    expect(content).toContain('Reconciliation Status');
    
    // Defect Log
    expect(content).toContain('Actual Defect Log');
    
    // Blockers
    expect(content).toContain('Actual Blockers Section');
    
    // Summary
    expect(content).toContain('UAT Summary');
    
    // Readiness
    expect(content).toContain('Go Live Readiness Decision');
    
    // Hard boundaries
    expect(content).toContain('This UAT result capture **does not** authorize Production Go Live');
    expect(content).toContain('FINAL GO is NOT AUTHORIZED');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('Any Critical defect automatically triggers a **HOLD** state');
    expect(content).toContain('Stock mismatch triggers **HOLD**');
    expect(content).toContain('Schema/table missing error triggers **HOLD**');
  });
});
