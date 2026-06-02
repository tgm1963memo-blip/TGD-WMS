// tests/unit/stock-balance-last-movement-traceability.test.js
// Sprint 13J-AB: Stock balance last movement traceability patch draft tests.

const fs = require('fs');
const path = require('path');

const migrationPath = path.resolve(
  __dirname,
  '../../database/migrations/022_tgd_wms_stock_balance_last_movement_traceability.sql'
);
const docsPath = path.resolve(
  __dirname,
  '../../docs/13J-AB_STOCK_BALANCE_TRACEABILITY_PATCH.md'
);

describe('Sprint 13J-AB stock balance last movement traceability patch draft', () => {
  it('migration draft file exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('patch docs file exists', () => {
    expect(fs.existsSync(docsPath)).toBe(true);
  });

  it('contains a controlled draft header and production lock warning', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('draft only');
    expect(sql).toContain('controller approval');
    expect(sql).toContain('production locked');
  });

  it('defines the trigger function for stock balance updates', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.tgd_trigger_update_stock_balance\s*\(/i);
    expect(sql).toContain('return new;');
  });

  it('sets last_movement_id = new.id on source stock balance insert/update', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/if\s+new\.from_location_id\s+is\s+not\s+null\s+then[\s\S]*?last_movement_id\s*=\s*new\.id/i);
    expect(sql).toMatch(/on conflict \(customer_id, product_id, lot_id, location_id\)[\s\S]*?do update set[\s\S]*?last_movement_id\s*=\s*new\.id/i);
  });

  it('sets last_movement_id = new.id on target stock balance insert/update', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/if\s+new\.to_location_id\s+is\s+not\s+null\s+then[\s\S]*?last_movement_id\s*=\s*new\.id/i);
    expect(sql).toMatch(/on conflict \(customer_id, product_id, lot_id, location_id\)[\s\S]*?do update set[\s\S]*?last_movement_id\s*=\s*new\.id/i);
  });

  it('preserves existing quantity accumulation behavior', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('quantity = public.tgd_stock_balances.quantity + excluded.quantity');
    expect(sql).toContain('updated_at = now()');
  });

  it('does not change weight handling in this controlled draft', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('weight is intentionally unchanged');
  });
});
