import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const dashboardPath = resolve(projectRoot, 'src/features/dashboard/DashboardPage.jsx');
const newReceivingPanelPath = resolve(projectRoot, 'src/components/dashboard/ControlledReceivingRpcDryRunPanel.jsx');
const newReceivingServicePath = resolve(projectRoot, 'src/services/controlledReceivingRpcDryRunService.js');
const receivingCreatePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readProjectFile(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-M receiving RPC dry run safety hardening', () => {
  it('dashboard no longer renders the runnable old RECEIVE movement dry-run button', () => {
    const dashboard = readProjectFile(dashboardPath);

    expect(dashboard).not.toContain('ControlledFrontendWriteDryRunPanel');
    expect(dashboard).not.toContain('Run controlled RECEIVE dry run');
    expect(dashboard).toContain(
      'Controlled Receiving RPC dry-run panel is hidden after 13J-Y validation.',
    );
  });

  it('dashboard still renders the new Controlled Receiving RPC Dry Run panel', () => {
    const dashboard = readProjectFile(dashboardPath);
    const panel = readProjectFile(newReceivingPanelPath);

    expect(dashboard).not.toContain('ControlledReceivingRpcDryRunPanel');
    expect(dashboard).not.toContain('<ControlledReceivingRpcDryRunPanel session={session} />');
    expect(panel).toContain('Controlled Receiving RPC Dry Run');
    expect(panel).toContain('Run Receiving RPC Dry Run');
  });

  it('dashboard-visible code does not call stock movement RPCs', () => {
    const dashboardVisibleSource = [
      readProjectFile(dashboardPath),
      readProjectFile(newReceivingPanelPath),
      readProjectFile(newReceivingServicePath),
    ].join('\n');

    expect(dashboardVisibleSource).not.toContain('tgd_rpc_create_receive_movement');
    expect(dashboardVisibleSource).not.toContain('tgd_rpc_create_stock_movement');
  });

  it('new Receiving RPC dry-run service uses only the dry-run RPC and no direct writes', () => {
    const source = readProjectFile(newReceivingServicePath);

    expect(source).toContain('tgd_rpc_post_receiving_document_dry');
    expect(source).not.toContain('tgd_rpc_create_receiving_draft');
    expect(source).not.toContain('tgd_rpc_add_receiving_line');
    expect(source).not.toContain('tgd_rpc_confirm_receiving_document');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
  });

  it('ReceivingCreatePage remains locked', () => {
    const receivingCreate = readProjectFile(receivingCreatePath);

    expect(receivingCreate).toContain('Receiving Create Locked');
    expect(receivingCreate).not.toContain('createReceivingDocument');
    expect(receivingCreate).not.toMatch(/Save draft/i);
  });

  it('receivingService remains RPC-only for receiving draft writes', () => {
    const receivingService = readProjectFile(receivingServicePath);

    expect(receivingService).toContain('tgd_rpc_create_receiving_draft');
    expect(receivingService).toContain('tgd_rpc_add_receiving_line');
    expect(receivingService).not.toContain('tgd_rpc_confirm_receiving_document');
    expect(receivingService).not.toMatch(/\.insert\s*\(/);
    expect(receivingService).not.toMatch(/\.update\s*\(/);
    expect(receivingService).not.toMatch(/\.delete\s*\(/);
    expect(receivingService).not.toMatch(/\.upsert\s*\(/);
  });
});
