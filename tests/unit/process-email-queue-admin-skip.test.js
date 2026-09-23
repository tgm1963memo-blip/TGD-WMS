import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const apiPath = path.join(process.cwd(), 'api/process-email-queue.js');

describe('process-email-queue admin role guard', () => {
  it('skips queued admin-role messages before sending mail', () => {
    const source = readFileSync(apiPath, 'utf8');
    const guardIndex = source.indexOf("recipient_role || '').trim().toLowerCase() === 'admin'");
    const sendIndex = source.indexOf('await transporter.sendMail');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(sendIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(sendIndex);
    expect(source).toContain("status: 'SKIPPED'");
    expect(source).toContain('skippedCount');
  });
});
