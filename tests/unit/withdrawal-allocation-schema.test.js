import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/009_withdrawal_allocation_foundation.sql');
const legacyReferencePath = resolve(projectRoot, 'legacy-reference');
const expressSyncPath = resolve(projectRoot, 'integrations/express/sync');

describe('Sprint 3B withdrawal allocation foundation schema', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const postFunctionSql = migrationSql.match(
    /create or replace function tgd_post_withdrawal_allocation[\s\S]+?\n\$\$;/i,
  )?.[0] ?? '';

  it('creates the withdrawal allocation foundation migration file', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('creates withdrawal allocation document and line tables', () => {
    expect(migrationSql).toContain('create table if not exists tgd_withdrawal_allocations');
    expect(migrationSql).toContain('create table if not exists tgd_withdrawal_allocation_lines');
  });

  it('defines status and allocation method constraints', () => {
    ['DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED'].forEach((status) => {
      expect(migrationSql).toContain(`'${status}'`);
    });

    ['MANUAL', 'FIFO', 'FEFO', 'SYSTEM_SUGGESTED'].forEach((method) => {
      expect(migrationSql).toContain(`'${method}'`);
    });

    expect(migrationSql).toContain('constraint tgd_withdrawal_allocations_status_check check');
    expect(migrationSql).toContain('constraint tgd_withdrawal_allocations_method_check check');
  });

  it('creates the withdrawal allocation post function', () => {
    expect(migrationSql).toContain('create or replace function tgd_post_withdrawal_allocation');
    expect(postFunctionSql).toContain('allocated_qty <= 0');
    expect(postFunctionSql).toContain("v_request.status not in ('CONFIRMED', 'PARTIALLY_ALLOCATED')");
  });

  it('posts through the movement engine as PICK_ALLOCATE', () => {
    expect(postFunctionSql).toContain('tgd_post_inventory_movement');
    expect(postFunctionSql).toContain("'movement_type', 'PICK_ALLOCATE'");
    expect(postFunctionSql).toContain("'reference_type', 'WITHDRAWAL_ALLOCATION'");
    expect(postFunctionSql).toContain('movement_id = v_movement_id');
  });

  it('updates withdrawal request line allocated quantities', () => {
    expect(postFunctionSql).toContain('update tgd_withdrawal_request_lines request_line');
    expect(postFunctionSql).toContain('sum(allocation_line.allocated_qty) as allocated_qty');
    expect(postFunctionSql).toContain('allocated_qty > requested_qty');
  });

  it('updates withdrawal request status after allocation', () => {
    expect(postFunctionSql).toContain('update tgd_withdrawal_requests');
    expect(postFunctionSql).toContain("then 'ALLOCATED'");
    expect(postFunctionSql).toContain("then 'PARTIALLY_ALLOCATED'");
  });

  it('writes an audit log when posting', () => {
    expect(postFunctionSql).toContain('tgd_write_audit_log');
    expect(postFunctionSql).toContain("'action', 'POST'");
  });

  it('does not reduce stock or confirm picking', () => {
    expect(postFunctionSql).not.toContain('PICK_CONFIRM');
    expect(migrationSql).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(migrationSql).not.toMatch(/insert\s+into\s+tgd_stock_balances/i);
  });

  it('does not create picking, dispatch, outbound order, or sales order artifacts', () => {
    expect(migrationSql).not.toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?tgd_picking/i);
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

