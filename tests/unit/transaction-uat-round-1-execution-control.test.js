import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22K Transaction UAT Round 1 Execution Control', () => {
  it('should verify document exists and contains required controls', () => {
    const filePath = path.resolve(__dirname, '../../docs/22K_TRANSACTION_UAT_ROUND_1_EXECUTION_CONTROL.md');
    
    // verify document exists
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');

    // includes all 16 execution scenarios
    expect(content).toContain('1 | Receiving | Draft creation');
    expect(content).toContain('16 | System | Final transaction evidence summary');

    // includes controlled evidence names
    expect(content).toContain('22K_01_receiving_draft.png');
    expect(content).toContain('22K_08_location_balance_after_putaway.png');
    expect(content).toContain('22K_16_final_summary.png');

    // includes defect log table
    expect(content).toContain('Defect ID | Scenario ID | Module | Severity');

    // includes pass/fail/blocker rules
    expect(content).toContain('**PASS:** Only when the browser action succeeds');
    expect(content).toContain('**FAIL:** When UI action fails');
    expect(content).toContain('**BLOCKED:** When prerequisite master data');

    // includes movement ledger evidence requirement
    expect(content).toContain('Stock movement cannot be marked PASS without movement ledger evidence');

    // includes stock balance evidence requirement
    expect(content).toContain('Stock balance cannot be marked PASS without balance verification evidence');

    // includes Transaction UAT Round 1 PENDING EXECUTION
    expect(content).toContain('Transaction UAT Round 1:** PENDING EXECUTION');

    // includes Browser Smoke PASSED
    expect(content).toContain('Browser Smoke:** PASSED');

    // includes Production remains HOLD
    expect(content).toContain('Production:** HOLD');

    // includes FINAL GO is NOT AUTHORIZED
    expect(content).toContain('FINAL GO:** NOT AUTHORIZED');

    // does not imply Go Live approval
    expect(content).not.toContain('Go Live:** AUTHORIZED');
    expect(content).not.toContain('Go Live:** APPROVED');
    expect(content).not.toContain('FINAL GO:** AUTHORIZED');
  });
});
