import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const files = [
  'database/migrations/125_r3_carcass_type_chicken_skin.sql',
  'supabase/migrations/20261107090000_r3_carcass_type_chicken_skin.sql',
];

describe('ร.3 carcass type: frozen chicken skin', () => {
  it.each(files)('%s adds the type without touching existing rows', (file) => {
    const sql = fs.readFileSync(path.resolve(file), 'utf8');
    expect(sql).toContain("('CHICKEN_SKIN_FROZEN', 'ไก่', 'หนังไก่แช่แข็ง', 80)");
    expect(sql).toMatch(/on conflict \(code\) do nothing/);
    expect(sql).not.toMatch(/\b(update|delete|drop|alter|truncate)\b/i);
  });

  it('keeps both migration copies identical', () => {
    const [a, b] = files.map((f) => fs.readFileSync(path.resolve(f), 'utf8').replace(/\r\n/g, '\n'));
    expect(a).toBe(b);
  });
});
