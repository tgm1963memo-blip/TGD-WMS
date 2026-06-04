import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const servicePath = path.join(process.cwd(), 'src/services/outboundPickingService.js');
const docPath = path.join(process.cwd(), 'docs/14G_OUTBOUND_PICKING_UI_SERVICE_INTEGRATION_DRAFT.md');

const {
  createOutboundDraft,
  addOutboundLine,
  reserveOutboundStock,
  releaseOutboundReservation,
} = await import('../../src/services/outboundPickingService.js');

function readService() {
  return readFileSync(servicePath, 'utf8');
}

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('Sprint 14G outbound picking service integration draft', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: 'rpc-row-1' }, error: null });
  });

  it('service file exists and exports all four functions', () => {
    expect(existsSync(servicePath)).toBe(true);
    expect(createOutboundDraft).toBeTypeOf('function');
    expect(addOutboundLine).toBeTypeOf('function');
    expect(reserveOutboundStock).toBeTypeOf('function');
    expect(releaseOutboundReservation).toBeTypeOf('function');
  });

  it('createOutboundDraft calls the expected RPC and returns data', async () => {
    const data = await createOutboundDraft({
      document_no: 'OB-001',
      customer_id: 'customer-1',
      source_module: 'WITHDRAWAL',
      source_document_id: 'source-doc-1',
      source_document_no: 'WD-001',
      requested_ship_date: '2026-06-04',
    });

    expect(data).toEqual({ id: 'rpc-row-1' });
    expect(rpcMock).toHaveBeenCalledWith('tgd_rpc_create_outbound_draft', {
      p_document_no: 'OB-001',
      p_customer_id: 'customer-1',
      p_source_module: 'WITHDRAWAL',
      p_source_document_id: 'source-doc-1',
      p_source_document_no: 'WD-001',
      p_requested_ship_date: '2026-06-04',
    });
  });

  it('addOutboundLine calls the expected RPC with corrected parameter order', async () => {
    await addOutboundLine({
      document_id: 'document-1',
      product_id: 'product-1',
      requested_quantity: 5,
      lot_id: 'lot-1',
      requested_weight: 2.5,
    });

    expect(rpcMock).toHaveBeenCalledWith('tgd_rpc_add_outbound_line', {
      p_document_id: 'document-1',
      p_product_id: 'product-1',
      p_requested_quantity: 5,
      p_lot_id: 'lot-1',
      p_requested_weight: 2.5,
    });
  });

  it('reserveOutboundStock and releaseOutboundReservation call expected RPCs', async () => {
    await reserveOutboundStock({
      outbound_document_id: 'document-1',
      outbound_line_id: 'line-1',
      location_id: 'location-1',
      reserved_quantity: 4,
      reserved_weight: 1.5,
    });

    await releaseOutboundReservation({ reservation_id: 'reservation-1' });

    expect(rpcMock).toHaveBeenCalledWith('tgd_rpc_reserve_outbound_stock', {
      p_outbound_document_id: 'document-1',
      p_outbound_line_id: 'line-1',
      p_location_id: 'location-1',
      p_reserved_quantity: 4,
      p_reserved_weight: 1.5,
    });
    expect(rpcMock).toHaveBeenCalledWith('tgd_rpc_release_outbound_reservation', {
      p_reservation_id: 'reservation-1',
    });
  });

  it('throws clear validation errors for required fields before RPC call', async () => {
    await expect(createOutboundDraft({})).rejects.toThrow('document_no is required.');
    await expect(addOutboundLine({ document_id: 'document-1', product_id: 'product-1' })).rejects.toThrow('requested_quantity is required.');
    await expect(addOutboundLine({ document_id: 'document-1', product_id: 'product-1', requested_quantity: 0 })).rejects.toThrow('requested_quantity must be greater than zero.');
    await expect(reserveOutboundStock({ outbound_document_id: 'document-1', outbound_line_id: 'line-1', reserved_quantity: 1 })).rejects.toThrow('location_id is required.');
    await expect(releaseOutboundReservation({})).rejects.toThrow('reservation_id is required.');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('throws Supabase RPC errors', async () => {
    const error = new Error('RPC failed');
    rpcMock.mockResolvedValueOnce({ data: null, error });

    await expect(createOutboundDraft({ document_no: 'OB-ERR' })).rejects.toThrow('RPC failed');
  });

  it('service source references only safe outbound RPCs and no stock or DML patterns', () => {
    const source = readService();

    expect(source).toContain('tgd_rpc_create_outbound_draft');
    expect(source).toContain('tgd_rpc_add_outbound_line');
    expect(source).toContain('tgd_rpc_reserve_outbound_stock');
    expect(source).toContain('tgd_rpc_release_outbound_reservation');
    expect(source).not.toContain('tgd_rpc_post_outbound_document');
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\btruncate\b/i);
  });

  it('documentation states 14G safety boundaries', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('no post outbound');
    expect(doc).toContain('no stock_movement out');
    expect(doc).toContain('no stock_balance update');
    expect(doc).toContain('no production touched');
    expect(doc).toContain('no migration applied in this sprint');
  });
});
