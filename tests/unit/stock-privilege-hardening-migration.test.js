import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const migrationPath = resolve(projectRoot, 'database/migrations/021_tgd_wms_stock_privilege_hardening.sql');
const receivingCreatePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readProjectFile(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-R stock privilege hardening migration draft', () => {
  it('creates migration 021 with required safety header', () => {
    const migration = readProjectFile(migrationPath);

    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain('Sprint 13J-R');
    expect(migration).toContain('Draft only');
    expect(migration).toContain('Staging apply requires Controller approval');
    expect(migration).toContain('Production locked');
    expect(migration).toContain('Receiving UI remains locked');
    expect(migration).toContain('Real stock posting remains locked');
  });

  it('revokes unsafe stock movement table privileges from anon and authenticated', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).toMatch(
      /revoke\s+insert,\s*update,\s*delete,\s*truncate,\s*trigger,\s*references\s+on public\.tgd_stock_movements\s+from anon,\s*authenticated/i,
    );
  });

  it('revokes unsafe stock balance table privileges from anon and authenticated', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).toMatch(
      /revoke\s+insert,\s*update,\s*delete,\s*truncate,\s*trigger,\s*references\s+on public\.tgd_stock_balances\s+from anon,\s*authenticated/i,
    );
  });

  it('keeps SELECT privilege unchanged', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toMatch(/revoke\s+select/i);
    expect(migration).not.toMatch(/grant\s+select/i);
    expect(migration).toContain('SELECT privileges are intentionally left unchanged');
  });

  it('hardens existing receiving RPC execute grants to authenticated only', () => {
    const migration = readProjectFile(migrationPath);

    [
      'public.tgd_rpc_create_receiving_draft(uuid, text)',
      'public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric)',
      'public.tgd_rpc_confirm_receiving_document(uuid)',
    ].forEach((signature) => {
      expect(migration).toContain(`revoke execute on function ${signature} from public`);
      expect(migration).toContain(`revoke execute on function ${signature} from anon`);
      expect(migration).toContain(`grant execute on function ${signature} to authenticated`);
    });
  });

  it('does not reference service role or migration 020 post RPC', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toMatch(/service_role/i);
    expect(migration).not.toContain('tgd_rpc_post_receiving_document');
  });

  it('does not include business-table DML or RLS policy changes', () => {
    const migration = readProjectFile(migrationPath);

    expect(migration).not.toMatch(/insert\s+into\s+public\./i);
    expect(migration).not.toMatch(/update\s+public\./i);
    expect(migration).not.toMatch(/delete\s+from\s+public\./i);
    expect(migration).not.toMatch(/create\s+policy/i);
    expect(migration).not.toMatch(/drop\s+policy/i);
  });

  it('does not enable ReceivingCreatePage and keeps receiving service free of direct table writes', () => {
    const migration = readProjectFile(migrationPath);
    const receivingCreate = readProjectFile(receivingCreatePath);
    const receivingService = readProjectFile(receivingServicePath);

    expect(migration).toContain('Receiving UI remains locked');
    expect(receivingCreate).toContain('Controlled receiving draft mode');
    expect(receivingCreate).toContain('createReceivingDocument');
    expect(receivingCreate).toContain('addReceivingLine');
    expect(receivingCreate).toContain('Confirm/Post is still locked');
    expect(receivingCreate).not.toContain('postReceivingDocument');
    expect(receivingService).toContain('tgd_rpc_create_receiving_draft');
    expect(receivingService).toContain('tgd_rpc_add_receiving_line');
    expect(receivingService).not.toContain('tgd_rpc_confirm_receiving_document');
    expect(receivingService).not.toMatch(/\.insert\s*\(/);
    expect(receivingService).not.toMatch(/\.update\s*\(/);
    expect(receivingService).not.toMatch(/\.delete\s*\(/);
    expect(receivingService).not.toMatch(/\.upsert\s*\(/);
  });
});
