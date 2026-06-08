import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20O_FINAL_PRE_FRIDAY_VERIFICATION_EVIDENCE_CAPTURE.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20O Final Pre-Friday Verification Evidence Capture', () => {
  it('1. 20O document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20O is documentation and test-only');
    expect(source).toContain('This evidence capture does not authorize Production Go Live');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('Friday test run is controlled UAT only');
    expect(source).toContain('No direct database edits are allowed');
    expect(source).toContain('No uncontrolled Production stock movement is allowed');
    expect(source).toContain('Any Critical defect triggers HOLD');
  });

  it('3. Document contains final baseline section', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Final Baseline Section');
    expect(source).toContain('Latest commit');
    expect(source).toContain('Git branch');
    expect(source).toContain('Remote sync status');
    expect(source).toContain('Working tree status');
    expect(source).toContain('Full test result');
    expect(source).toContain('Build result');
    expect(source).toContain('Verification date/time');
    expect(source).toContain('Verifier name');
  });

  it('4. Document contains completed packet list through 20N', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Completed Packet List');
    const packs = [
      '20C_FRIDAY_TEST_RUN_READINESS_PACK.md',
      '20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md',
      '20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md',
      '20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md',
      '20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md',
      '20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md',
      '20I_FINAL_PRE_TEST_RUN_CONTROLLER_REVIEW.md',
      '20J_FRIDAY_TEST_RUN_FILL_IN_TEMPLATES.md',
      '20K_FINAL_TECHNICAL_BASELINE_LOCK.md',
      '20L_FINAL_FRIDAY_RUN_COMMAND_PACK.md',
      '20M_FRIDAY_TEST_RUN_ENVIRONMENT_FILL_IN_GUARD.md',
      '20N_FINAL_FRIDAY_READY_HOLD_DECISION_TEMPLATE.md',
    ];

    for (const pack of packs) {
      expect(source).toContain(pack);
    }
  });

  it('5. Document contains evidence capture table columns', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Capture Table');
    expect(source).toContain('Item ID');
    expect(source).toContain('Evidence Item');
    expect(source).toContain('Expected Result');
    expect(source).toContain('Actual Result');
    expect(source).toContain('Screenshot/File Link');
    expect(source).toContain('Owner');
    expect(source).toContain('Status');
  });

  it('6. Document contains final verification commands', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Final Verification Commands');
    expect(source).toContain('git status');
    expect(source).toContain('git log --oneline -15');
    expect(source).toContain('npm ci');
    expect(source).toContain('npm test -- --run');
    expect(source).toContain('npm run build');
    expect(source).toMatch(/```powershell/);
  });

  it('7. Document contains final pre-Friday decision options', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Final Pre-Friday Decision');
    expect(source).toContain('READY FOR FRIDAY CONTROLLED TEST RUN');
    expect(source).toContain('READY WITH CONDITIONS');
    expect(source).toContain('HOLD');
    expect(source).toContain('NOT READY');
  });

  it('8. Document contains remaining fill-in items', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Remaining Fill-In Items');
    const items = [
      'Environment URL',
      'Vercel Deployment URL',
      'Supabase Project',
      'User Accounts',
      'Roles',
      'Master Data',
      'Opening Stock Balance',
      'Evidence Folder',
      'Defect Log',
      'Tester Owners',
    ];

    for (const item of items) {
      expect(source).toContain(item);
    }
  });

  it('9. Document references 20M and 20N packs', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20M_FRIDAY_TEST_RUN_ENVIRONMENT_FILL_IN_GUARD.md');
    expect(source).toContain('20N_FINAL_FRIDAY_READY_HOLD_DECISION_TEMPLATE.md');
    expect(source).toContain('Relationship to 20C through 20N');
  });
});
