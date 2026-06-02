import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ControlledReceivingRpcDryRunPanel } from '../../src/components/dashboard/ControlledReceivingRpcDryRunPanel.jsx';

vi.mock('../../src/services/controlledReceivingRpcDryRunService.js', () => ({
  runControlledReceivingRpcDryRun: vi.fn(async () => ({
    data: {
      before: {
        receivingDocuments: 1,
        receivingLines: 1,
        stockMovements: 9,
        stockBalances: 3,
        totalStockQuantity: 2320,
      },
      selectedSample: {
        customer_id: 'customer-1',
        product_id: 'product-1',
        lot_id: 'lot-1',
        location_id: 'location-1',
      },
      documentId: 'document-1',
      lineId: 'line-1',
      confirmExpectedError:
        'Receiving stock posting is not enabled until stock movement RPC accepts product_id, lot_id, and location_id',
      after: {
        receivingDocuments: 2,
        receivingLines: 2,
        stockMovements: 9,
        stockBalances: 3,
        totalStockQuantity: 2320,
      },
      validation: {
        receivingDocumentsIncreasedByOne: true,
        receivingLinesIncreasedByOne: true,
        stockMovementsUnchanged: true,
        stockBalancesUnchanged: true,
        totalStockQuantityUnchanged: true,
      },
      validationStatus: 'PASS',
    },
    error: null,
  })),
}));

const repoRoot = process.cwd();
const servicePath = path.join(repoRoot, 'src/services/controlledReceivingRpcDryRunService.js');
const panelPath = path.join(repoRoot, 'src/components/dashboard/ControlledReceivingRpcDryRunPanel.jsx');
const dashboardPath = path.join(repoRoot, 'src/features/dashboard/DashboardPage.jsx');
const receivingCreatePath = path.join(repoRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');
const receivingServicePath = path.join(repoRoot, 'src/services/receivingService.js');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('controlled receiving RPC dry run', () => {
  it('renders panel warning that Receiving UI remains locked', () => {
    render(<ControlledReceivingRpcDryRunPanel session={{ user: { email: 'admin.demo@tgd-wms.local' } }} />);

    expect(screen.getByText('Controlled Receiving RPC Dry Run')).toBeInTheDocument();
    expect(screen.getByText('Staging only / Receiving UI remains locked / No stock posting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Receiving RPC Dry Run' })).toBeInTheDocument();
  });

  it('dashboard mounts the controlled receiving dry-run panel outside Receiving pages', () => {
    const dashboard = readSource(dashboardPath);

    expect(dashboard).toContain('ControlledReceivingRpcDryRunPanel');
    expect(dashboard).toContain('<ControlledReceivingRpcDryRunPanel session={session} />');
  });

  it('service uses only the approved receiving RPC names', () => {
    const source = readSource(servicePath);
    const rpcCalls = source.match(/\.rpc\s*\(/g) ?? [];

    expect(rpcCalls).toHaveLength(3);
    expect(source).toContain('tgd_rpc_create_receiving_draft');
    expect(source).toContain('tgd_rpc_add_receiving_line');
    expect(source).toContain('tgd_rpc_confirm_receiving_document');
  });

  it('service does not use direct write methods or stock movement RPCs', () => {
    const source = readSource(servicePath);

    [/\.insert\s*\(/, /\.update\s*\(/, /\.delete\s*\(/, /\.upsert\s*\(/].forEach((pattern) => {
      expect(source).not.toMatch(pattern);
    });
    expect(source).not.toContain('tgd_rpc_create_receive_movement');
    expect(source).not.toContain('tgd_rpc_create_stock_movement');
    expect(source).not.toMatch(/service_role/i);
    expect(source).not.toMatch(/DATABASE_URL/i);
  });

  it('panel displays before and after baseline, ids, expected confirm block, and validation', () => {
    const panel = readSource(panelPath);

    expect(panel).toContain('Before baseline');
    expect(panel).toContain('After baseline');
    expect(panel).toContain('document_id');
    expect(panel).toContain('line_id');
    expect(panel).toContain('expected confirm block');
    expect(panel).toContain('Validation:');
  });

  it('ReceivingCreatePage remains locked and does not import createReceivingDocument', () => {
    const receivingCreate = readSource(receivingCreatePath);

    expect(receivingCreate).toContain('Receiving Create Locked');
    expect(receivingCreate).not.toContain('createReceivingDocument');
    expect(receivingCreate).not.toMatch(/Save draft/i);
  });

  it('receivingService is not modified to call new receiving RPCs', () => {
    const receivingService = readSource(receivingServicePath);

    expect(receivingService).not.toContain('tgd_rpc_create_receiving_draft');
    expect(receivingService).not.toContain('tgd_rpc_add_receiving_line');
    expect(receivingService).not.toContain('tgd_rpc_confirm_receiving_document');
  });
});
