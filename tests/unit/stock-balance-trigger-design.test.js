// stock-balance-trigger-design.test.js
import { expect, test, describe } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../');

const docPath = path.join(projectRoot, 'docs', 'database', 'stock-balance-trigger-design.md');
const sqlPath = path.join(projectRoot, 'database', 'triggers', '006_tgd_wms_stock_balance_trigger_design.sql');
const readmePath = path.join(projectRoot, 'database', 'triggers', 'README.md');

function load(p) { return readFileSync(p, { encoding: 'utf8' }); }

describe('File existence', () => {
  test('Documentation exists', () => {
    expect(docPath).toBeTruthy();
    expect(load(docPath).length).toBeGreaterThan(0);
  });
  test('SQL file exists', () => {
    expect(sqlPath).toBeTruthy();
    expect(load(sqlPath).length).toBeGreaterThan(0);
  });
  test('README exists', () => {
    expect(readmePath).toBeTruthy();
    expect(load(readmePath).length).toBeGreaterThan(0);
  });
});

describe('SQL content validation', () => {
  const sql = load(sqlPath);
  test('Contains SET search_path to public', () => {
    expect(/SET\s+search_path\s*=\s*public/i.test(sql)).toBeTruthy();
  });
  test('Function uses SECURITY DEFINER', () => {
    expect(/SECURITY\s+DEFINER/i.test(sql)).toBeTruthy();
  });
  test('UPSERT uses product_id, lot_id, location_id', () => {
    expect(/INSERT\s+INTO\s+tgd_stock_balances[\s\S]*product_id[\s\S]*lot_id[\s\S]*location_id/i.test(sql)).toBeTruthy();
  });
  test('No item_id usage', () => {
    expect(/item_id/i.test(sql)).toBeFalsy();
  });
  test('Prepared only warning present', () => {
    expect(/Prepared only/i.test(sql)).toBeTruthy();
  });
});

describe('README content validation', () => {
  const readme = load(readmePath);
  test('Contains prepared‑only warning', () => {
    expect(/Prepared only/i.test(readme)).toBeTruthy();
  });
  test('Lists balance key columns', () => {
    const keys = ['customer_id', 'product_id', 'lot_id', 'location_id'];
    keys.forEach(k => expect(new RegExp(k, 'i').test(readme)).toBeTruthy());
  });
});
