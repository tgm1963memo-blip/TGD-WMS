// end-to-end-uat-script.test.js
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('End-to-End UAT Script Documentation', () => {
  const docPath = path.resolve(__dirname, '../../docs/15N_END_TO_END_UAT_SCRIPT.md');
  it('should exist', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });
});
