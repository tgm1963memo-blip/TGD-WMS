import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const reportPath = resolve(projectRoot, 'docs/13J-P_RECEIVING_REAL_STOCK_POSTING_STAGING_READINESS.md');
const receivingCreatePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readProjectFile(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-P receiving real stock posting staging readiness report', () => {
  it('creates the read-only staging readiness report', () => {
    expect(existsSync(reportPath)).toBe(true);
  });

  it('states the audit scope and locked production/apply status', () => {
    const report = readProjectFile(reportPath);

    expect(report).toContain('read-only audit only');
    expect(report).toContain('Production locked');
    expect(report).toContain('Migration 020 not applied');
    expect(report).toContain('Staging apply not approved yet');
    expect(report).toContain('Receiving UI remains locked');
  });

  it('mentions receiving schema compatibility fields', () => {
    const report = readProjectFile(reportPath);

    expect(report).toContain('tgd_receiving_lines');
    expect(report).toContain('document_id');
    expect(report).toContain('receiving_document_id');
    expect(report).toContain('quantity');
    expect(report).toContain('received_qty');
    expect(report).toContain('product_id');
    expect(report).toContain('lot_id');
    expect(report).toContain('location_id');
  });

  it('mentions stock movement, stock balance, and trigger readiness fields', () => {
    const report = readProjectFile(reportPath);

    expect(report).toContain('tgd_stock_movements');
    expect(report).toContain('from_location_id');
    expect(report).toContain('to_location_id');
    expect(report).toContain('source_module');
    expect(report).toContain('source_document_id');
    expect(report).toContain('source_line_id');
    expect(report).toContain('tgd_stock_balances.quantity');
    expect(report).toContain('tgd_trigger_update_stock_balance');
  });

  it('mentions RLS policies, table privileges, and a HOLD recommendation', () => {
    const report = readProjectFile(reportPath);

    expect(report).toContain('RLS policies');
    expect(report).toContain('table privileges');
    expect(report).toContain('Recommendation: **HOLD**');
    expect(report).toMatch(/\b(PASS|HOLD)\b/);
  });

  it('does not claim migration 020 was applied or enable receiving UI/service', () => {
    const report = readProjectFile(reportPath);
    const receivingCreate = readProjectFile(receivingCreatePath);
    const receivingService = readProjectFile(receivingServicePath);

    expect(report).not.toMatch(/Migration 020 was applied/i);
    expect(report).not.toMatch(/Migration 020 is applied/i);
    expect(report).not.toContain('Receiving UI enabled');
    expect(receivingCreate).toContain('Controlled receiving draft mode');
    expect(receivingCreate).toContain('createReceivingDocument');
    expect(receivingCreate).toContain('addReceivingLine');
    expect(receivingCreate).toContain('Confirm/Post Receiving');
    expect(receivingCreate).toContain('postReceivingDocument');
    expect(receivingCreate).not.toContain('tgd_rpc_post_receiving_document');
    expect(receivingService).not.toMatch(/\.insert\s*\(/);
    expect(receivingService).not.toMatch(/\.update\s*\(/);
    expect(receivingService).not.toMatch(/\.delete\s*\(/);
    expect(receivingService).not.toMatch(/\.upsert\s*\(/);
  });

  it('does not include unsafe execution instructions outside migration 020 references', () => {
    const report = readProjectFile(reportPath);

    expect(report).toContain('SELECT-only');
    expect(report).not.toMatch(/run\s+alter/i);
    expect(report).not.toMatch(/run\s+create/i);
    expect(report).not.toMatch(/run\s+insert/i);
    expect(report).not.toMatch(/run\s+update/i);
    expect(report).not.toMatch(/run\s+delete/i);
  });
});
