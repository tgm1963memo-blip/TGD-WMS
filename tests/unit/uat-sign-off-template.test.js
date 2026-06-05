// uat-sign-off-template.test.js
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('UAT Sign-Off Template Documentation', () => {
  const docPath = path.resolve(__dirname, '../../docs/15O_UAT_SIGN_OFF_TEMPLATE.md');
  it('should exist', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });
});
