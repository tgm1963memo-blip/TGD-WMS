// customer‑isolation‑rls‑refinement.test.js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../../');
const sqlPath = path.join(projectRoot, 'database/policies/004_tgd_wms_customer_isolation_rls_refinement.sql');
const docPath = path.join(projectRoot, 'docs/security/customer-isolation-rls-refinement.md');
const matrixPath = path.join(projectRoot, 'docs/security/tgd-wms-rls-access-matrix.md');

function read(p) { return fs.readFileSync(p, {encoding: 'utf8'}); }

describe('Customer Isolation RLS Refinement content validation', () => {
  it('SQL file exists', () => {
    expect(fs.existsSync(sqlPath)).toBe(true);
  });
  it('Documentation file exists', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });
  it('SQL references auth.uid()', () => {
    const content = read(sqlPath);
    expect(content).toMatch(/auth\.uid\(\)/);
  });
  it('SQL references tgd_user_profiles', () => {
    const content = read(sqlPath);
    expect(content).toMatch(/tgd_user_profiles/);
  });
  it('SQL checks is_active = true', () => {
    const content = read(sqlPath);
    expect(content).toMatch(/p\.is_active\s*=\s*true/);
  });
  it('SQL includes required roles', () => {
    const content = read(sqlPath);
    const roles = ['admin','warehouse_manager','warehouse_staff','accounting','viewer'];
    roles.forEach(r => expect(content).toMatch(new RegExp(`'${r}'`)));
  });
  it('SQL contains stock balance protection comment', () => {
    const content = read(sqlPath);
    expect(content).toMatch(/Stock balances – read only, writes via future RPC/);
  });
  it('SQL contains movement ledger protection comment', () => {
    const content = read(sqlPath);
    expect(content).toMatch(/Stock movements – read only, writes via future RPC/);
  });
  it('SQL contains future RPC comment', () => {
    const content = read(sqlPath);
    expect(content).toMatch(/Future RPC/);
  });
  it('SQL does NOT contain CREATE FUNCTION', () => {
    const content = read(sqlPath);
    expect(content).not.toMatch(/CREATE\s+FUNCTION/i);
  });
  it('SQL does NOT contain CREATE TRIGGER', () => {
    const content = read(sqlPath);
    expect(content).not.toMatch(/CREATE\s+TRIGGER/i);
  });
  it('SQL does NOT contain service_role usage', () => {
    const content = read(sqlPath);
    expect(content).not.toMatch(/service_role/);
  });
  it('SQL does NOT contain real Supabase URL', () => {
    const content = read(sqlPath);
    expect(content).not.toMatch(/https?:\/\//i);
  });
  it('SQL does NOT contain forbidden terms', () => {
    const content = read(sqlPath).toLowerCase();
    const forbidden = ['sales_order','sales_orders','so_','outbound_orders','invoice','invoice_lines'];
    forbidden.forEach(term => expect(content).not.toContain(term));
  });
  it('Documentation states customer_id null does not grant global access', () => {
    const content = read(docPath);
    expect(content).toMatch(/customer_id\s*=\s*null.*does NOT grant global access/i);
  });
  it('Documentation states customer‑scoped access requires customer_id match', () => {
    const content = read(docPath);
    expect(content).toMatch(/customer‑scoped access requires.*customer_id match/i);
  });
  it('Documentation states frontend permissions are not final control', () => {
    const content = read(docPath);
    expect(content).toMatch(/frontend permissions are not final control/i);
  });
});
