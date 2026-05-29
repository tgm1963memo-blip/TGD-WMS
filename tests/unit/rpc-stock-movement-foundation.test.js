// rpc-stock-movement-foundation.test.js
// Validation tests for RPC Stock Movement Foundation files and content.

import { expect, test, describe } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../');

const docPath = path.join(projectRoot, 'docs', 'database', 'rpc-stock-movement-foundation.md');
const sqlPath = path.join(projectRoot, 'database', 'rpc', '005_tgd_wms_rpc_stock_movement_foundation.sql');
const readmePath = path.join(projectRoot, 'database', 'rpc', 'README.md');

// Helper to load file content as string.
function loadFile(p) {
  return readFileSync(p, { encoding: 'utf8' });
}

describe('RPC Stock Movement Foundation files existence', () => {
  test('Documentation file exists', () => {
    expect(docPath).toBeTruthy();
    const content = loadFile(docPath);
    expect(content.length).toBeGreaterThan(0);
  });

  test('SQL foundation file exists', () => {
    expect(sqlPath).toBeTruthy();
    const content = loadFile(sqlPath);
    expect(content.length).toBeGreaterThan(0);
  });

  test('README file exists', () => {
    expect(readmePath).toBeTruthy();
    const content = loadFile(readmePath);
    expect(content.length).toBeGreaterThan(0);
  });
});

describe('SQL content validation', () => {
  const sql = loadFile(sqlPath);

  test('Contains CREATE OR REPLACE FUNCTION', () => {
    expect(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(sql)).toBeTruthy();
  });

  test('Base function name present', () => {
    expect(/tgd_rpc_create_stock_movement\s*\(/i.test(sql)).toBeTruthy();
  });

  test('References auth.uid()', () => {
    expect(/auth\.uid\(\)/i.test(sql)).toBeTruthy();
  });

  test('References tgd_user_profiles and is_active = true', () => {
    expect(/tgd_user_profiles.*is_active\s*=\s*true/i.test(sql)).toBeTruthy();
  });

  test('References tgd_stock_movements', () => {
    expect(/tgd_stock_movements/i.test(sql)).toBeTruthy();
  });

  test('References tgd_audit_logs (placeholder comment allowed)', () => {
    // Look for audit log comment
    expect(/tgd_audit_logs/i.test(sql)).toBeTruthy();
  });

  const movementTypes = [
    'RECEIVE_CONFIRM',
    'PUTAWAY_CONFIRM',
    'TRANSFER_CONFIRM',
    'ADJUSTMENT_CONFIRM',
    'PICK_ALLOCATE',
    'PICK_CONFIRM',
    'DISPATCH_CONFIRM',
  ];
  movementTypes.forEach((type) => {
    test(`Movement type ${type} present`, () => {
      expect(new RegExp(type, 'i').test(sql)).toBeTruthy();
    });
  });

  const roles = ['admin', 'warehouse_manager', 'warehouse_staff'];
  roles.forEach((role) => {
    test(`Role check for ${role}`, () => {
      expect(new RegExp(role, 'i').test(sql)).toBeTruthy();
    });
  });

  test('No UPDATE/INSERT/DELETE on tgd_stock_balances', () => {
    expect(/\bUPDATE\s+tgd_stock_balances\b/i.test(sql)).toBeFalsy();
    expect(/\bINSERT\s+INTO\s+tgd_stock_balances\b/i.test(sql)).toBeFalsy();
    expect(/\bDELETE\s+FROM\s+tgd_stock_balances\b/i.test(sql)).toBeFalsy();
  });

  test('Contains comment about deferred stock‑balance update', () => {
    expect(/deferred.*stock[-_]balance.*update/i.test(sql)).toBeTruthy();
  });

  test('No CREATE TRIGGER statements', () => {
    expect(/CREATE\s+TRIGGER/i.test(sql)).toBeFalsy();
  });

  test('No service_role key usage', () => {
    expect(/service_role/i.test(sql)).toBeFalsy();
  });

  test('No forbidden business terms', () => {
    const forbidden = [
      'sales_order',
      'sales_orders',
      'so_',
      'outbound_orders',
      'invoice',
      'invoice_lines',
    ];
    forbidden.forEach((word) => {
      expect(new RegExp(word, 'i').test(sql)).toBeFalsy();
    });
  });
});

describe('Documentation content validation', () => {
  const doc = loadFile(docPath);

  test('Document states movement ledger is source of truth', () => {
    expect(/movement ledger.*source of truth/i.test(doc)).toBeTruthy();
  });

  test('Document states stock balance is a controlled snapshot', () => {
    expect(/stock balance.*controlled snapshot/i.test(doc)).toBeTruthy();
  });

  test('Document blocks direct frontend stock balance update', () => {
    expect(/direct.*stock balance.*update.*prohibited/i.test(doc)).toBeTruthy();
  });

  test('Prepared‑only warning present', () => {
    expect(/prepared only/i.test(doc)).toBeTruthy();
  });
});
