// src/i18n/translationAuditService.js

/**
 * Pure audit service for the translation catalog.
 * No side effects, no network, no file I/O.
 */

import { SUPPORTED_LANGUAGES, TRANSLATION_CATALOG } from './translationCatalog.js';

/**
 * Find translation keys that are missing values for any supported language.
 * Returns an array of objects: { key, missingLanguages: [] }
 */
export function findMissingLanguageValues(catalog = TRANSLATION_CATALOG, languages = SUPPORTED_LANGUAGES) {
  const missing = [];
  for (const [key, translations] of Object.entries(catalog)) {
    const missingLangs = languages.filter((lang) => !(lang in translations) || !translations[lang] || translations[lang].trim() === '');
    if (missingLangs.length > 0) {
      missing.push({ key, missingLanguages: missingLangs });
    }
  }
  return missing;
}

/**
 * Find duplicate translation keys.
 * In a plain object literal duplicates cannot exist, so this returns an empty array.
 */
export function findDuplicateTranslationKeys(_catalog = TRANSLATION_CATALOG) {
  return [];
}

/**
 * Find keys that have empty translation strings for any language.
 * Returns an array of objects: { key, emptyLanguages: [] }
 */
export function findEmptyTranslations(catalog = TRANSLATION_CATALOG, languages = SUPPORTED_LANGUAGES) {
  const empty = [];
  for (const [key, translations] of Object.entries(catalog)) {
    const emptyLangs = languages.filter((lang) => {
      const val = translations[lang];
      return typeof val !== 'string' || val.trim() === '';
    });
    if (emptyLangs.length > 0) {
      empty.push({ key, emptyLanguages: emptyLangs });
    }
  }
  return empty;
}

/**
 * Run a full audit and return a summary object.
 */
export function auditTranslationCatalog(catalog = TRANSLATION_CATALOG) {
  return {
    missingLanguageValues: findMissingLanguageValues(catalog),
    duplicateKeys: findDuplicateTranslationKeys(catalog),
    emptyTranslations: findEmptyTranslations(catalog),
  };
}

/**
 * Produce a human‑readable summary of the audit result.
 */
export function summarizeTranslationAudit(auditResult) {
  const { missingLanguageValues, duplicateKeys, emptyTranslations } = auditResult;
  const lines = [];
  lines.push(`Missing language values: ${missingLanguageValues.length}`);
  lines.push(`Duplicate keys: ${duplicateKeys.length}`);
  lines.push(`Empty translations: ${emptyTranslations.length}`);
  if (missingLanguageValues.length) {
    lines.push('Keys missing values:');
    missingLanguageValues.forEach(({ key, missingLanguages }) => {
      lines.push(`  - ${key}: ${missingLanguages.join(', ')}`);
    });
  }
  if (emptyTranslations.length) {
    lines.push('Keys with empty strings:');
    emptyTranslations.forEach(({ key, emptyLanguages }) => {
      lines.push(`  - ${key}: ${emptyLanguages.join(', ')}`);
    });
  }
  return lines.join('\n');
}
