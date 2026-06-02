import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/018_tgd_wms_receiving_rpc_contract.sql');
const receivingCreatePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readProjectFile(path) {
  return readFileSync(path, 'utf8');
}

function extractInsertColumns(source, tableName) {
  const pattern = new RegExp(`insert\\s+into\\s+public\\.${tableName}\\s*\\(([\\s\\S]*?)\\)\\s*values`, 'i');
  const match = source.match(pattern);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);
}

describe('Sprint 13J-K receiving RPC migration draft', () => {
  it('creates the receiving RPC migration draft file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('enables RLS on both receiving tables and keeps SELECT policies for documents and lines', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).toMatch(/alter table public\.tgd_receiving_documents enable row level security/i);
    expect(migration).toMatch(/alter table public\.tgd_receiving_lines enable row level security/i);
    expect(migration).toContain('create policy rls_receiving_documents_select');
    expect(migration).toContain('create policy rls_receiving_lines_select');
    expect(migration).toContain('public.tgd_current_user_is_active()');
    expect(migration).toContain('public.tgd_current_user_customer_id()');
  });

  it('does not create permissive direct table write policies and revokes table writes', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.tgd_receiving_documents\s+for insert/i);
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.tgd_receiving_documents\s+for update/i);
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.tgd_receiving_documents\s+for delete/i);
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.tgd_receiving_lines\s+for insert/i);
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.tgd_receiving_lines\s+for update/i);
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.tgd_receiving_lines\s+for delete/i);
    expect(migration).toContain(
      'revoke insert, update, delete on public.tgd_receiving_documents from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke insert, update, delete on public.tgd_receiving_lines from anon, authenticated',
    );
  });

  it('creates the three receiving RPC contract functions and grants authenticated execute only', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).toContain('public.tgd_rpc_create_receiving_draft');
    expect(migration).toContain('public.tgd_rpc_add_receiving_line');
    expect(migration).toContain('public.tgd_rpc_confirm_receiving_document');
    expect(migration).toContain('grant execute on function public.tgd_rpc_create_receiving_draft(uuid, text) to authenticated');
    expect(migration).toContain('grant execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric) to authenticated');
    expect(migration).toContain('grant execute on function public.tgd_rpc_confirm_receiving_document(uuid) to authenticated');
  });

  it('draft RPC inserts only actual audited receiving document columns', () => {
    const migration = readProjectFile(migrationPath);
    const columns = extractInsertColumns(migration, 'tgd_receiving_documents');

    expect(columns).toEqual(['customer_id', 'document_no', 'status']);
    [
      'receiving_no',
      'warehouse_id',
      'receiving_type',
      'source_no',
      'remark',
      'expected_receive_date',
    ].forEach((column) => {
      expect(columns).not.toContain(column);
    });
  });

  it('add line RPC inserts only actual audited receiving line columns', () => {
    const migration = readProjectFile(migrationPath);
    const columns = extractInsertColumns(migration, 'tgd_receiving_lines');

    expect(columns).toEqual(['document_id', 'product_id', 'lot_id', 'quantity', 'weight']);
    ['received_qty', 'to_location_id', 'uom', 'receiving_document_id', 'line_no'].forEach((column) => {
      expect(columns).not.toContain(column);
    });
  });

  it('confirm RPC is a no-stock-posting placeholder until movement RPC accepts explicit line fields', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toContain('tgd_rpc_create_receive_movement');
    expect(migration).not.toContain('tgd_rpc_create_stock_movement');
    expect(migration).not.toContain('tgd_post_inventory_movement');
    expect(migration).toContain(
      'Receiving stock posting is not enabled until stock movement RPC accepts product_id, lot_id, and location_id',
    );
  });

  it('does not introduce service role or production-allowed wording', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toMatch(/service_role/i);
    expect(migration).not.toMatch(/DATABASE_URL/i);
    expect(migration).not.toMatch(/production\s+(is\s+)?allowed/i);
    expect(migration).not.toMatch(/apply\s+to\s+production\s+without\s+approval/i);
    expect(migration).toContain('Production locked');
    expect(migration).toContain('Staging review required');
  });

  it('does not enable frontend receiving UI and keeps service free of direct table writes', () => {
    const migration = readProjectFile(migrationPath);
    const receivingCreate = readProjectFile(receivingCreatePath);
    const receivingService = readProjectFile(receivingServicePath);

    expect(migration).toContain('Receiving UI remains locked');
    expect(receivingCreate).toContain('Controlled receiving draft mode');
    expect(receivingCreate).toContain('createReceivingDocument');
    expect(receivingCreate).toContain('addReceivingLine');
    expect(receivingCreate).toContain('Confirm/Post is still locked');
    expect(receivingCreate).not.toContain('postReceivingDocument');
    expect(receivingService).toContain('tgd_rpc_create_receiving_draft');
    expect(receivingService).toContain('tgd_rpc_add_receiving_line');
    expect(receivingService).not.toContain('tgd_rpc_confirm_receiving_document');
    expect(receivingService).not.toMatch(/\.insert\s*\(/);
    expect(receivingService).not.toMatch(/\.update\s*\(/);
    expect(receivingService).not.toMatch(/\.delete\s*\(/);
    expect(receivingService).not.toMatch(/\.upsert\s*\(/);
  });
});
