import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const dashboardPath = resolve(projectRoot, 'src/features/dashboard/DashboardPage.jsx');
const receivingDetailPath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingDetailPage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readProjectFile(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-M receiving RPC dry run safety hardening', () => {
  it('dashboard no longer renders the runnable old RECEIVE movement dry-run button', () => {
    const dashboard = readProjectFile(dashboardPath);

    expect(dashboard).not.toContain('ControlledFrontendWriteDryRunPanel');
    expect(dashboard).not.toContain('Run controlled RECEIVE dry run');
  });

  it('dashboard does not render the Controlled Receiving RPC Dry Run panel', () => {
    const dashboard = readProjectFile(dashboardPath);

    expect(dashboard).not.toContain('ControlledReceivingRpcDryRunPanel');
    expect(dashboard).not.toContain('<ControlledReceivingRpcDryRunPanel session={session} />');
  });

  it('dashboard-visible code does not call stock movement RPCs', () => {
    const dashboardVisibleSource = readProjectFile(dashboardPath);

    expect(dashboardVisibleSource).not.toContain('tgd_rpc_create_receive_movement');
    expect(dashboardVisibleSource).not.toContain('tgd_rpc_create_stock_movement');
  });

  it('ReceivingDetailPage allows controlled post wrapper only', () => {
    const receivingDetail = readProjectFile(receivingDetailPath);

    expect(receivingDetail).toContain('Confirm/Post Receiving');
    expect(receivingDetail).toContain('postReceivingDocument');
    expect(receivingDetail).toContain('No stock movement until Confirm/Post');
    expect(receivingDetail).not.toContain('tgd_rpc_post_receiving_document');
    expect(receivingDetail).not.toContain('supabase.from');
    expect(receivingDetail).not.toMatch(/\.insert\s*\(/);
    expect(receivingDetail).not.toMatch(/\.update\s*\(/);
    expect(receivingDetail).not.toMatch(/\.delete\s*\(/);
    expect(receivingDetail).not.toMatch(/\.upsert\s*\(/);
    expect(receivingDetail).not.toContain('tgd_stock_movements');
    expect(receivingDetail).not.toContain('tgd_stock_balances');
  });

  it('receivingService remains RPC-only for receiving writes', () => {
    const receivingService = readProjectFile(receivingServicePath);

    expect(receivingService).toContain('tgd_rpc_add_receiving_line');
    expect(receivingService).toContain('postReceivingDocument');
    expect(receivingService).toContain('tgd_rpc_post_receiving_document');
    expect(receivingService).toContain('Standalone receiving draft creation was removed');
    expect(receivingService).toContain('p_document_id: id');
    expect(receivingService).not.toMatch(/\.insert\s*\(/);
    expect(receivingService).not.toMatch(/\.update\s*\(/);
    expect(receivingService).not.toMatch(/\.delete\s*\(/);
    expect(receivingService).not.toMatch(/\.upsert\s*\(/);
  });
});
