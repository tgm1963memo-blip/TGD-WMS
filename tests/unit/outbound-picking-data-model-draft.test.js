import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const migrationPath = path.join(process.cwd(), 'database/migrations/025_tgd_wms_outbound_picking_foundation.sql');
function readMigration() {
  if (!fs.existsSync(migrationPath)) return '';
  return fs.readFileSync(migrationPath, 'utf8');
}

describe('Outbound Picking Data Model Draft Migration', () => {
  it('contains outbound documents table', () => {
    expect(readMigration()).toContain('CREATE TABLE tgd_outbound_documents');
  });
  it('contains outbound lines table', () => {
    expect(readMigration()).toContain('CREATE TABLE tgd_outbound_lines');
  });
  it('contains outbound reservations table', () => {
    expect(readMigration()).toContain('CREATE TABLE tgd_outbound_reservations');
  });
  it('enforces status enum constraints for document', () => {
    expect(readMigration()).toMatch(/status text NOT NULL DEFAULT 'DRAFT' CHECK \(status IN \('DRAFT','RESERVED','PICKED','CONFIRMED','CANCELLED'\)\)/);
  });
  it('enforces positive requested_quantity', () => {
    expect(readMigration()).toMatch(/requested_quantity numeric NOT NULL CHECK \(requested_quantity > 0\)/);
  });
  it('enforces reserved_quantity > 0', () => {
    expect(readMigration()).toMatch(/reserved_quantity numeric NOT NULL CHECK \(reserved_quantity > 0\)/);
  });
  it('creates unique active reservation guard', () => {
    expect(readMigration()).toContain('CREATE UNIQUE INDEX uq_active_reservation_per_line_location');
  });
  it('does not contain stock movement insert logic', () => {
    expect(readMigration()).not.toContain('stock_movement');
  });
  it('does not contain stock_balance update logic', () => {
    expect(readMigration()).not.toMatch(/stock_balance/);
  });
  it('includes explicit production safety phrase', () => {
    expect(readMigration()).toContain('Production is strictly not touched');
  });
});
