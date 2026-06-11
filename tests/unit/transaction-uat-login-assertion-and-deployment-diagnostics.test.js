import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Phase 23S: Transaction UAT Login Assertion and Deployment Diagnostics', () => {
  it('documentation exists and asserts core safety guarantees', () => {
    const docPath = path.resolve(process.cwd(), 'docs/23S_TRANSACTION_UAT_LOGIN_ASSERTION_AND_DEPLOYMENT_DIAGNOSTICS.md');
    const content = fs.readFileSync(docPath, 'utf8');

    expect(content).toContain('`/` and `/dashboard`');
    expect(content).toContain('DEPENDENCY_BLOCKED');
    expect(content).toContain('DRAFT_ID_MISSING');
    expect(content).toContain('23S');
    expect(content).toContain('No direct stock balance updates occur');
    expect(content).toContain('No movement ledger logic is bypassed');
    expect(content).toContain('Production remains on **HOLD**');
    expect(content).toContain('**FINAL GO is NOT AUTHORIZED**');
  });

  it('Playwright test includes login shell assertion and Scenario B dependency block', () => {
    const testPath = path.resolve(process.cwd(), 'tests/e2e/transaction-uat-round-1.spec.js');
    const content = fs.readFileSync(testPath, 'utf8');

    expect(content).toContain('waitForAuthenticatedShell');
    expect(content).toMatch(/toHaveURL\(\/\(\\\/\|\\\/dashboard\)\$\//);
    expect(content).toContain("getScenarioStatus('A') !== 'PASS'");
    expect(content).toContain("DEPENDENCY_BLOCKED: Scenario A did not PASS");
  });

  it('ReceivingCreatePage.jsx exposes 23S diagnostics', () => {
    const jsxPath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingCreatePage.jsx');
    const content = fs.readFileSync(jsxPath, 'utf8');

    expect(content).toContain('data-testid="receiving-create-diagnostics"');
    expect(content).toContain('Diagnostic version: 23T');
    expect(content).toContain('Save draft raw response type:');
    expect(content).toContain('Normalized draft id:');
    expect(content).toContain('Save draft RPC error:');
  });
});
