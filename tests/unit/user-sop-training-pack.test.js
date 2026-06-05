// user-sop-training-pack.test.js
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('User SOP and Training Pack Documentation', () => {
  const docPath = path.resolve(__dirname, '../../docs/15P_USER_SOP_AND_TRAINING_PACK.md');
  it('should exist', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });
});
