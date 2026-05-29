import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/010_picking_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');

describe('Sprint 3C picking foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const confirmFunctionSql = migrationSql.match(
    /create or replace function tgd_confirm_picking_document[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates the picking foundation migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates picking document and line tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_picking_documents');
    expect(migrationSql).toContain('create table if not exists tgd_picking_lines');
  });

  it('defines picking status and method constraints', () => {
    ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'PICKED', 'CANCELLED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    ['MANUAL', 'FIFO', 'FEFO', 'HANDHELD_SCAN', 'SYSTEM_SUGGESTED'].forEach((method) => {
      expect(migrationSql).toContain(`'${method}'`);
    });

    expect(migrationSql).toContain('constraint tgd_picking_documents_status_check check');
    expect(migrationSql).toContain('constraint tgd_picking_documents_method_check check');
  });

  it('defines quantity and variance constraints', () => {
    expect(migrationSql).toContain('constraint tgd_picking_lines_allocated_qty_nonnegative check (allocated_qty >= 0)');
    expect(migrationSql).toContain('constraint tgd_picking_lines_picked_qty_nonnegative check (picked_qty >= 0)');
    expect(migrationSql).toContain('constraint tgd_picking_lines_picked_lte_allocated check (picked_qty <= allocated_qty)');
    expect(migrationSql).toContain('constraint tgd_picking_lines_variance_matches_qty check (variance_qty = allocated_qty - picked_qty)');
  });

  it('creates the picking confirm function', () => {
    expect(migrationSql).toContain('create or replace function tgd_confirm_picking_document');
    expect(confirmFunctionSql).toContain('picked_qty < 0');
    expect(confirmFunctionSql).toContain('picked_qty > allocated_qty');
  });

  it('updates picking lines and withdrawal request line picked quantities', () => {
    expect(confirmFunctionSql).toContain('variance_qty = allocated_qty - picked_qty');
    expect(confirmFunctionSql).toContain('update tgd_withdrawal_request_lines request_line');
    expect(confirmFunctionSql).toContain('sum(picking_line.picked_qty) as picked_qty');
    expect(confirmFunctionSql).toContain('picked_qty > allocated_qty');
  });

  it('updates withdrawal request status to PICKING or PICKED', () => {
    expect(confirmFunctionSql).toContain('update tgd_withdrawal_requests');
    expect(confirmFunctionSql).toContain("then 'PICKED'");
    expect(confirmFunctionSql).toContain("then 'PICKING'");
  });

  it('writes an audit log when confirming picking', () => {
    expect(confirmFunctionSql).toContain('tgd_write_audit_log');
    expect(confirmFunctionSql).toContain("'action', 'CONFIRM_PICKING'");
  });

  it('does not post movements, confirm picking movement, or update stock balances', () => {
    expect(confirmFunctionSql).not.toContain('tgd_post_inventory_movement');
    expect(migrationSql).not.toContain('PICK_CONFIRM');
    expect(migrationSql).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(migrationSql).not.toMatch(/insert\s+into\s+tgd_stock_balances/i);
  });

  it('does not create dispatch, outbound order, or sales order artifacts', () => {
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_dispatch/i);
    expect(migrationSql).not.toContain('tgd_outbound_orders');
    expect(migrationSql).not.toContain('tgd_outbound_order_lines');
    expect(migrationSql.toLowerCase()).not.toContain('sales_order');
    expect(migrationSql.toLowerCase()).not.toContain('sales order');
  });

  it('does not create Express sync artifacts or rely on legacy-reference content', () => {
    expect(statSync(expressSyncPath).isDirectory()).toBe(true);
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
    expect(migrationSql).not.toContain('express');
  });
});

