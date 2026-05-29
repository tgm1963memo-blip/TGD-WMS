import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/008_withdrawal_request_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');

describe('Sprint 3A withdrawal request foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const confirmFunctionSql = migrationSql.match(
    /create or replace function tgd_confirm_withdrawal_request[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates the withdrawal request foundation migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates withdrawal request document and line tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_withdrawal_requests');
    expect(migrationSql).toContain('create table if not exists tgd_withdrawal_request_lines');
  });

  it('defines status, withdrawal type, and priority constraints', () => {
    [
      'DRAFT',
      'CONFIRMED',
      'ALLOCATED',
      'PARTIALLY_ALLOCATED',
      'PICKING',
      'PICKED',
      'DISPATCHED',
      'CANCELLED',
      'CLOSED',
    ].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    [
      'NORMAL',
      'CUSTOMER_PICKUP',
      'DELIVERY',
      'RETURN_TO_CUSTOMER',
      'SAMPLE',
      'DAMAGE_DISPOSAL',
      'OTHER',
    ].forEach((withdrawalType) => {
      expect(migrationSql).toContain(`'${withdrawalType}'`);
    });

    ['LOW', 'NORMAL', 'HIGH', 'URGENT'].forEach((priority) => {
      expect(migrationSql).toContain(`'${priority}'`);
    });

    expect(migrationSql).toContain('constraint tgd_withdrawal_requests_status_check check');
    expect(migrationSql).toContain('constraint tgd_withdrawal_requests_type_check check');
    expect(migrationSql).toContain('constraint tgd_withdrawal_requests_priority_check check');
  });

  it('defines line quantity progression constraints', () => {
    expect(migrationSql).toContain('constraint tgd_withdrawal_request_lines_requested_qty_nonnegative check (requested_qty >= 0)');
    expect(migrationSql).toContain('constraint tgd_withdrawal_request_lines_allocated_qty_nonnegative check (allocated_qty >= 0)');
    expect(migrationSql).toContain('constraint tgd_withdrawal_request_lines_picked_qty_nonnegative check (picked_qty >= 0)');
    expect(migrationSql).toContain('constraint tgd_withdrawal_request_lines_dispatched_qty_nonnegative check (dispatched_qty >= 0)');
    expect(migrationSql).toContain('constraint tgd_withdrawal_request_lines_allocated_lte_requested check (allocated_qty <= requested_qty)');
    expect(migrationSql).toContain('constraint tgd_withdrawal_request_lines_picked_lte_allocated check (picked_qty <= allocated_qty)');
    expect(migrationSql).toContain('constraint tgd_withdrawal_request_lines_dispatched_lte_picked check (dispatched_qty <= picked_qty)');
  });

  it('creates the withdrawal request confirm function', () => {
    expect(migrationSql).toContain('create or replace function tgd_confirm_withdrawal_request');
    expect(confirmFunctionSql).toContain("v_request.status <> 'DRAFT'");
    expect(confirmFunctionSql).toContain('requested_qty <= 0');
    expect(confirmFunctionSql).toContain("set status = 'CONFIRMED'");
  });

  it('writes an audit log when confirming', () => {
    expect(confirmFunctionSql).toContain('tgd_write_audit_log');
    expect(confirmFunctionSql).toContain("'action', 'CONFIRM'");
  });

  it('does not post movements or update stock balances', () => {
    expect(confirmFunctionSql).not.toContain('tgd_post_inventory_movement');
    expect(migrationSql).not.toContain('PICK_ALLOCATE');
    expect(migrationSql).not.toContain('PICK_CONFIRM');
    expect(migrationSql).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(migrationSql).not.toMatch(/insert\s+into\s+tgd_stock_balances/i);
  });

  it('does not use outbound order or sales order table naming', () => {
    expect(migrationSql).not.toContain('tgd_outbound_orders');
    expect(migrationSql).not.toContain('tgd_outbound_order_lines');
    expect(migrationSql.toLowerCase()).not.toContain('sales_order');
    expect(migrationSql.toLowerCase()).not.toContain('sales order');
  });

  it('does not create allocation, picking, dispatch, or Express sync artifacts', () => {
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_.*allocation/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_picking/i);
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_dispatch/i);
    expect(statSync(expressSyncPath).isDirectory()).toBe(true);
  });

  it('does not rely on legacy-reference content', () => {
    expect(statSync(legacyReferencePath).isDirectory()).toBe(true);
    expect(migrationSql).not.toContain('legacy-reference');
    expect(migrationSql).not.toContain('express');
  });
});

