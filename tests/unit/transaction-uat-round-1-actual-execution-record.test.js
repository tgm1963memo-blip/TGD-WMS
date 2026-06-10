import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22L Transaction UAT Round 1 Actual Execution Record', () => {
  it('should verify document exists and contains required execution table and rules', () => {
    const filePath = path.resolve(__dirname, '../../docs/22L_TRANSACTION_UAT_ROUND_1_ACTUAL_EXECUTION_RECORD.md');
    
    // verify document exists
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');

    // includes PENDING ACTUAL EXECUTION
    expect(content).toContain('Execution Status:** PENDING ACTUAL EXECUTION');
    expect(content).toContain('Transaction UAT Round 1:** PENDING ACTUAL EXECUTION');

    // includes all 16 scenarios
    expect(content).toContain('1 | Receiving | Draft created');
    expect(content).toContain('16 | System | Final summary ready');

    // includes PASS / FAIL / BLOCKED status options
    expect(content).toContain('Status options are PENDING / PASS / FAIL / BLOCKED');

    // includes defect summary table
    expect(content).toContain('Defect ID | Scenario ID | Severity | Description | Evidence | Owner | Status | Retest result');

    // includes movement ledger verification
    expect(content).toContain('4 | Movement Ledger | Receiving entry logged');
    expect(content).toContain('14 | Movement Ledger | Adjustments logged');

    // includes stock balance verification
    expect(content).toContain('5 | Stock Balance | Balance increased at location');
    expect(content).toContain('8 | Stock Balance | Location updated');
    expect(content).toContain('11 | Stock Balance | From -, To + location balance updated');

    // includes Browser Smoke PASSED
    expect(content).toContain('Browser Smoke:** PASSED');

    // includes Production HOLD
    expect(content).toContain('Production:** HOLD');

    // includes FINAL GO is NOT AUTHORIZED
    expect(content).toContain('FINAL GO:** NOT AUTHORIZED');

    // does not imply Go Live approval
    expect(content).not.toContain('Go Live:** AUTHORIZED');
    expect(content).not.toContain('Go Live:** APPROVED');
    expect(content).not.toContain('FINAL GO:** AUTHORIZED');
  });
});
