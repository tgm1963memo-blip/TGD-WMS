import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20G Pre-Friday Technical Verification Runbook', () => {
  it('1. 20G document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20G is documentation and test-only');
    expect(source).toContain('Technical verification does not authorize Production');
    expect(source).toContain('Friday test run does not equal go-live');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
    expect(source).toContain('No direct database edits are allowed');
  });

  it('3. Document contains technical verification sequence', () => {
    const source = readProjectFile(docPath);
    const sequenceItems = [
      'git status',
      'git log --oneline -5',
      'npm ci',
      'npm test -- --run',
      'npm run build',
      'Environment variable check',
      'Vercel deployment check',
      'Supabase project check',
      'Login page check',
      'Role permission smoke check',
      'Report preview/print smoke check',
      'Stock balance read-only check',
    ];

    for (const item of sequenceItems) {
      expect(source).toContain(item);
    }
  });

  it('4. Document contains Windows PowerShell command blocks', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Set-Location');
    expect(source).toContain('git status');
    expect(source).toContain('npm ci');
    expect(source).toContain('npm test -- --run');
    expect(source).toContain('npm run build');
    expect(source).toMatch(/```powershell/);
  });

  it('5. Document contains verification result table fields', () => {
    const source = readProjectFile(docPath);
    const tableFields = [
      'Check ID',
      'Command / Action',
      'Expected Result',
      'Actual Result',
      'Status',
      'Evidence Link',
      'Owner',
    ];

    for (const field of tableFields) {
      expect(source).toContain(field);
    }
  });

  it('6. Document contains failure handling scenarios', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Failure Handling');
    expect(source).toContain('Test fail');
    expect(source).toContain('Build fail');
    expect(source).toContain('Environment unreachable');
    expect(source).toContain('Login fail');
    expect(source).toContain('Report print fail');
    expect(source).toContain('Stock balance mismatch');
    expect(source).toContain('Git dirty after build');
  });

  it('7. Document contains go/no-go handoff decisions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go Handoff');
    expect(source).toContain('PASS technical verification');
    expect(source).toContain('PASS with condition');
    expect(source).toContain('HOLD');
    expect(source).toContain('FAIL');
  });

  it('8. Document references 20F controller summary', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md');
    expect(source).toContain('Relationship to 20C through 20F');
  });
});
