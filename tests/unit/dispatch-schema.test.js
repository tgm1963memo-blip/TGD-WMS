import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/011_dispatch_goods_issue_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');

describe('Sprint 3D dispatch goods issue foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const postFunctionSql = migrationSql.match(
    /create or replace function tgd_post_dispatch_document[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates the dispatch goods issue foundation migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates dispatch document and line tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_dispatch_documents');
    expect(migrationSql).toContain('create table if not exists tgd_dispatch_lines');
  });

  it('defines dispatch status, type, and transport constraints', () => {
    ['DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    ['NORMAL', 'CUSTOMER_PICKUP', 'DELIVERY', 'RETURN_TO_CUSTOMER', 'SAMPLE', 'DAMAGE_DISPOSAL', 'OTHER'].forEach((type) => {
      expect(migrationSql).toContain(`'${type}'`);
    });

    ['COMPANY_TRUCK', 'CUSTOMER_PICKUP', 'THIRD_PARTY', 'OTHER'].forEach((transportType) => {
      expect(migrationSql).toContain(`'${transportType}'`);
    });

    expect(migrationSql).toContain('constraint tgd_dispatch_documents_status_check check');
    expect(migrationSql).toContain('constraint tgd_dispatch_documents_type_check check');
    expect(migrationSql).toContain('constraint tgd_dispatch_documents_transport_type_check check');
  });

  it('creates the dispatch post function', () => {
    expect(migrationSql).toContain('create or replace function tgd_post_dispatch_document');
    expect(postFunctionSql).toContain('dispatch_qty <= 0');
    expect(postFunctionSql).toContain('dispatch_qty > picked_qty');
  });

  it('posts through the movement engine as PICK_CONFIRM', () => {
    expect(postFunctionSql).toContain('tgd_post_inventory_movement');
    expect(postFunctionSql).toContain("'movement_type', 'PICK_CONFIRM'");
    expect(postFunctionSql).toContain("'reference_type', 'DISPATCH'");
    expect(postFunctionSql).toContain('movement_id = v_movement_id');
  });

  it('updates withdrawal request line dispatched quantities', () => {
    expect(postFunctionSql).toContain('update tgd_withdrawal_request_lines request_line');
    expect(postFunctionSql).toContain('sum(dispatch_line.dispatch_qty) as dispatched_qty');
    expect(postFunctionSql).toContain('dispatched_qty > picked_qty');
  });

  it('updates withdrawal request status after dispatch', () => {
    expect(postFunctionSql).toContain('update tgd_withdrawal_requests');
    expect(postFunctionSql).toContain("then 'DISPATCHED'");
    expect(postFunctionSql).toContain("then 'PICKED'");
  });

  it('writes an audit log when posting dispatch', () => {
    expect(postFunctionSql).toContain('tgd_write_audit_log');
    expect(postFunctionSql).toContain("'action', 'POST'");
  });

  it('does not directly update stock balances or allocate stock', () => {
    expect(postFunctionSql).not.toContain('PICK_ALLOCATE');
    expect(migrationSql).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(migrationSql).not.toMatch(/insert\s+into\s+tgd_stock_balances/i);
  });

  it('does not create outbound order, sales order, invoice, or billing artifacts', () => {
    expect(migrationSql).not.toContain('tgd_outbound_orders');
    expect(migrationSql).not.toContain('tgd_outbound_order_lines');
    expect(migrationSql.toLowerCase()).not.toContain('sales_order');
    expect(migrationSql.toLowerCase()).not.toContain('sales order');
    expect(migrationSql.toLowerCase()).not.toContain('invoice');
    expect(migrationSql.toLowerCase()).not.toContain('billing');
  });

  it('does not create Express sync artifacts or rely on legacy-reference content', () => {
    expect(statSync(expressSyncPath).isDirectory()).toBe(true);
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
    expect(migrationSql).not.toContain('express');
  });
});

