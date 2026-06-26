// tests/unit/receiving-real-stock-posting-migration-draft.test.js
// Sprint 13J-O: Receiving Real Stock Posting Migration Draft tests.

describe('Sprint 13J-O Receiving Real Stock Posting Migration Draft', () => {
  const fs = require('fs');
  const path = require('path');

  const migrationPath = path.resolve(
    __dirname,
    '../../database/migrations/020_tgd_wms_receiving_real_stock_posting_draft.sql'
  );

  test('migration draft file exists', () => {
    expect(fs.existsSync(migrationPath)).toBeTruthy();
  });

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const lower = sql.toLowerCase();

  // --- A. Safety header ---

  test('contains safety header with Production locked', () => {
    expect(lower).toContain('production locked');
  });

  test('contains safety header with draft only', () => {
    expect(lower).toContain('draft only');
  });

  test('contains Receiving UI remains locked', () => {
    expect(lower).toContain('receiving ui remains locked');
  });

  test('contains Frontend direct writes prohibited', () => {
    expect(lower).toContain('frontend direct');
  });

  // --- B. Schema additions ---

  test('contains add location_id to receiving_lines', () => {
    expect(lower).toContain('location_id');
    expect(lower).toContain('tgd_receiving_lines');
    expect(lower).toContain('add column location_id');
  });

  test('contains source_module column addition', () => {
    expect(lower).toContain('source_module');
    expect(lower).toContain("add column source_module");
  });

  test('contains source_document_id column addition', () => {
    expect(lower).toContain('source_document_id');
    expect(lower).toContain("add column source_document_id");
  });

  test('contains source_line_id column addition', () => {
    expect(lower).toContain('source_line_id');
    expect(lower).toContain("add column source_line_id");
  });

  // --- C. Duplicate guard ---

  test('contains unique duplicate guard index', () => {
    expect(lower).toContain('create unique index');
    expect(lower).toContain('source_module');
    expect(lower).toContain('source_document_id');
    expect(lower).toContain('source_line_id');
    // Partial index condition
    expect(lower).toContain('where source_module is not null');
  });

  // --- D. Dry-run RPC ---

  test('contains tgd_rpc_post_receiving_document_dry', () => {
    expect(lower).toContain('tgd_rpc_post_receiving_document_dry');
  });

  test('dry RPC returns jsonb', () => {
    // Match the function signature returning jsonb
    const dryRpcMatch = sql.match(
      /tgd_rpc_post_receiving_document_dry[\s\S]*?returns\s+jsonb/i
    );
    expect(dryRpcMatch).not.toBeNull();
  });

  test('dry RPC does NOT insert/update/delete into stock_movements or receiving_documents', () => {
    // Extract the dry-run function body
    const drySection = sql.match(
      /tgd_rpc_post_receiving_document_dry[\s\S]*?\$\$;/i
    );
    expect(drySection).not.toBeNull();
    if (drySection) {
      const dryBody = drySection[0];
      const dryLines = dryBody.split('\n');
      // No line should be an actual INSERT INTO tgd_stock_movements statement
      // (comments like "-- No insert into tgd_stock_movements" are OK)
      const insertLines = dryLines.filter(l =>
        l.match(/^\s*insert\s+into/i) && l.toLowerCase().includes('tgd_stock_movements')
      );
      expect(insertLines).toHaveLength(0);
      // No line should be an actual UPDATE tgd_receiving_documents statement
      const updateLines = dryLines.filter(l =>
        l.match(/^\s*update/i) && l.toLowerCase().includes('tgd_receiving_documents')
      );
      expect(updateLines).toHaveLength(0);
      // No line should be an actual DELETE FROM statement
      const deleteLines = dryLines.filter(l =>
        l.match(/^\s*delete\s+from/i)
      );
      expect(deleteLines).toHaveLength(0);
      // Should contain a comment confirming no writes
      expect(dryBody.toLowerCase()).toContain('no insert');
    }
  });

  // --- E. Post RPC ---

  test('contains tgd_rpc_post_receiving_document function', () => {
    expect(lower).toContain('tgd_rpc_post_receiving_document');
  });

  test('post RPC uses FOR UPDATE', () => {
    // Extract the post RPC body (the second function definition)
    const postMatch = sql.match(
      /function\s+public\.tgd_rpc_post_receiving_document\s*\(/i
    );
    expect(postMatch).not.toBeNull();
    // Find FOR UPDATE within the post RPC section
    const postSection = sql.substring(postMatch.index);
    expect(postSection.toLowerCase()).toContain('for update');
  });

  test('post RPC uses advisory lock', () => {
    expect(lower).toContain('pg_advisory_xact_lock');
  });

  test('post RPC validates auth.uid()', () => {
    expect(lower).toContain('auth.uid()');
  });

  test('post RPC validates admin / warehouse_manager', () => {
    expect(lower).toContain("'admin'");
    expect(lower).toContain("'warehouse_manager'");
  });

  test('post RPC validates customer isolation', () => {
    expect(lower).toContain('customer isolation');
  });

  test('post RPC validates line product_id, lot_id, location_id, quantity', () => {
    const postSection = sql.match(
      /function\s+public\.tgd_rpc_post_receiving_document\s*\([\s\S]*?\$\$;/i
    );
    expect(postSection).not.toBeNull();
    if (postSection) {
      const body = postSection[0].toLowerCase();
      expect(body).toContain('product_id is null');
      expect(body).toContain('lot_id is null');
      expect(body).toContain('location_id is null');
      expect(body).toContain('quantity');
    }
  });

  test('post RPC inserts into tgd_stock_movements', () => {
    expect(lower).toContain('insert into public.tgd_stock_movements');
  });

  test('post RPC uses to_location_id', () => {
    const postSection = sql.match(
      /function\s+public\.tgd_rpc_post_receiving_document\s*\([\s\S]*?\$\$;/i
    );
    expect(postSection).not.toBeNull();
    if (postSection) {
      expect(postSection[0].toLowerCase()).toContain('to_location_id');
    }
  });

  test('post RPC uses actual receiving line columns only', () => {
    const postSection = sql.match(
      /function\s+public\.tgd_rpc_post_receiving_document\s*\([\s\S]*?\$\$;/i
    );
    expect(postSection).not.toBeNull();
    if (postSection) {
      const body = postSection[0].toLowerCase();
      expect(body).toContain('l.document_id');
      expect(body).toContain('l.quantity');
      expect(body).not.toContain('receiving_document_id');
      expect(body).not.toContain('received_qty');
    }
  });

  test('post RPC uses movement_type RECEIVE_CONFIRM', () => {
    expect(lower).toContain("'receive_confirm'");
  });

  test('post RPC sets movement_date for stock movement insert', () => {
    const postSection = sql.match(
      /function\s+public\.tgd_rpc_post_receiving_document\s*\([\s\S]*?\$\$;/i
    );
    expect(postSection).not.toBeNull();
    if (postSection) {
      const body = postSection[0].toLowerCase();
      expect(body).toContain('movement_date');
      expect(body).toMatch(/movement_type,\s*movement_date,\s*related_document_id/);
      expect(body).toMatch(/'receive_confirm',\s*now\(\),\s*p_document_id/);
    }
  });

  test('post RPC avoids confirmed_at because staging document table does not have it', () => {
    expect(lower).not.toContain('confirmed_at');
  });

  test('post RPC updates receiving document status only AFTER insert section', () => {
    // The UPDATE tgd_receiving_documents must come AFTER the INSERT INTO tgd_stock_movements loop
    const insertPos = lower.indexOf('insert into public.tgd_stock_movements');
    const updatePos = lower.lastIndexOf('update public.tgd_receiving_documents');
    expect(insertPos).toBeGreaterThan(-1);
    expect(updatePos).toBeGreaterThan(-1);
    expect(updatePos).toBeGreaterThan(insertPos);
  });

  test('post RPC does NOT directly update tgd_stock_balances', () => {
    // Extract post RPC body only
    const postSection = sql.match(
      /function\s+public\.tgd_rpc_post_receiving_document\s*\([\s\S]*?\$\$;/i
    );
    expect(postSection).not.toBeNull();
    if (postSection) {
      const body = postSection[0];
      const bodyLines = body.split('\n');
      // No line should be an actual INSERT INTO tgd_stock_balances statement
      const balInsert = bodyLines.filter(l =>
        l.match(/^\s*insert\s+into/i) && l.toLowerCase().includes('tgd_stock_balances')
      );
      expect(balInsert).toHaveLength(0);
      // No line should be an actual UPDATE tgd_stock_balances statement
      const balUpdate = bodyLines.filter(l =>
        l.match(/^\s*update/i) && l.toLowerCase().includes('tgd_stock_balances')
      );
      expect(balUpdate).toHaveLength(0);
    }
  });

  // --- F. Grants ---

  test('grants execute only to authenticated', () => {
    expect(lower).toContain('grant execute on function public.tgd_rpc_post_receiving_document_dry(uuid) to authenticated');
    expect(lower).toContain('grant execute on function public.tgd_rpc_post_receiving_document(uuid) to authenticated');
  });

  test('revokes execute from public', () => {
    expect(lower).toContain('revoke execute');
    expect(lower).toContain('from public');
  });

  test('revokes execute from anon and does not grant execute to public or anon', () => {
    expect(lower).toContain('revoke execute on function public.tgd_rpc_post_receiving_document_dry(uuid) from anon');
    expect(lower).toContain('revoke execute on function public.tgd_rpc_post_receiving_document(uuid) from anon');
    expect(lower).not.toContain('grant execute on function public.tgd_rpc_post_receiving_document_dry(uuid) to public');
    expect(lower).not.toContain('grant execute on function public.tgd_rpc_post_receiving_document(uuid) to public');
    expect(lower).not.toContain('grant execute on function public.tgd_rpc_post_receiving_document_dry(uuid) to anon');
    expect(lower).not.toContain('grant execute on function public.tgd_rpc_post_receiving_document(uuid) to anon');
  });

  // --- G. Safety: no frontend changes ---

  test('ReceivingDetailPage uses controlled post wrapper and avoids direct writes', () => {
    expect(lower).not.toContain('receivingdetailpage');
    const pagePath = path.resolve(__dirname, '../../src/features/operations/receiving/ReceivingDetailPage.jsx');
    const page = fs.readFileSync(pagePath, 'utf8');
    expect(page).toContain('Confirm/Post Receiving');
    expect(page).toContain('postReceivingDocument');
    expect(page).toContain('No stock movement until Confirm/Post');
    expect(page).not.toContain('tgd_rpc_post_receiving_document');
    expect(page).not.toMatch(/\.insert\s*\(/);
    expect(page).not.toMatch(/\.update\s*\(/);
  });

  test('receivingService.js remains free of direct table write methods', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/receivingService.js');
    if (fs.existsSync(servicePath)) {
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      expect(serviceContent).not.toMatch(/\.insert\s*\(/);
      expect(serviceContent).not.toMatch(/\.update\s*\(/);
      expect(serviceContent).not.toMatch(/\.delete\s*\(/);
      expect(serviceContent).not.toMatch(/\.upsert\s*\(/);
    }
  });

  // --- H. Non-goals ---

  test('contains explicit non-goals comments', () => {
    expect(lower).toContain('no ui enable');
    expect(lower).toContain('no production apply');
    expect(lower).toContain('no direct frontend table writes');
  });
});
