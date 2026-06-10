import { describe, it, expect } from 'vitest';

describe('23E: Playwright Transaction UAT Status Classification', () => {
  // Simulate the runScenario error catching logic
  const classifyError = (err) => {
    let status = 'PENDING';
    const msg = err?.message || String(err);
    if (msg.includes('SKIPPED_WITH_REASON')) {
      status = 'SKIPPED_WITH_REASON';
    } else if (msg.includes('MISSING_SELECTOR') || msg.includes('MISSING_TABLE_BLOCKED')) {
      status = 'BLOCKED';
    } else {
      status = 'FAIL';
    }
    return status;
  };

  it('should classify SKIPPED_WITH_REASON correctly', () => {
    const err = new Error('SKIPPED_WITH_REASON');
    expect(classifyError(err)).toBe('SKIPPED_WITH_REASON');
  });

  it('should classify MISSING_SELECTOR correctly', () => {
    const err = new Error('MISSING_SELECTOR: Cannot find any of [a:has-text("Create Receiving Draft")]');
    expect(classifyError(err)).toBe('BLOCKED');
  });

  it('should classify MISSING_TABLE_BLOCKED correctly', () => {
    const err = new Error('MISSING_TABLE_BLOCKED: tgd_reason_codes table is missing');
    expect(classifyError(err)).toBe('BLOCKED');
  });

  it('should classify generic runtime errors as FAIL', () => {
    const err = new Error('page.goto: net::ERR_CONNECTION_REFUSED');
    expect(classifyError(err)).toBe('FAIL');
  });

  // Simulate final decision logic
  const getFinalDecision = (scenarios, errors) => {
    const hasErrors = errors.length > 0;
    const hasFailures = scenarios.some(s => s.status === 'FAIL');
    const hasBlockers = scenarios.some(s => s.status === 'BLOCKED');

    if (hasErrors || hasFailures) {
      return "FAIL";
    } else if (hasBlockers) {
      return "BLOCKED";
    } else {
      return "PASS";
    }
  };

  it('should decide FAIL if there are runtime errors', () => {
    const scenarios = [{ status: 'PASS' }, { status: 'BLOCKED' }];
    const errors = ['Some page error'];
    expect(getFinalDecision(scenarios, errors)).toBe('FAIL');
  });

  it('should decide FAIL if any scenario failed', () => {
    const scenarios = [{ status: 'PASS' }, { status: 'FAIL' }];
    const errors = [];
    expect(getFinalDecision(scenarios, errors)).toBe('FAIL');
  });

  it('should decide BLOCKED if no failures/errors but blockers exist', () => {
    const scenarios = [{ status: 'PASS' }, { status: 'BLOCKED' }, { status: 'SKIPPED_WITH_REASON' }];
    const errors = [];
    expect(getFinalDecision(scenarios, errors)).toBe('BLOCKED');
  });

  it('should decide PASS if no failures, errors, or blockers', () => {
    const scenarios = [{ status: 'PASS' }, { status: 'SKIPPED_WITH_REASON' }];
    const errors = [];
    expect(getFinalDecision(scenarios, errors)).toBe('PASS');
  });
});
