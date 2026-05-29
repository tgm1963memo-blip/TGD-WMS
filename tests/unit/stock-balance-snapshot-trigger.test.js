// stock-balance-snapshot-trigger.test.js
// Validation tests for Stock Balance Snapshot & Trigger design.

import { expect, test, describe } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../');

const docPath = path.join(projectRoot, 'docs', 'database', 'stock-balance-snapshot-trigger.md');
const sqlPath = path.join(projectRoot, 'database', 'triggers', '006_tgd_wms_stock_balance_snapshot_trigger.sql');

function load(p) {
  return readFileSync(p, { encoding: 'utf8' });
}

describe('File existence', () => {
  test('Documentation exists', () => {
    expect(docPath).toBeTruthy();
    expect(load(docPath).length).toBeGreaterThan(0);
  });
  test('SQL file exists', () => {
    expect(sqlPath).toBeTruthy();
    expect(load(sqlPath).length).toBeGreaterThan(0);
  });
});

describe('SQL content validation', () => {
  const sql = load(sqlPath);

  test('Contains SET search_path to public', () => {
    expect(/SET\s+search_path\s*=\s*public/i.test(sql)).toBeTruthy();
  });

  test('Trigger function defined with SECURITY DEFINER', () => {
    expect(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.tgd_trigger_update_stock_balance\s*\([^)]*\)\s+RETURNS\s+trigger\s+AS\s+\$\$[\s\S]*LANGUAGE\s+plpgsql\s+SECURITY\s+DEFINER/i.test(sql)).toBeTruthy();
  });

  test('Contains UPSERT (INSERT ... ON CONFLICT)', () => {
    expect(/INSERT\s+INTO\s+tgd_stock_balances[\s\S]*ON\s+CONFLICT\s*\(.*\)\s+DO\s+UPDATE/i.test(sql)).toBeTruthy();
  });

  test('Creates AFTER INSERT trigger on tgd_stock_movements', () => {
    expect(/CREATE\s+TRIGGER\s+tgd_after_insert_stock_movement[\s\S]*AFTER\s+INSERT\s+ON\s+tgd_stock_movements/i.test(sql)).toBeTruthy();
  });

  test('No auth.uid() checks in trigger function', () => {
    expect(/auth\.uid\(\)/i.test(sql)).toBeFalsy();
  });

  test('No service_role key usage', () => {
    expect(/service_role/i.test(sql)).toBeFalsy();
  });

  test('Prepared‑only warning present', () => {
    expect(/Prepared only/i.test(sql)).toBeTruthy();
  });
});

describe('Documentation content validation', () => {
  const doc = load(docPath);
  test('Mentions controlled snapshot principle', () => {
    expect(/controlled snapshot/i.test(doc)).toBeTruthy();
  });
  test('Mentions trigger design and AFTER INSERT', () => {
    expect(/AFTER INSERT trigger/i.test(doc)).toBeTruthy();
  });
  test('Prepared‑only warning present', () => {
    expect(/Prepared only/i.test(doc)).toBeTruthy();
  });
});
