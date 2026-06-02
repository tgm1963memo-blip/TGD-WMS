import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(__dirname, '../../');
const migrationPath = resolve(projectRoot, 'database/migrations/017_tgd_wms_rpc_traceability_fix.sql');
const dryRunServicePath = resolve(projectRoot, 'src/services/controlledFrontendWriteDryRunService.js');

function readSource(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-H RPC traceability fix migration', () => {
  const sql = readSource(migrationPath);

  it('migration file exists', () => {
    expect(statSync(migrationPath).isFile()).toBe(true);
  });

  it('keeps base RPC signature unchanged', () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.tgd_rpc_create_stock_movement\s*\(\s*p_movement_type\s+text,\s*p_customer_id\s+uuid,\s*p_quantity\s+numeric,\s*p_source_location_id\s+uuid,\s*p_target_location_id\s+uuid,\s*p_reference\s+text\s+default\s+null::text\s*\)/i);
  });

  it('persists p_reference and created_by traceability fields', () => {
    expect(sql).toMatch(/insert\s+into\s+public\.tgd_stock_movements\s*\([\s\S]*\breference\b[\s\S]*\bcreated_by\b/i);
    expect(sql).toMatch(/values\s*\([\s\S]*p_reference[\s\S]*v_user_id[\s\S]*\)/i);
    expect(sql).toMatch(/v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/i);
  });

  it('preserves existing location convention', () => {
    expect(sql).toMatch(/from_location_id[\s\S]*to_location_id/i);
    expect(sql).toMatch(/p_source_location_id[\s\S]*p_target_location_id/i);
    expect(sql).not.toMatch(/source_location_id\s*,\s*target_location_id/i);
  });

  it('keeps receive wrapper RPC signature unchanged', () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.tgd_rpc_create_receive_movement\s*\(\s*p_customer_id\s+uuid,\s*p_quantity\s+numeric,\s*p_source_location_id\s+uuid,\s*p_target_location_id\s+uuid,\s*p_reference\s+text\s+default\s+null::text\s*\)/i);
    expect(sql).toContain("'RECEIVE_CONFIRM'");
  });

  it('does not reference private key terminology', () => {
    expect(sql).not.toMatch(/service_role/i);
  });
});

describe('Sprint 13J-H controlled frontend dry-run safety', () => {
  const serviceSource = readSource(dryRunServicePath);

  it('controlled frontend dry-run service calls only the allowed receive movement RPC', () => {
    const rpcCalls = serviceSource.match(/\.rpc\s*\(/g) ?? [];

    expect(rpcCalls).toHaveLength(1);
    expect(serviceSource).toContain('tgd_rpc_create_receive_movement');
    expect(serviceSource).not.toMatch(/tgd_rpc_create_(putaway|transfer|adjustment|pick|dispatch)_movement/i);
  });

  it('does not add direct frontend table write methods', () => {
    expect(serviceSource).not.toMatch(/\.insert\s*\(/);
    expect(serviceSource).not.toMatch(/\.update\s*\(/);
    expect(serviceSource).not.toMatch(/\.delete\s*\(/);
    expect(serviceSource).not.toMatch(/\.upsert\s*\(/);
    expect(serviceSource).not.toMatch(/service_role/i);
  });

  it('does not directly mutate tgd_stock_balances from frontend dry-run service', () => {
    expect(serviceSource).toContain(".from('tgd_stock_balances')");
    expect(serviceSource).toContain(".select('id, customer_id, location_id')");
    expect(serviceSource).not.toMatch(/from\('tgd_stock_balances'\)[\s\S]{0,240}\.(insert|update|delete|upsert)\s*\(/);
  });
});
