import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  backupFolderName,
  parseEnvFile,
  validateBackupEnv,
  redactDbUrl,
  sha256File,
  parseRowCounts,
  listAllStorageObjects,
  isSafeStoragePath,
  buildManifest,
} from '../../scripts/backup/backupLib.mjs';

describe('backupLib', () => {
  it('names one folder per run by local date and time', () => {
    expect(backupFolderName(new Date(2026, 8, 28, 2, 5))).toBe('2026-09-28_0205');
  });

  it('parses backup.env and validates required keys', () => {
    const env = parseEnvFile('# c\nSUPABASE_DB_URL="postgresql://postgres.x:pw@h:5432/postgres"\nSUPABASE_URL=https://x.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=abc\nEXTRA_COPY_DIR=\n');
    expect(env.SUPABASE_DB_URL).toBe('postgresql://postgres.x:pw@h:5432/postgres');
    expect(env.EXTRA_COPY_DIR).toBe('');
    expect(validateBackupEnv(env)).toBeNull();
    expect(validateBackupEnv({ ...env, SUPABASE_SERVICE_ROLE_KEY: '' })).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(validateBackupEnv({ ...env, SUPABASE_DB_URL: 'postgresql://postgres.x:[YOUR-PASSWORD]@h/postgres' })).toMatch(/placeholder/);
  });

  it('never logs the DB password', () => {
    expect(redactDbUrl('postgresql://postgres.abc:s3cr3t@pooler:5432/postgres')).toBe('postgresql://postgres.abc:****@pooler:5432/postgres');
  });

  it('hashes files with SHA-256', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'tgd-backup-'));
    const file = path.join(dir, 'a.txt');
    writeFileSync(file, 'abc');
    expect(await sha256File(file)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(readFileSync(file, 'utf8')).toBe('abc');
  });

  it('parses psql row-count output', () => {
    expect(parseRowCounts('public.tgd_customers|12\nauth.users|45\n\n')).toEqual({ 'public.tgd_customers': 12, 'auth.users': 45 });
  });

  it('walks storage folders recursively and pages', async () => {
    const tree = {
      '': [{ name: 'cust-1', id: null }],
      'cust-1': [{ name: 'CUSTOMER_DEPOSIT_REQUEST', id: null }, { name: 'top.pdf', id: 'f0', metadata: { size: 3 } }],
      'cust-1/CUSTOMER_DEPOSIT_REQUEST': [
        { name: 'a.jpg', id: 'f1', metadata: { size: 10 } },
        { name: 'b.jpg', id: 'f2', metadata: { size: 20 } },
        { name: 'c.jpg', id: 'f3', metadata: { size: 30 } },
      ],
    };
    const listPage = async (prefix, offset, limit) => (tree[prefix] ?? []).slice(offset, offset + limit);
    const files = await listAllStorageObjects(listPage, '', 2);
    expect(files.map((f) => f.path).sort()).toEqual([
      'cust-1/CUSTOMER_DEPOSIT_REQUEST/a.jpg',
      'cust-1/CUSTOMER_DEPOSIT_REQUEST/b.jpg',
      'cust-1/CUSTOMER_DEPOSIT_REQUEST/c.jpg',
      'cust-1/top.pdf',
    ]);
  });

  it('rejects storage paths that could escape the backup folder', () => {
    expect(isSafeStoragePath('cust/doc/file.pdf')).toBe(true);
    expect(isSafeStoragePath('../etc/passwd')).toBe(false);
    expect(isSafeStoragePath('/abs/file')).toBe(false);
    expect(isSafeStoragePath('a\\b')).toBe(false);
    expect(isSafeStoragePath('a//b')).toBe(false);
  });

  it('builds a manifest with totals for verification', () => {
    const m = buildManifest({
      startedAt: 's', finishedAt: 'f',
      dbDump: { file: 'db_full.dump', bytes: 100, sha256: 'x' },
      rowCounts: { 'public.a': 1, 'public.b': 2, 'auth.users': 45, 'storage.objects': 8 },
      storageFiles: [{ bytes: 5 }, { bytes: 7 }],
    });
    expect(m.database.tableCount).toBe(4);
    expect(m.database.publicTableCount).toBe(2);
    expect(m.database.authUsers).toBe(45);
    expect(m.storage).toMatchObject({ fileCount: 2, bytes: 12 });
  });
});

describe('backupLib OneDrive archive settings', async () => {
  const { validateArchiveSettings, archiveFileName } = await import('../../scripts/backup/backupLib.mjs');

  it('requires a strong archive password only when a OneDrive copy is configured', () => {
    expect(validateArchiveSettings({})).toBeNull();
    expect(validateArchiveSettings({ ONEDRIVE_COPY_DIR: 'C:/x' })).toMatch(/ARCHIVE_PASSWORD/);
    expect(validateArchiveSettings({ ONEDRIVE_COPY_DIR: 'C:/x', ARCHIVE_PASSWORD: 'short' })).toMatch(/shorter/);
    expect(validateArchiveSettings({ ONEDRIVE_COPY_DIR: 'C:/x', ARCHIVE_PASSWORD: 'a'.repeat(24) })).toBeNull();
    expect(validateArchiveSettings({ ONEDRIVE_COPY_DIR: 'C:/x', ARCHIVE_PASSWORD: `${'a'.repeat(20)}"q` })).toMatch(/quotes/);
  });

  it('names the archive after the run folder', () => {
    expect(archiveFileName('2026-09-28_0200')).toBe('TGD-WMS-backup_2026-09-28_0200.7z');
  });
});
