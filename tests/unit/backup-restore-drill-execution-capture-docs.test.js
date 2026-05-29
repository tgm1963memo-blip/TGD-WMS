// backup-restore-drill-execution-capture-docs.test.js
// Verify documentation files for Sprint 12L are present and contain required sections.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const base = path.resolve(__dirname, '../../docs');

const files = [
  { file: 'deployment/backup-restore-drill-execution-record.md', heading: '## Drill ID' },
  { file: 'deployment/backup-restore-drill-evidence-index.md', heading: '| Evidence ID | Evidence Type' },
  { file: 'deployment/backup-restore-drill-result-summary.md', heading: '## Overall Result' },
];

describe('Backup/Restore Drill Documentation', () => {
  files.forEach(({ file, heading }) => {
    const filePath = path.join(base, file);
    it(`should exist: ${file}`, () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });
    it(`should contain required heading in ${file}`, () => {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain(heading);
    });
  });

  it('should not contain "Fully Closed" for PROD-GAP-004 in critical-gap-final-status.md', () => {
    const statusPath = path.join(base, 'production/critical-gap-final-status.md');
    const content = fs.readFileSync(statusPath, 'utf8');
    const gapSection = content.split('PROD‑GAP‑004')[1];
    expect(gapSection).not.toContain('Fully Closed');
  });

  it('should have Secret handling confirmation heading in execution record', () => {
    const execPath = path.join(base, 'deployment/backup-restore-drill-execution-record.md');
    const content = fs.readFileSync(execPath, 'utf8');
    expect(content).toContain('## Secret handling confirmation');
  });
});
