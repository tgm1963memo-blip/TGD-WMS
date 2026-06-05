// uat-master-checklist.test.js
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('UAT Master Checklist Documentation', () => {
  const docPath = path.resolve(__dirname, '../../docs/15M_UAT_MASTER_CHECKLIST.md');
  it('should exist', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });
});
