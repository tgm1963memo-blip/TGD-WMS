// Nightly Supabase backup: full database dump + every Storage file +
// manifest.json, into C:\TGD-Backups\daily\<YYYY-MM-DD_HHmm>\.
//
//   node run-backup.mjs [--root C:\TGD-Backups]
//
// Reads secrets from <root>\config\backup.env (never from the repo) and
// pg_dump/pg_restore/psql from <root>\tools\pgsql\bin. Exit code 0 = OK.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, statSync, statfsSync, cpSync } from 'node:fs';
import path from 'node:path';
import {
  backupFolderName,
  parseEnvFile,
  validateBackupEnv,
  redactDbUrl,
  sha256File,
  ROW_COUNT_SQL,
  parseRowCounts,
  listAllStorageObjects,
  isSafeStoragePath,
  buildManifest,
} from './backupLib.mjs';

const execFileAsync = promisify(execFile);
const LOW_DISK_BYTES = 20 * 1024 ** 3;

const rootArgIndex = process.argv.indexOf('--root');
const ROOT = rootArgIndex > -1 ? process.argv[rootArgIndex + 1] : 'C:\\TGD-Backups';
const PG_BIN = path.join(ROOT, 'tools', 'pgsql', 'bin');
const startedAt = new Date();
const runDir = path.join(ROOT, 'daily', backupFolderName(startedAt));
const logFile = path.join(runDir, 'backup.log');
const warnings = [];

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try { appendFileSync(logFile, `${line}\n`, 'utf8'); } catch { /* run dir not created yet */ }
}

function writeStatus(status, detail) {
  const text = `${status} ${new Date().toISOString()}\nfolder: ${runDir}\n${detail ?? ''}\n`;
  writeFileSync(path.join(ROOT, 'LAST_STATUS.txt'), text, 'utf8');
}

// execFile's error message embeds the full command line -- which includes
// the DB URL with its password -- so never let it reach the log as-is.
async function run(exe, args, options) {
  try {
    return await execFileAsync(exe, args, options);
  } catch (error) {
    const stderr = String(error.stderr ?? '').trim();
    throw new Error(`${path.basename(exe)} failed (exit ${error.code ?? '?'}): ${redactDbUrl(stderr || 'no output')}`);
  }
}

function pgTool(name) {
  const exe = path.join(PG_BIN, `${name}.exe`);
  if (!existsSync(exe)) throw new Error(`Missing ${exe} — run install-backup.ps1 first`);
  return exe;
}

async function dumpDatabase(env) {
  const file = path.join(runDir, 'db_full.dump');
  log(`pg_dump ${redactDbUrl(env.SUPABASE_DB_URL)}`);
  await run(pgTool('pg_dump'), [
    '--format=custom', '--no-owner', '--no-privileges', '--compress=6',
    `--file=${file}`, `--dbname=${env.SUPABASE_DB_URL}`,
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60 * 1000 });

  // Proves the archive is readable (catches a truncated/corrupt file).
  const { stdout } = await run(pgTool('pg_restore'), ['--list', file], { maxBuffer: 64 * 1024 * 1024 });
  const entries = stdout.split(/\r?\n/).filter((l) => l && !l.startsWith(';')).length;
  if (entries < 10) throw new Error(`pg_restore --list found only ${entries} entries — dump looks incomplete`);

  const bytes = statSync(file).size;
  log(`database dump OK: ${bytes} bytes, ${entries} archive entries`);
  return { file: 'db_full.dump', bytes, sha256: await sha256File(file) };
}

async function countRows(env) {
  const { stdout } = await run(pgTool('psql'), [
    `--dbname=${env.SUPABASE_DB_URL}`, '--no-psqlrc', '--tuples-only', '--no-align', `--command=${ROW_COUNT_SQL}`,
  ], { maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  const counts = parseRowCounts(stdout);
  log(`row counts: ${Object.keys(counts).length} tables`);
  return counts;
}

async function storageRequest(env, urlPath, init = {}) {
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/${urlPath}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Storage ${urlPath} -> HTTP ${res.status}: ${await res.text()}`);
  return res;
}

async function backupStorage(env) {
  const buckets = await (await storageRequest(env, 'bucket')).json();
  const files = [];
  for (const bucket of buckets) {
    const listPage = async (prefix, offset, limit) => (await storageRequest(env, `object/list/${encodeURIComponent(bucket.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } }),
    })).json();

    const objects = await listAllStorageObjects(listPage);
    for (const obj of objects) {
      if (!isSafeStoragePath(obj.path)) {
        warnings.push(`skipped unsafe storage path: ${bucket.id}/${obj.path}`);
        continue;
      }
      const target = path.join(runDir, 'storage', bucket.id, ...obj.path.split('/'));
      mkdirSync(path.dirname(target), { recursive: true });
      const encodedPath = obj.path.split('/').map(encodeURIComponent).join('/');
      const res = await storageRequest(env, `object/${encodeURIComponent(bucket.id)}/${encodedPath}`);
      writeFileSync(target, Buffer.from(await res.arrayBuffer()));
      files.push({ bucket: bucket.id, path: obj.path, bytes: statSync(target).size, sha256: await sha256File(target) });
    }
    log(`storage bucket ${bucket.id}: ${objects.length} files`);
  }
  return files;
}

async function main() {
  mkdirSync(runDir, { recursive: true });
  log(`backup started -> ${runDir}`);

  const envPath = path.join(ROOT, 'config', 'backup.env');
  if (!existsSync(envPath)) throw new Error(`Missing ${envPath} — copy backup.env.example and fill it in`);
  const env = parseEnvFile(readFileSync(envPath, 'utf8'));
  const envError = validateBackupEnv(env);
  if (envError) throw new Error(envError);

  const dbDump = await dumpDatabase(env);
  const rowCounts = await countRows(env);
  const storageFiles = await backupStorage(env);

  const manifest = buildManifest({
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    dbDump,
    rowCounts,
    storageFiles,
    warnings,
  });
  writeFileSync(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  if (env.EXTRA_COPY_DIR) {
    const extra = path.join(env.EXTRA_COPY_DIR, path.basename(runDir));
    cpSync(runDir, extra, { recursive: true });
    log(`copied to ${extra}`);
  }

  const { bavail, bsize } = statfsSync(ROOT);
  const freeBytes = bavail * bsize;
  if (freeBytes < LOW_DISK_BYTES) warnings.push(`low disk space: ${(freeBytes / 1024 ** 3).toFixed(1)} GB free`);

  const summary = `tables=${manifest.database.tableCount} users=${manifest.database.authUsers} files=${manifest.storage.fileCount}`
    + (warnings.length ? `\nWARN: ${warnings.join(' | ')}` : '');
  log(`backup OK ${summary}`);
  writeStatus(warnings.length ? 'OK_WITH_WARNINGS' : 'OK', summary);
}

main().catch((error) => {
  log(`backup FAILED: ${error.message}`);
  try { writeStatus('FAILED', error.message); } catch { /* root missing */ }
  process.exit(1);
});
