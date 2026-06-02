import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(__dirname, '../..');
const migrationPath = resolve(projectRoot, 'database/migrations/023_tgd_wms_receiving_add_line_location_rpc_patch.sql');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');
const receivingCreatePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');

function readProjectFile(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-AE receiving RPC service contract patch', () => {
  it('migration 023 exists', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('add line RPC signature includes p_location_id', () => {
    const sql = readProjectFile(migrationPath);
    expect(sql).toMatch(
      /tgd_rpc_add_receiving_line\s*\(\s*p_document_id\s+uuid,\s*p_product_id\s+uuid,\s*p_lot_id\s+uuid,\s*p_location_id\s+uuid,\s*p_quantity\s+numeric,\s*p_weight\s+numeric/i,
    );
  });

  it('old add line overload without p_location_id is revoked and dropped', () => {
    const sql = readProjectFile(migrationPath).toLowerCase();
    const oldSignature = 'public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric)';

    expect(sql).toContain(`revoke execute on function ${oldSignature} from public`);
    expect(sql).toContain(`revoke execute on function ${oldSignature} from anon`);
    expect(sql).toContain(`revoke execute on function ${oldSignature} from authenticated`);
    expect(sql).toContain(`drop function if exists ${oldSignature}`);
  });

  it('old add line overload is not recreated or granted after cleanup', () => {
    const sql = readProjectFile(migrationPath).toLowerCase();
    const newFunctionStart = sql.indexOf('create or replace function public.tgd_rpc_add_receiving_line');
    const newFunctionAndGrants = sql.slice(newFunctionStart);

    expect(newFunctionAndGrants).toContain(
      'public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric)',
    );
    expect(newFunctionAndGrants).not.toContain(
      'grant execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric)',
    );
  });

  it('function inserts location_id into tgd_receiving_lines', () => {
    const sql = readProjectFile(migrationPath);
    expect(sql).toMatch(/insert into public\.tgd_receiving_lines[\s\S]*location_id/i);
  });

  it('role checks exist in migration', () => {
    const sql = readProjectFile(migrationPath).toLowerCase();
    expect(sql).toContain('warehouse_manager');
    expect(sql).toContain('warehouse_staff');
    expect(sql).toContain('admin');
    expect(sql).toContain('auth_user_id');
    expect(sql).toContain('is_active');
  });

  it('status DRAFT check exists', () => {
    const sql = readProjectFile(migrationPath).toLowerCase();
    expect(sql).toContain("document must be in draft status");
  });

  it('customer isolation exists', () => {
    const sql = readProjectFile(migrationPath).toLowerCase();
    expect(sql).toContain('customer isolation');
    expect(sql).toContain('v_profile.customer_id');
  });

  it('migration grants execute only to authenticated and revokes public and anon', () => {
    const sql = readProjectFile(migrationPath).toLowerCase();

    expect(sql).toContain(
      'revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric) from public',
    );
    expect(sql).toContain(
      'revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric) from anon',
    );
    expect(sql).toContain(
      'grant execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric) to authenticated',
    );
    expect(sql).not.toContain('grant execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric) to public');
    expect(sql).not.toContain('grant execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric) to anon');
  });

  it('migration contains draft and production locked safety header', () => {
    const sql = readProjectFile(migrationPath);

    expect(sql).toContain('Draft only');
    expect(sql).toContain('Production locked');
    expect(sql).toContain('Receiving UI remains locked');
  });

  it('receivingService uses RPC-only for writes and no direct inserts/updates', () => {
    const service = readProjectFile(receivingServicePath);
    expect(service).toContain('tgd_rpc_add_receiving_line');
    expect(service).toContain('tgd_rpc_create_receiving_draft');
    expect(service).not.toMatch(/\.insert\s*\(/);
    expect(service).not.toMatch(/\.update\s*\(/);
    expect(service).not.toMatch(/\.delete\s*\(/);
    expect(service).not.toMatch(/\.upsert\s*\(/);
  });

  it('createReceivingDocument maps document_no to p_document_no and does not send p_reference', () => {
    const service = readProjectFile(receivingServicePath);

    expect(service).toContain("p_customer_id: input.customer_id");
    expect(service).toContain("p_document_no: input.document_no");
    expect(service).toContain('document_no is required');
    expect(service).not.toContain('p_reference');
  });

  it('addReceivingLine maps locationId to p_location_id', () => {
    const service = readProjectFile(receivingServicePath);

    expect(service).toContain('p_location_id: locationId');
  });

  it('postReceivingDocument contract name is present but controller-held', () => {
    const service = readProjectFile(receivingServicePath);
    expect(service).toMatch(/tgd_rpc_post_receiving_document/);
    expect(service).toContain('controller HOLD');
  });

  it('ReceivingCreatePage remains locked and no Save Draft', () => {
    const page = readProjectFile(receivingCreatePath);
    expect(page).toContain('Receiving Create Locked');
    expect(page).not.toMatch(/Save draft/i);
  });
});
