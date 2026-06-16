import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const specPath = path.join(projectRoot, 'tests/e2e/full-deposit-to-dispatch-flow.spec.js');
const helpersPath = path.join(projectRoot, 'tests/e2e/helpers/warehouseFlowHelpers.js');

describe('full deposit-to-dispatch Playwright flow', () => {
  it('defines end-to-end flow spec and helpers', () => {
    expect(fs.existsSync(specPath)).toBe(true);
    expect(fs.existsSync(helpersPath)).toBe(true);
  });

  it('covers inbound, storage, outbound, and verification phases', () => {
    const source = fs.readFileSync(specPath, 'utf8');

    [
      'customer-deposit',
      'receiving-create-draft',
      'receiving-confirm-post',
      'putaway-draft',
      'withdrawal-draft',
      'dispatch-page',
      'picking-loading-demo',
      'movement-ledger-inbound',
      'billing-movement-weight',
    ].forEach((marker) => {
      expect(source).toContain(marker);
    });

    expect(source).toContain('/operations/receiving/create');
    expect(source).toContain('/reports/movement-ledger');
    expect(source).toContain('/customer/warehouse/picking-loading');
  });
});
