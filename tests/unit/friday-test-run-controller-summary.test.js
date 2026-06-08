import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const docPath = 'docs/20F_FRIDAY_TEST_RUN_CONTROLLER_SUMMARY.md';

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('20F Friday Test Run Controller Summary', () => {
  it('1. 20F document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20F is documentation and test-only');
    expect(source).toContain('20F does not touch Production data');
    expect(source).toContain('20F does not authorize FINAL GO');
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO is NOT AUTHORIZED');
    expect(source).toContain('Friday test run does not equal go-live');
    expect(source).toContain('No direct database edits during test run');
    expect(source).toContain('No uncontrolled stock movement in Production');
  });

  it('3. Document contains current readiness status areas', () => {
    const source = readProjectFile(docPath);
    const readinessAreas = [
      'Code baseline',
      'Full test status',
      'Build status',
      'Report readiness',
      'Test run documents',
      'Evidence pack',
      'Production gate status',
    ];

    for (const area of readinessAreas) {
      expect(source).toContain(area);
    }
  });

  it('4. Document contains pending fill-in list items', () => {
    const source = readProjectFile(docPath);
    const pendingItems = [
      'Environment URL',
      'Supabase project',
      'Vercel deployment',
      'User accounts',
      'UAT users',
      'Master data',
      'Sample documents',
      'Evidence folder',
      'Defect log owner',
      'Business sign-off owner',
      'IT / system owner',
    ];

    for (const item of pendingItems) {
      expect(source).toContain(item);
    }
  });

  it('5. Document contains Friday start criteria', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Friday Start Criteria');
    expect(source).toContain('Git clean');
    expect(source).toContain('npm test -- --run');
    expect(source).toContain('npm run build');
    expect(source).toContain('Environment reachable');
    expect(source).toContain('Users can login');
    expect(source).toContain('Master data available');
    expect(source).toContain('Reports preview/print available');
    expect(source).toContain('Stock opening balance captured');
    expect(source).toContain('Evidence folder ready');
    expect(source).toContain('Defect log ready');
  });

  it('6. Document contains Friday hold criteria', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Friday Hold Criteria');
    expect(source).toContain('Critical defect before start');
    expect(source).toContain('Unable to login');
    expect(source).toContain('Missing master data');
    expect(source).toContain('Report preview/print not available');
    expect(source).toContain('Stock balance cannot be captured');
    expect(source).toContain('Environment not reachable');
    expect(source).toContain('Test owner unavailable');
  });

  it('7. Document contains controller decision block options', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Decision Block');
    expect(source).toContain('READY FOR FRIDAY TEST RUN');
    expect(source).toContain('READY WITH CONDITIONS');
    expect(source).toContain('HOLD');
    expect(source).toContain('NOT READY');
  });

  it('8. Document references 20C, 20D, and 20E packs', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('20C_FRIDAY_TEST_RUN_READINESS_PACK.md');
    expect(source).toContain('20D_FRIDAY_TEST_RUN_EXECUTION_CONTROL.md');
    expect(source).toContain('20E_FRIDAY_TEST_RUN_DATA_AND_EVIDENCE_PACK.md');
    expect(source).toContain('Relationship to 20C, 20D, and 20E');
  });
});
