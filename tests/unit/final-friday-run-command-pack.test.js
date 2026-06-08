import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20L_FINAL_FRIDAY_RUN_COMMAND_PACK.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20L Final Friday Run Command Pack', () => {
  it('1. 20L document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20L is documentation and test-only');
    expect(source).toContain('This command pack does not authorize Production Go Live');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
    expect(source).toContain('Friday test run is controlled UAT only');
    expect(source).toContain('Any Critical defect triggers HOLD');
  });

  it('3. Command block 1 contains pre-run baseline check', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Command Block 1');
    expect(source).toContain('Pre-Run Baseline Check');
    expect(source).toContain('Set-Location');
    expect(source).toContain('git status');
    expect(source).toContain('git log --oneline -15');
    expect(source).toMatch(/```powershell/);
  });

  it('4. Command block 2 contains clean install and validation', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Command Block 2');
    expect(source).toContain('Clean Install and Validation');
    expect(source).toContain('npm ci');
    expect(source).toContain('npm test -- --run');
    expect(source).toContain('npm run build');
  });

  it('5. Command block 3 contains evidence capture checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Command Block 3');
    expect(source).toContain('Evidence Capture Checklist');
    expect(source).toContain('Record latest commit');
    expect(source).toContain('Record test result');
    expect(source).toContain('Record build result');
    expect(source).toContain('Record git clean status');
    expect(source).toContain('Screenshot login page');
    expect(source).toContain('Screenshot report preview page');
    expect(source).toContain('Screenshot stock balance page');
  });

  it('6. Command block 4 contains Friday handoff checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Command Block 4');
    expect(source).toContain('Friday Handoff Checklist');
    expect(source).toContain('open 20H packet index');
    expect(source).toContain('open 20G technical verification');
    expect(source).toContain('open 20J fill-in templates');
    expect(source).toContain('open 20D execution control');
    expect(source).toContain('open 20E evidence pack');
    expect(source).toContain('open 20F controller summary');
  });

  it('7. Document contains expected result table fields', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Expected Result Table');
    expect(source).toContain('Command / Check');
    expect(source).toContain('Expected Result');
    expect(source).toContain('Actual Result');
    expect(source).toContain('Status');
    expect(source).toContain('Owner');
    expect(source).toContain('Evidence Link');
  });

  it('8. Document contains stop rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Stop Rules');
    expect(source).toContain('Test fail');
    expect(source).toContain('Build fail');
    expect(source).toContain('Git dirty after build');
    expect(source).toContain('Environment unreachable');
    expect(source).toContain('Login fail');
    expect(source).toContain('Report preview/print fail');
    expect(source).toContain('Stock balance cannot be captured');
  });

  it('9. Document references 20H through 20K packs', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md');
    expect(source).toContain('20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md');
    expect(source).toContain('20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md');
    expect(source).toContain('20K_FINAL_TECHNICAL_BASELINE_LOCK.md');
    expect(source).toContain('Relationship to 20C through 20K');
  });
});
