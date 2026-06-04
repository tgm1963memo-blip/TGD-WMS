import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

const servicePath = path.join(process.cwd(), 'src/services/outboundPickingService.js');
const docPath = path.join(process.cwd(), 'docs/14G_OUTBOUND_PICKING_UI_SERVICE_INTEGRATION_DRAFT.md');

const {
  addOutboundLine,
  createOutboundDraft,
  getOutboundDocumentDetail,
  listOutboundDocuments,
  releaseOutboundReservation,
  reserveOutboundStock,
} = await import('../../src/services/outboundPickingService.js');

function readService() {
  return readFileSync(servicePath, 'utf8');
}

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

function createSelectChain(tableName) {
  const rowsByTable = {
    tgd_outbound_documents: [{ id: 'document-1', document_no: 'OB-001' }],
    tgd_outbound_lines: [{ id: 'line-1', document_id: 'document-1' }],
    tgd_outbound_reservations: [{ id: 'reservation-1', outbound_document_id: 'document-1' }],
  };

  const chain = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data: rowsByTable[tableName] ?? [], error: null })),
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: rowsByTable[tableName]?.[0] ?? null, error: null })),
  };

  return chain;
}

describe('Sprint 14G outbound picking service integration draft', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: 'rpc-row-1' }, error: null });
    fromMock.mockImplementation((tableName) => createSelectChain(tableName));
  });

  it('service file exists and exports outbound functions', () => {
    expect(existsSync(servicePath)).toBe(true);
    expect(createOutboundDraft).toBeTypeOf('function');
    expect(addOutboundLine).toBeTypeOf('function');
    expect(reserveOutboundStock).toBeTypeOf('function');
    expect(releaseOutboundReservation).toBeTypeOf('function');
    expect(listOutboundDocuments).toBeTypeOf('function');
    expect(getOutboundDocumentDetail).toBeTypeOf('function');
  });

  it('listOutboundDocuments reads tgd_outbound_documents only', async () => {
    const data = await listOutboundDocuments();

    expect(data).toEqual([{ id: 'document-1', document_no: 'OB-001' }]);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('tgd_outbound_documents');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('getOutboundDocumentDetail reads document, lines, and reservations', async () => {
    const detail = await getOutboundDocumentDetail('document-1');

    expect(detail).toEqual({
      document: { id: 'document-1', document_no: 'OB-001' },
      lines: [{ id: 'line-1', document_id: 'document-1' }],
      reservations: [{ id: 'reservation-1', outbound_document_id: 'document-1' }],
    });
    expect(fromMock).toHaveBeenCalledWith('tgd_outbound_documents');
    expect(fromMock).toHaveBeenCalledWith('tgd_outbound_lines');
    expect(fromMock).toHaveBeenCalledWith('tgd_outbound_reservations');
    expect(rpcMock).not.toHaveBeenCalled();
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
    await expect(getOutboundDocumentDetail()).rejects.toThrow('documentId is required.');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('throws Supabase RPC errors', async () => {
    const error = new Error('RPC failed');
    rpcMock.mockResolvedValueOnce({ data: null, error });

    await expect(createOutboundDraft({ document_no: 'OB-ERR' })).rejects.toThrow('RPC failed');
  });

  it('throws Supabase read errors clearly', async () => {
    fromMock.mockImplementationOnce(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: null, error: new Error('Read failed') })),
      })),
    }));

    await expect(listOutboundDocuments()).rejects.toThrow('Read failed');
  });

  it('service source references only safe outbound RPCs and read-only selects', () => {
    const source = readService();

    expect(source).toContain('tgd_rpc_create_outbound_draft');
    expect(source).toContain('tgd_rpc_add_outbound_line');
    expect(source).toContain('tgd_rpc_reserve_outbound_stock');
    expect(source).toContain('tgd_rpc_release_outbound_reservation');
    expect(source).toContain('tgd_outbound_documents');
    expect(source).toContain('tgd_outbound_lines');
    expect(source).toContain('tgd_outbound_reservations');
    expect(source).not.toContain('tgd_rpc_post_outbound_document');
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
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
