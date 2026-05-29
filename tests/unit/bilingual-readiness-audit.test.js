// tests/unit/bilingual-readiness-audit.test.js

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, TRANSLATION_CATALOG } from '../../src/i18n/translationCatalog.js';
import {
  auditTranslationCatalog,
  findMissingLanguageValues,
  findDuplicateTranslationKeys,
  findEmptyTranslations,
  summarizeTranslationAudit,
} from '../../src/i18n/translationAuditService.js';

describe('Bilingual Readiness Audit', () => {
  test('Translation catalog file exists', () => {
    expect(TRANSLATION_CATALOG).toBeDefined();
  });

  test('Translation audit service file exists', () => {
    expect(auditTranslationCatalog).toBeDefined();
  });

  test('Supported languages include th and en', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(expect.arrayContaining(['th', 'en']));
  });

  test('Default language is th', () => {
    expect(DEFAULT_LANGUAGE).toBe('th');
  });

  test('Required exports exist', () => {
    expect(findMissingLanguageValues).toBeDefined();
    expect(findDuplicateTranslationKeys).toBeDefined();
    expect(findEmptyTranslations).toBeDefined();
    expect(summarizeTranslationAudit).toBeDefined();
  });

  test('Every translation key has both th and en', () => {
    const missing = findMissingLanguageValues(TRANSLATION_CATALOG, SUPPORTED_LANGUAGES);
    expect(missing).toHaveLength(0);
  });

  test('No empty translation values', () => {
    const empty = findEmptyTranslations(TRANSLATION_CATALOG, SUPPORTED_LANGUAGES);
    expect(empty).toHaveLength(0);
  });

  test('No duplicate translation keys', () => {
    const dup = findDuplicateTranslationKeys(TRANSLATION_CATALOG);
    expect(dup).toHaveLength(0);
  });

  test('Accounting charge report labels exist', () => {
    expect(TRANSLATION_CATALOG).toHaveProperty('accounting_charge_handoff_review');
    expect(TRANSLATION_CATALOG).toHaveProperty('accounting_charge_staging_preview');
  });

  test('Warehouse operation labels exist', () => {
    expect(TRANSLATION_CATALOG).toHaveProperty('receiving');
    expect(TRANSLATION_CATALOG).toHaveProperty('putaway');
    expect(TRANSLATION_CATALOG).toHaveProperty('transfer');
    expect(TRANSLATION_CATALOG).toHaveProperty('adjustment');
    expect(TRANSLATION_CATALOG).toHaveProperty('stock_count');
    expect(TRANSLATION_CATALOG).toHaveProperty('withdrawal');
    expect(TRANSLATION_CATALOG).toHaveProperty('allocation');
    expect(TRANSLATION_CATALOG).toHaveProperty('picking');
    expect(TRANSLATION_CATALOG).toHaveProperty('dispatch');
  });

  test('Route/report labels exist', () => {
    expect(TRANSLATION_CATALOG).toHaveProperty('inventory_dashboard');
    expect(TRANSLATION_CATALOG).toHaveProperty('monthly_storage_billing_summary');
    expect(TRANSLATION_CATALOG).toHaveProperty('movement_ledger');
    expect(TRANSLATION_CATALOG).toHaveProperty('customer_storage_balance');
    expect(TRANSLATION_CATALOG).toHaveProperty('storage_aging');
    expect(TRANSLATION_CATALOG).toHaveProperty('warehouse_operation_performance');
  });

  test('Audit summary generates without error', () => {
    const result = auditTranslationCatalog(TRANSLATION_CATALOG);
    const summary = summarizeTranslationAudit(result);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });
});
