import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20K_FINAL_TECHNICAL_BASELINE_LOCK.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20K Final Technical Baseline Lock', () => {
  it('1. 20K document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20K is documentation and test-only');
    expect(source).toContain('This baseline lock does not authorize Production Go Live');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('Friday test run is controlled UAT only');
    expect(source).toContain('Any Critical defect breaks the lock and requires controller review');
  });

  it('3. Document contains baseline lock summary placeholders', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Baseline Lock Summary');
    expect(source).toContain('Latest commit');
    expect(source).toContain('Git clean status');
    expect(source).toContain('Full test result');
    expect(source).toContain('Build result');
    expect(source).toContain('Friday packet completion');
    expect(source).toContain('Report template status');
    expect(source).toContain('Technical verification status');
  });

  it('4. Document contains locked packet list for 20C through 20J', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Locked Packet List');
    expect(source).toContain('20C_FRIDAY_TEST_RUN_READINESS_PACK.md');
    expect(source).toContain('20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md');
    expect(source).toContain('20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md');
    expect(source).toContain('20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md');
    expect(source).toContain('20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md');
    expect(source).toContain('20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md');
    expect(source).toContain('20I_FINAL_PRE_TEST_RUN_CONTROLLER_REVIEW.md');
    expect(source).toContain('20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md');
  });

  it('5. Document contains final verification commands', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Final Verification Commands');
    expect(source).toContain('git status');
    expect(source).toContain('git log --oneline -15');
    expect(source).toContain('npm ci');
    expect(source).toContain('npm test -- --run');
    expect(source).toContain('npm run build');
    expect(source).toMatch(/```powershell/);
  });

  it('6. Document contains acceptable change policy after lock', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Acceptable Change Policy After Lock');
    expect(source).toContain('Critical defect fix only');
    expect(source).toContain('Documentation fill-in only');
    expect(source).toContain('No new feature');
    expect(source).toContain('No schema/RPC/ledger/stock logic change');
    expect(source).toContain('No production data edit');
    expect(source).toContain('All fixes require test/build rerun');
  });

  it('7. Document contains Friday start handoff references', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Friday Start Handoff');
    expect(source).toContain('use 20G for technical verification');
    expect(source).toContain('use 20F for controller decision');
    expect(source).toContain('use 20J for fill-in templates');
    expect(source).toContain('use 20D for timed execution');
    expect(source).toContain('use 20E for evidence');
    expect(source).toContain('use 20H for packet navigation');
  });

  it('8. Document references Friday packet unit tests', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('friday-test-run-readiness-pack.test.js');
    expect(source).toContain('friday-test-run-execution-control.test.js');
    expect(source).toContain('friday-test-run-data-evidence-pack.test.js');
    expect(source).toContain('friday-test-run-controller-summary.test.js');
    expect(source).toContain('pre-friday-technical-verification-runbook.test.js');
    expect(source).toContain('final-friday-test-run-packet-index.test.js');
    expect(source).toContain('final-pre-test-run-controller-review.test.js');
    expect(source).toContain('friday-test-run-fill-in-templates.test.js');
    expect(source).toContain('final-technical-baseline-lock.test.js');
  });
});
