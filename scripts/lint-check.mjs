/**
 * Production lint gate — forbidden patterns in application source.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const FORBIDDEN = [
  { pattern: /\bconsole\.log\s*\(/g, label: 'console.log' },
  { pattern: /\bTODO\b/g, label: 'TODO' },
  { pattern: /\bFIXME\b/g, label: 'FIXME' },
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, files);
    } else if (/\.(js|jsx|ts|tsx|css)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];

for (const file of walk(SRC)) {
  const content = readFileSync(file, 'utf8');
  for (const rule of FORBIDDEN) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(content)) {
      violations.push(`${relative(ROOT, file)}: contains ${rule.label}`);
    }
  }
}

if (violations.length) {
  console.error('Lint check failed:\n' + violations.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, scanned: walk(SRC).length, violations: 0 }));
