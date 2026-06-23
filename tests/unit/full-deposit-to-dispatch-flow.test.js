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

  it('covers customer deposit driven inbound and menu-aligned routes', () => {
    const source = fs.readFileSync(specPath, 'utf8');

    [
      'customer-deposit',
      'warehouse-receiving-workspace',
      'inventory-balance',
      'withdrawal-draft',
      'movement-ledger-inbound',
      'billing-movement-weight',
    ].forEach((marker) => {
      expect(source).toContain(marker);
    });

    expect(source).not.toContain('/operations/receiving/create');
    expect(source).not.toContain('/operations/putaway');
    expect(source).toContain('/operations/receiving');
    expect(source).toContain('/reports/movement-ledger');
  });
});
