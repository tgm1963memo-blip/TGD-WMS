import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ControlledFrontendWriteDryRunPanel } from '../../src/components/dashboard/ControlledFrontendWriteDryRunPanel.jsx';

vi.mock('../../src/services/controlledFrontendWriteDryRunService.js', () => ({
  runControlledReceiveDryRun: vi.fn(async () => ({
    data: {
      movement: { movement_id: 'dry-run-movement-001' },
      reference: 'FRONTEND-DRY-RUN-13J-H-RECEIVE-002-TRACE-FIX',
      quantity: 10,
    },
    error: null,
  })),
}));

const repoRoot = process.cwd();
const servicePath = path.join(repoRoot, 'src/services/controlledFrontendWriteDryRunService.js');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('controlled frontend write dry run', () => {
  it('keeps execute button disabled when unauthenticated', () => {
    render(<ControlledFrontendWriteDryRunPanel session={null} />);

    const checkbox = screen.getByLabelText('I understand this will write one demo RECEIVE movement to Staging');
    fireEvent.click(checkbox);

    expect(screen.getByRole('button', { name: 'Run controlled RECEIVE dry run' })).toBeDisabled();
  });

  it('keeps execute button disabled until safety checkbox is checked', () => {
    render(<ControlledFrontendWriteDryRunPanel session={{ user: { email: 'admin.demo@tgd-wms.local' } }} />);

    const button = screen.getByRole('button', { name: 'Run controlled RECEIVE dry run' });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText('I understand this will write one demo RECEIVE movement to Staging'));
    expect(button).not.toBeDisabled();
  });

  it('uses only the approved RECEIVE dry-run RPC', () => {
    const source = readSource(servicePath);
    const rpcCalls = source.match(/\.rpc\s*\(/g) ?? [];

    expect(rpcCalls).toHaveLength(1);
    expect(source).toContain('tgd_rpc_create_receive_movement');
    expect(source).toContain('p_quantity: CONTROLLED_RECEIVE_DRY_RUN_QUANTITY');
    expect(source).toContain('p_source_location_id: null');
    expect(source).toContain("p_reference: CONTROLLED_RECEIVE_DRY_RUN_REFERENCE");
    expect(source).not.toContain('tgd_post_inventory_movement');
  });

  it('does not use direct data write methods or private key references', () => {
    const source = readSource(servicePath);
    const forbiddenPatterns = [
      /\.insert\s*\(/,
      /\.update\s*\(/,
      /\.delete\s*\(/,
      /\.upsert\s*\(/,
      /service_role/i,
      /SERVICE_ROLE/,
    ];

    forbiddenPatterns.forEach((pattern) => {
      expect(source).not.toMatch(pattern);
    });
  });

  it('does not directly mutate tgd_stock_balances', () => {
    const source = readSource(servicePath);

    expect(source).toContain(".from('tgd_stock_balances')");
    expect(source).toContain(".select('id, customer_id, location_id')");
    expect(source).not.toMatch(/from\('tgd_stock_balances'\)[\s\S]{0,200}\.update\s*\(/);
    expect(source).not.toMatch(/from\('tgd_stock_balances'\)[\s\S]{0,200}\.insert\s*\(/);
    expect(source).not.toMatch(/from\('tgd_stock_balances'\)[\s\S]{0,200}\.upsert\s*\(/);
  });
});
