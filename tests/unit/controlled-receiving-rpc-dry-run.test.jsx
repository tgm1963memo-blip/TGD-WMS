import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ControlledReceivingRpcDryRunPanel } from '../../src/components/dashboard/ControlledReceivingRpcDryRunPanel.jsx';

vi.mock('../../src/services/controlledReceivingRpcDryRunService.js', () => ({
  CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_ID: '0ffcec05-c1d9-4e56-bf05-a7434e679603',
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
  it('renders panel warning that dry run is only for staging and no stock movement will be posted', () => {
    render(<ControlledReceivingRpcDryRunPanel session={{ user: { email: 'admin.demo@tgd-wms.local', id: 'user-123' } }} />);

    expect(screen.getByText('Controlled Receiving RPC Dry Run')).toBeInTheDocument();
    expect(screen.getByText('DRY RUN ONLY — no stock movement will be posted')).toBeInTheDocument();
    expect(screen.getByText('Authenticated user ID: user-123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Receiving RPC Dry Run' })).toBeInTheDocument();
  });

  it('dashboard mounts the controlled receiving dry-run panel outside Receiving pages', () => {
    const dashboard = readSource(dashboardPath);
    const panel = readSource(panelPath);

    expect(dashboard).not.toContain('ControlledReceivingRpcDryRunPanel');
    expect(dashboard).not.toContain('<ControlledReceivingRpcDryRunPanel session={session} />');
    expect(panel).toContain('Controlled Receiving RPC Dry Run');
  });

  it('service calls only the fixed dry-run RPC and not the full post RPC', () => {
    const source = readSource(servicePath);
    const rpcCalls = source.match(/\.rpc\s*\(/g) ?? [];

    expect(rpcCalls).toHaveLength(1);
    expect(source).toContain('tgd_rpc_post_receiving_document_dry');
    expect(source).not.toMatch(/tgd_rpc_post_receiving_document\s*\(/);
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

  it('panel source contains the fixed document ID constant and renders raw dry run JSON', () => {
    const panel = readSource(panelPath);

    expect(panel).toContain('CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_ID');
    expect(panel).toContain('JSON.stringify(result.dryRunResult, null, 2)');
  });

  it('service source contains the fixed document ID UUID and only calls the dry run RPC', () => {
    const source = readSource(servicePath);

    expect(source).toContain('0ffcec05-c1d9-4e56-bf05-a7434e679603');
    expect(source).toContain('tgd_rpc_post_receiving_document_dry');
    expect(source).not.toMatch(/tgd_rpc_post_receiving_document\s*\(/);
  });

  it('ReceivingCreatePage remains locked and does not import createReceivingDocument', () => {
    const receivingCreate = readSource(receivingCreatePath);

    expect(receivingCreate).toContain('Receiving Create Locked');
    expect(receivingCreate).not.toContain('createReceivingDocument');
    expect(receivingCreate).not.toMatch(/Save draft/i);
  });

  it('receivingService remains RPC-only for draft writes and does not use direct table DML', () => {
    const receivingService = readSource(receivingServicePath);

    expect(receivingService).toContain('tgd_rpc_create_receiving_draft');
    expect(receivingService).toContain('tgd_rpc_add_receiving_line');
    expect(receivingService).not.toContain('tgd_rpc_confirm_receiving_document');
    expect(receivingService).not.toMatch(/\.insert\s*\(/);
    expect(receivingService).not.toMatch(/\.update\s*\(/);
    expect(receivingService).not.toMatch(/\.delete\s*\(/);
    expect(receivingService).not.toMatch(/\.upsert\s*\(/);
  });
});
