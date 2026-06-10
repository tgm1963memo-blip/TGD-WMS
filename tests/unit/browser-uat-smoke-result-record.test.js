import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22I Browser UAT Smoke Result Record', () => {
  it('should verify document exists and contains required clauses', () => {
    const filePath = path.resolve(__dirname, '../../docs/22I_BROWSER_UAT_SMOKE_RESULT_RECORD.md');
    
    // verify document exists
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');

    // includes Playwright technical result PASS
    expect(content).toContain('Playwright technical result:** PASS');
    
    // includes real errors: 0
    expect(content).toContain('real errors:** 0');
    
    // includes warning explanation
    expect(content).toContain('warnings:** expected/non-blocking only');
    
    // includes limitation that smoke test does not prove transaction posting
    expect(content).toContain('This does not prove transaction posting');
    
    // includes Production remains HOLD
    expect(content).toContain('Production:** HOLD');
    
    // includes FINAL GO is NOT AUTHORIZED
    expect(content).toContain('FINAL GO:** NOT AUTHORIZED');

    // does not include FINAL GO authorized wording
    expect(content).not.toContain('FINAL GO:** AUTHORIZED');
    
    // does not imply Go Live approval
    expect(content).toContain('Go Live:** NOT READY');
  });
});
