import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Sprint 13J-AQ Receiving Audit RPC Patch', () => {
  const migrationPath = path.resolve(process.cwd(), 'database/migrations/024_tgd_wms_receiving_audit_rpc_patch.sql');

  it('migration 024 exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('migration patches create RPC with created_by = v_profile.id', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    const createRpc = source.match(/create or replace function public\.tgd_rpc_create_receiving_draft[\s\S]*?\$\$;/i)[0];
    
    expect(createRpc).toMatch(/insert into public\.tgd_receiving_documents[^;]*created_by/i);
    expect(createRpc).toMatch(/v_profile\.id/i);
  });

  it('migration patches post RPC with posted_by = v_profile.id and posted_at', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    const postRpc = source.match(/create or replace function public\.tgd_rpc_post_receiving_document[\s\S]*?\$\$;/i)[0];
    
    expect(postRpc).toMatch(/update public\.tgd_receiving_documents\s+set[^;]*posted_by\s*=\s*v_profile\.id/i);
    expect(postRpc).toMatch(/posted_at\s*=\s*now\(\)/i);
  });

  it('migration inserts stock movement created_by = v_profile.id', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    const postRpc = source.match(/create or replace function public\.tgd_rpc_post_receiving_document[\s\S]*?\$\$;/i)[0];
    const insertMovement = postRpc.match(/insert into public\.tgd_stock_movements[\s\S]*?\);/i)[0];
    
    expect(insertMovement).toMatch(/created_by/i);
    expect(insertMovement).toMatch(/v_profile\.id/i);
  });

  it('migration preserves source_document_id and source_line_id', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    const postRpc = source.match(/create or replace function public\.tgd_rpc_post_receiving_document[\s\S]*?\$\$;/i)[0];
    const insertMovement = postRpc.match(/insert into public\.tgd_stock_movements[\s\S]*?\);/i)[0];
    
    expect(insertMovement).toMatch(/source_document_id/i);
    expect(insertMovement).toMatch(/source_line_id/i);
    expect(insertMovement).toMatch(/p_document_id/i);
    expect(insertMovement).toMatch(/v_line\.id/i);
  });

  it('migration preserves RECEIVE_CONFIRM', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    expect(source).toContain("'RECEIVE_CONFIRM'");
  });

  it('migration does not manually update stock_balances', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    expect(source).not.toMatch(/update public\.tgd_stock_balances/i);
    expect(source).not.toMatch(/insert into public\.tgd_stock_balances/i);
  });

  it('migration does not grant anon execute', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    expect(source).not.toMatch(/grant execute on function[^;]*to anon/i);
    expect(source).not.toMatch(/grant execute on function[^;]*to public/i);
  });
});
