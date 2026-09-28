// Pure helpers for the nightly Supabase backup (see run-backup.mjs).
// Node built-ins only -- the backup runs from C:\TGD-Backups\bin, outside
// the repo, where node_modules is not available.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

// "2026-09-28_0200" in the machine's local time -- one folder per run.
export function backupFolderName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

// Minimal KEY=VALUE parser (supports quotes and # comments).
export function parseEnvFile(text) {
  const env = {};
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export const REQUIRED_ENV_KEYS = ['SUPABASE_DB_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

export function validateBackupEnv(env) {
  const missing = REQUIRED_ENV_KEYS.filter((k) => !env[k]);
  if (missing.length) return `Missing in backup.env: ${missing.join(', ')}`;
  if (!/^postgres(ql)?:\/\//.test(env.SUPABASE_DB_URL)) return 'SUPABASE_DB_URL must start with postgresql://';
  if (/\[YOUR-PASSWORD\]|<password>/i.test(env.SUPABASE_DB_URL)) return 'SUPABASE_DB_URL still has the password placeholder';
  return null;
}

// ONEDRIVE_COPY_DIR (off-machine copy) only ever receives an encrypted
// archive, so it needs a real ARCHIVE_PASSWORD.
export const MIN_ARCHIVE_PASSWORD_LENGTH = 16;

export function validateArchiveSettings(env) {
  if (!env.ONEDRIVE_COPY_DIR) return null;
  if (String(env.ARCHIVE_PASSWORD ?? '').length < MIN_ARCHIVE_PASSWORD_LENGTH) {
    return `ONEDRIVE_COPY_DIR is set but ARCHIVE_PASSWORD is missing or shorter than ${MIN_ARCHIVE_PASSWORD_LENGTH} characters`;
  }
  if (/["\r\n]/.test(env.ARCHIVE_PASSWORD)) return 'ARCHIVE_PASSWORD must not contain quotes or line breaks';
  return null;
}

export function archiveFileName(folderName) {
  return `TGD-WMS-backup_${folderName}.7z`;
}

// Hides the password in a connection string before it is logged.
export function redactDbUrl(url) {
  return String(url ?? '').replace(/(postgres(?:ql)?:\/\/[^:/@]+:)[^@]*@/i, '$1****@');
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

// One SQL statement returning "schema.table|count" for every base table in
// the schemas we back up -- exact counts via query_to_xml, one round trip.
export const ROW_COUNT_SQL = `select table_schema || '.' || table_name || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_schema in ('public', 'auth', 'storage') and table_type = 'BASE TABLE'
order by 1;`;

export function parseRowCounts(psqlOutput) {
  const counts = {};
  for (const line of String(psqlOutput ?? '').split(/\r?\n/)) {
    const m = /^([^|]+)\|(\d+)$/.exec(line.trim());
    if (m) counts[m[1]] = Number(m[2]);
  }
  return counts;
}

// Walks a Storage bucket through the REST list endpoint. Entries without an
// id are folders. listPage(prefix, offset) -> array of { name, id, metadata }.
export async function listAllStorageObjects(listPage, prefix = '', pageSize = 100) {
  const files = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await listPage(prefix, offset, pageSize);
    for (const entry of page) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        files.push({ path: fullPath, size: Number(entry.metadata?.size ?? 0) });
      } else {
        files.push(...await listAllStorageObjects(listPage, fullPath, pageSize));
      }
    }
    if (page.length < pageSize) return files;
  }
}

// Storage object paths come from the database: refuse anything that could
// escape the backup folder when joined onto it.
export function isSafeStoragePath(objectPath) {
  const p = String(objectPath ?? '');
  return p.length > 0 && !p.startsWith('/') && !p.includes('\\') && !p.split('/').some((seg) => seg === '..' || seg === '');
}

export function buildManifest({ startedAt, finishedAt, dbDump, rowCounts, storageFiles, warnings = [] }) {
  const tables = Object.keys(rowCounts ?? {});
  return {
    version: 1,
    startedAt,
    finishedAt,
    database: {
      file: dbDump.file,
      bytes: dbDump.bytes,
      sha256: dbDump.sha256,
      tableCount: tables.length,
      publicTableCount: tables.filter((t) => t.startsWith('public.')).length,
      authUsers: rowCounts?.['auth.users'] ?? null,
      rowCounts,
    },
    storage: {
      fileCount: storageFiles.length,
      bytes: storageFiles.reduce((sum, f) => sum + (f.bytes ?? 0), 0),
      files: storageFiles,
    },
    warnings,
  };
}
