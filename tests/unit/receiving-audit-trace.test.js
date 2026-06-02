import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Sprint 13J-AP Receiving Audit / Trace Review', () => {
  it('identifies audit fields on receiving documents schema', () => {
    const migrationPath = path.resolve(process.cwd(), 'database/migrations/004_receiving_foundation.sql');
    const source = fs.readFileSync(migrationPath, 'utf8');

    expect(source).toContain('created_by uuid references tgd_user_profiles(id)');
    expect(source).toContain('created_at timestamptz');
    expect(source).toContain('updated_at timestamptz');
    expect(source).toContain('posted_by uuid references tgd_user_profiles(id)');
    expect(source).toContain('posted_at timestamptz');
  });

  it('verifies tgd_stock_movements contains trace fields from migration 020', () => {
    const migrationPath = path.resolve(process.cwd(), 'database/migrations/020_tgd_wms_receiving_real_stock_posting_draft.sql');
    const source = fs.readFileSync(migrationPath, 'utf8');

    expect(source).toContain('add column source_module text;');
    expect(source).toContain('add column source_document_id uuid;');
    expect(source).toContain('add column source_line_id uuid;');
  });

  it('verifies post RPC applies trace fields correctly', () => {
    const migrationPath = path.resolve(process.cwd(), 'database/migrations/020_tgd_wms_receiving_real_stock_posting_draft.sql');
    const source = fs.readFileSync(migrationPath, 'utf8');

    expect(source).toContain('source_module,');
    expect(source).toContain('source_document_id,');
    expect(source).toContain('source_line_id,');
    expect(source).toContain("'RECEIVING',");
    expect(source).toContain('p_document_id,');
    expect(source).toContain('v_line.id,');
  });

  it('notes audit gaps in RPC implementations', () => {
    const rpc018 = fs.readFileSync(path.resolve(process.cwd(), 'database/migrations/018_tgd_wms_receiving_rpc_contract.sql'), 'utf8');
    const rpc020 = fs.readFileSync(path.resolve(process.cwd(), 'database/migrations/020_tgd_wms_receiving_real_stock_posting_draft.sql'), 'utf8');

    // Gap: tgd_rpc_create_receiving_draft does not insert created_by
    expect(rpc018).not.toMatch(/insert into public\.tgd_receiving_documents \([^)]*created_by/i);

    // Gap: tgd_rpc_post_receiving_document does not update posted_by/posted_at
    expect(rpc020).not.toMatch(/update public\.tgd_receiving_documents\s+set[^;]*posted_by\s*=/i);

    // Gap: tgd_rpc_post_receiving_document does not insert created_by in stock movements
    const insertMovementBlock = rpc020.match(/insert into public\.tgd_stock_movements[^(]*\(([^)]*)\)/i)[1];
    expect(insertMovementBlock).not.toContain('created_by');
  });

  it('ensures no direct UI mutations (DML) are used for stock posting', () => {
    const servicePath = path.resolve(process.cwd(), 'src/services/receivingService.js');
    const serviceSrc = fs.readFileSync(servicePath, 'utf8');
    
    expect(serviceSrc).toContain("supabase.rpc('tgd_rpc_post_receiving_document'");
    expect(serviceSrc).not.toContain("supabase.from('tgd_stock_movements').insert");
    expect(serviceSrc).not.toContain("supabase.from('tgd_receiving_documents').update");
  });
});
