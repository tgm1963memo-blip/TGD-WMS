import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20I_FINAL_PRE_TEST_RUN_CONTROLLER_REVIEW.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20I Final Pre-Test Run Controller Review', () => {
  it('1. 20I document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety and boundary statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20I is documentation and test-only');
    expect(source).toContain('This does not authorize Production Go Live');
    expect(source).toContain('This does not authorize FINAL GO');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('No direct database edits are allowed');
    expect(source).toContain('Friday test run is controlled UAT only');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('3. Document contains current technical baseline placeholders', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Current Technical Baseline');
    expect(source).toContain('Latest commit');
    expect(source).toContain('Git clean status');
    expect(source).toContain('Full test result');
    expect(source).toContain('Build result');
    expect(source).toContain('Technical verification result');
  });

  it('4. Document contains Friday packet status for all packs', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Friday Packet Status');
    expect(source).toContain('20C_FRIDAY_TEST_RUN_READINESS_PACK.md');
    expect(source).toContain('20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md');
    expect(source).toContain('20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md');
    expect(source).toContain('20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md');
    expect(source).toContain('20G_PRE_FRIDAY_TECHNICAL_VERIFICATION_RUNBOOK.md');
    expect(source).toContain('20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md');
  });

  it('5. Document contains readiness decision checklist items', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Readiness Decision Checklist');
    const checklistItems = [
      'Environment URL confirmed',
      'Vercel deployment reachable',
      'Supabase project confirmed',
      'User accounts ready',
      'Test roles ready',
      'Master data ready',
      'Sample transaction data ready',
      'Evidence folder ready',
      'Defect log ready',
      'Report preview/print ready',
      'Stock opening balance captured',
      'Tester owners assigned',
    ];

    for (const item of checklistItems) {
      expect(source).toContain(item);
    }
  });

  it('6. Document contains unresolved items section fields', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Unresolved Items Section');
    expect(source).toContain('Item ID');
    expect(source).toContain('Description');
    expect(source).toContain('Owner');
    expect(source).toContain('Required Before Start?');
    expect(source).toContain('Status');
    expect(source).toContain('Mitigation');
  });

  it('7. Document contains controller decision options', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Decision Options');
    expect(source).toContain('READY TO START FRIDAY TEST RUN');
    expect(source).toContain('READY WITH CONDITIONS');
    expect(source).toContain('HOLD');
    expect(source).toContain('NOT READY');
  });

  it('8. Document references 20H packet index', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20H_FINAL_FRIDAY_TEST_RUN_PACKET_INDEX.md');
    expect(source).toContain('Relationship to 20C through 20H');
  });
});
