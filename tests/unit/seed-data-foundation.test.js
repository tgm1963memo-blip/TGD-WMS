import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../../');
const sqlPath = path.join(projectRoot, 'database/seeds/003_tgd_wms_seed_data_foundation.sql');
const jsonPath = path.join(projectRoot, 'database/seeds/tgd_wms_seed_data_foundation.json');
const readmePath = path.join(projectRoot, 'database/seeds/README.md');
const docPath = path.join(projectRoot, 'docs/database/tgd-wms-seed-data-foundation.md');

function read(p) { return fs.readFileSync(p, {encoding: 'utf8'}); }

describe('Seed Data Foundation validation', () => {
  it('SQL seed file exists', () => {
    expect(fs.existsSync(sqlPath)).toBe(true);
  });
  it('JSON seed fixture exists', () => {
    expect(fs.existsSync(jsonPath)).toBe(true);
  });
  it('Seed README exists', () => {
    expect(fs.existsSync(readmePath)).toBe(true);
  });
  it('Documentation exists', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });
  it('SQL includes required role names', () => {
    const content = read(sqlPath);
    const roles = ['admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'];
    roles.forEach(r => expect(content).toContain(`'${r}'`));
  });
  it('SQL includes at least 3 demo customers', () => {
    const content = read(sqlPath);
    const customers = ['Demo Customer Alpha', 'Demo Customer Beta', 'Demo Customer Gamma'];
    customers.forEach(c => expect(content).toContain(c));
  });
  it('SQL includes at least 5 demo products', () => {
    const content = read(sqlPath);
    const products = ['Frozen Shrimp', 'Frozen Fish', 'Frozen Chicken', 'Chilled Sausage', 'Frozen Processed Food'];
    products.forEach(p => expect(content).toContain(p));
  });
  it('SQL includes warehouse/zone/location sample codes', () => {
    const content = read(sqlPath);
    const codes = ['WH-COLD-01', 'FROZEN-ZONE', 'CHILLED-ZONE', 'FZ-A-01-01', 'CH-A-01-01'];
    codes.forEach(c => expect(content).toContain(c));
  });
  it('SQL includes all required movement types', () => {
    const content = read(sqlPath);
    const movements = ['RECEIVE_CONFIRM','PUTAWAY_CONFIRM','TRANSFER_CONFIRM','ADJUSTMENT_CONFIRM','PICK_ALLOCATE','PICK_CONFIRM','DISPATCH_CONFIRM'];
    movements.forEach(m => expect(content).toContain(`'${m}'`));
  });
  it('SQL contains stock balance and movement ledger comments', () => {
    const content = read(sqlPath);
    expect(content).toContain('stock_balances');
    expect(content).toContain('stock_movements');
    expect(content).toContain('Frontend must never update tgd_stock_balances directly');
  });
  it('SQL includes accounting charge staging but no invoice', () => {
    const content = read(sqlPath);
    expect(content).toContain('tgd_accounting_charge_staging');
    expect(content).not.toContain('invoice');
  });
  it('SQL does not contain forbidden terms', () => {
    const content = read(sqlPath).toLowerCase();
    const forbidden = ['sales_order','sales_orders','so_','outbound_orders','invoice','invoice_lines'];
    forbidden.forEach(term => expect(content).not.toContain(term));
  });
  it('SQL does not contain service_role key, real URL, CREATE FUNCTION or CREATE TRIGGER', () => {
    const content = read(sqlPath);
    expect(content).not.toMatch(/service_role/i);
    expect(content).not.toMatch(/https?:\/\//i);
    expect(content).not.toMatch(/CREATE FUNCTION/i);
    expect(content).not.toMatch(/CREATE TRIGGER/i);
  });
  it('JSON fixture contains required top‑level groups', () => {
    const data = JSON.parse(read(jsonPath));
    const groups = ['users','customers','products','warehouses','zones','locations','lots','pallets','stockBalances','stockMovements','operationCharges','accountingChargeStaging'];
    groups.forEach(g => expect(data).toHaveProperty(g));
  });
  it('Documentation includes fake data warning and not‑executed statement', () => {
    const content = read(docPath);
    expect(content).toMatch(/fake\/demo/i);
    expect(content).toMatch(/DO NOT execute against production/i);
  });
});
