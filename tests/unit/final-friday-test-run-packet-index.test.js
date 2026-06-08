import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20H Final Friday Test Run Packet Index', () => {
  it('1. 20H document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20H is documentation and test-only');
    expect(source).toContain('Friday test run is not Production Go Live');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
    expect(source).toContain('No direct database edits');
    expect(source).toContain('No uncontrolled Production stock movement');
    expect(source).toContain('Any Critical defect triggers HOLD');
  });

  it('3. Document contains packet inventory for all Friday packs', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20C_FRIDAY_TEST_RUN_READINESS_PACK.md');
    expect(source).toContain('20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md');
    expect(source).toContain('20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md');
    expect(source).toContain('20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md');
    expect(source).toContain('20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md');
  });

  it('4. Document contains recommended use order', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Recommended Use Order');
    expect(source).toContain('Step 1');
    expect(source).toContain('20G');
    expect(source).toContain('Step 2');
    expect(source).toContain('Step 3');
    expect(source).toContain('20E');
    expect(source).toContain('Step 4');
    expect(source).toContain('20D');
    expect(source).toContain('Step 5');
    expect(source).toContain('20C');
    expect(source).toContain('Step 6');
    expect(source).toContain('end-of-day controller decision');
  });

  it('5. Document contains Friday command checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Friday Command Checklist');
    expect(source).toContain('git status');
    expect(source).toContain('git log --oneline -8');
    expect(source).toContain('npm ci');
    expect(source).toContain('npm test -- --run');
    expect(source).toContain('npm run build');
    expect(source).toMatch(/```powershell/);
  });

  it('6. Document contains document owner table fields', () => {
    const source = readProjectFile(docPath);
    const ownerTableFields = [
      'Document',
      'Purpose',
      'Owner',
      'When to Use',
      'Required Output',
      'Evidence Link',
    ];

    for (const field of ownerTableFields) {
      expect(source).toContain(field);
    }
  });

  it('7. Document contains decision gate summary', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Decision Gate Summary');
    expect(source).toContain('Start gate');
    expect(source).toContain('Stop gate');
    expect(source).toContain('Defect gate');
    expect(source).toContain('Stock reconciliation gate');
    expect(source).toContain('Report print gate');
    expect(source).toContain('End-of-day decision gate');
  });

  it('8. Document references all Friday pack unit tests', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('friday-test-run-readiness-pack.test.js');
    expect(source).toContain('friday-test-run-execution-control.test.js');
    expect(source).toContain('friday-test-run-data-evidence-pack.test.js');
    expect(source).toContain('friday-test-run-controller-summary.test.js');
    expect(source).toContain('pre-friday-technical-verification-runbook.test.js');
    expect(source).toContain('final-friday-test-run-packet-index.test.js');
  });
});
