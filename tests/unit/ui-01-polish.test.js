import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getTranslation, TRANSLATION_CATALOG } from '../../src/i18n/translations.js';

describe('UI-01 polish and language support', () => {
  it('translations.js re-exports catalog utilities', () => {
    expect(getTranslation('uat_mode', 'th')).toBeTruthy();
    expect(getTranslation('uat_mode', 'en')).toBeTruthy();
  });

  it('contains UI-01 navigation and safety translation keys', () => {
    const keys = [
      'production_hold',
      'final_go_not_authorized',
      'uat_mode',
      'save_draft',
      'add_line',
      'stock_balance',
      'status_draft',
      'status_hold',
    ];
    for (const key of keys) {
      expect(TRANSLATION_CATALOG[key]?.th).toBeTruthy();
      expect(TRANSLATION_CATALOG[key]?.en).toBeTruthy();
    }
  });

  it('styles.css contains shared UI-01 utility classes', () => {
    const css = fs.readFileSync(path.resolve('src/styles.css'), 'utf8');
    expect(css).toContain('.status-badge');
    expect(css).toContain('.uat-banner');
    expect(css).toContain('.form-card');
    expect(css).toContain('.table-card');
    expect(css).toContain('.uat-diagnostics-card');
    expect(css).toContain('--tgd-navy');
  });
});
