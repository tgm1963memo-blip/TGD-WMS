import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22J Transaction UAT Round 1 Preparation', () => {
  it('should verify document exists and contains required clauses', () => {
    const filePath = path.resolve(__dirname, '../../docs/22J_TRANSACTION_UAT_ROUND_1_PREPARATION.md');
    
    // verify document exists
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');

    // includes all required scenarios (just check a few key ones to ensure list is there)
    expect(content).toContain('Receiving draft creation');
    expect(content).toContain('Receiving line entry');
    expect(content).toContain('Putaway confirm');
    expect(content).toContain('Transfer post');
    expect(content).toContain('Adjustment IN');
    expect(content).toContain('Adjustment OUT');
    expect(content).toContain('Stock Aging report check');

    // includes no direct stock balance update rule
    expect(content).toContain('No direct stock balance update');
    
    // includes movement ledger verification
    expect(content).toContain('Verify movement ledger');
    
    // includes stock balance verification
    expect(content).toContain('Verify stock balance');
    
    // includes strict rule: all stock changes must come from RPC/movement ledger
    expect(content).toContain('All stock changes must come from RPC calls or the movement ledger');

    // includes Production remains HOLD
    expect(content).toContain('Production:** HOLD');
    
    // includes FINAL GO is NOT AUTHORIZED
    expect(content).toContain('FINAL GO:** NOT AUTHORIZED');

    // includes Transaction UAT PENDING EXECUTION
    expect(content).toContain('Transaction UAT:** PENDING EXECUTION');

    // does not imply Go Live approval
    expect(content).not.toContain('Go Live:** AUTHORIZED');
    expect(content).not.toContain('Go Live:** APPROVED');
    expect(content).not.toContain('FINAL GO:** AUTHORIZED');
  });
});
