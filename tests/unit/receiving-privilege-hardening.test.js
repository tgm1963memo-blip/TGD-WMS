import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/019_tgd_wms_receiving_privilege_hardening.sql');
const receivingCreatePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readProjectFile(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-L receiving privilege hardening migration', () => {
  it('creates migration 019', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('revokes truncate, trigger, and references from anon and authenticated on receiving tables', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).toContain(
      'revoke truncate, trigger, references on public.tgd_receiving_documents from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke truncate, trigger, references on public.tgd_receiving_lines from anon, authenticated',
    );
  });

  it('keeps SELECT and RPC execute grants unchanged', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toMatch(/revoke\s+select/i);
    expect(migration).not.toMatch(/grant\s+execute/i);
    expect(migration).not.toMatch(/revoke\s+execute/i);
    expect(migration).toContain('SELECT privilege is intentionally left unchanged');
    expect(migration).toContain('Existing RPC execute grants are intentionally left unchanged');
  });

  it('does not grant direct write privileges or enable stock movement RPC calls', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toMatch(/grant\s+insert/i);
    expect(migration).not.toMatch(/grant\s+update/i);
    expect(migration).not.toMatch(/grant\s+delete/i);
    expect(migration).not.toContain('tgd_rpc_create_receive_movement');
    expect(migration).not.toContain('tgd_rpc_create_stock_movement');
  });

  it('does not introduce secret or private connection references', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toMatch(/service_role/i);
    expect(migration).not.toMatch(/DATABASE_URL/i);
  });

  it('keeps ReceivingCreatePage locked and receivingService free of direct table writes', () => {
    const receivingCreate = readProjectFile(receivingCreatePath);
    const receivingService = readProjectFile(receivingServicePath);

    expect(receivingCreate).toContain('Receiving Create Locked');
    expect(receivingCreate).not.toContain('createReceivingDocument');
    expect(receivingCreate).not.toMatch(/Save draft/i);
    expect(receivingService).toContain('tgd_rpc_create_receiving_draft');
    expect(receivingService).toContain('tgd_rpc_add_receiving_line');
    expect(receivingService).not.toContain('tgd_rpc_confirm_receiving_document');
    expect(receivingService).not.toMatch(/\.insert\s*\(/);
    expect(receivingService).not.toMatch(/\.update\s*\(/);
    expect(receivingService).not.toMatch(/\.delete\s*\(/);
    expect(receivingService).not.toMatch(/\.upsert\s*\(/);
  });
});
