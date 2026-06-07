import { expect, test } from 'vitest';
import { normalizeLanguage } from '../../src/i18n/languageProvider.jsx';

test('normalizeLanguage correctly falls back and normalizes', () => {
  expect(normalizeLanguage('th')).toBe('th');
  expect(normalizeLanguage('en')).toBe('en');
  expect(normalizeLanguage('fr')).toBe('th'); // unsupported falls back to default
  expect(normalizeLanguage(null)).toBe('th');
  expect(normalizeLanguage(undefined)).toBe('th');
});
