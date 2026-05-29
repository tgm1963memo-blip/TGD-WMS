import fs from 'fs';
import path from 'path';
import {
  APP_ENV,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  REQUIRED_PUBLIC_ENV_KEYS,
  OPTIONAL_PUBLIC_ENV_KEYS,
  getPublicEnvValue,
  validateAppConfig,
  summarizeAppConfigValidation,
} from '../../src/config/appConfig.js';
import {
  FORBIDDEN_ENV_KEY_PATTERNS,
  findForbiddenEnvKeys,
  findMissingRequiredPublicEnvKeys,
  findEmptyEnvValues,
  auditFrontendConfigSafety,
} from '../../src/config/configSafetyAudit.js';

describe('appConfig', () => {
  test('exports exist', () => {
    expect(typeof APP_ENV).toBe('string');
    expect(typeof IS_PRODUCTION).toBe('boolean');
    expect(typeof IS_DEVELOPMENT).toBe('boolean');
    expect(Array.isArray(REQUIRED_PUBLIC_ENV_KEYS)).toBe(true);
    expect(Array.isArray(OPTIONAL_PUBLIC_ENV_KEYS)).toBe(true);
    expect(typeof getPublicEnvValue).toBe('function');
    expect(typeof validateAppConfig).toBe('function');
    expect(typeof summarizeAppConfigValidation).toBe('function');
  });

  test('validation summary object shape is correct', () => {
    const summary = summarizeAppConfigValidation({
      VITE_SUPABASE_URL: 'https://example.invalid',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key',
    });

    expect(summary).toMatchObject({
      status: 'READY',
      ok: true,
      forbiddenKeys: [],
      missingRequiredKeys: [],
      emptyValueKeys: [],
    });
    expect(Array.isArray(summary.requiredKeys)).toBe(true);
    expect(Array.isArray(summary.optionalKeys)).toBe(true);
  });
});

describe('configSafetyAudit', () => {
  test('exports exist', () => {
    expect(Array.isArray(FORBIDDEN_ENV_KEY_PATTERNS)).toBe(true);
    expect(typeof findForbiddenEnvKeys).toBe('function');
    expect(typeof findMissingRequiredPublicEnvKeys).toBe('function');
    expect(typeof findEmptyEnvValues).toBe('function');
    expect(typeof auditFrontendConfigSafety).toBe('function');
  });

  test('forbidden env key patterns detect secret-like keys', () => {
    const forbidden = findForbiddenEnvKeys({
      VITE_SERVICE_ROLE_KEY: 'x',
      VITE_PRIVATE_API_KEY: 'x',
      VITE_DATABASE_URL: 'x',
      VITE_PUBLIC_LABEL: 'ok',
    });

    expect(forbidden).toEqual([
      'VITE_SERVICE_ROLE_KEY',
      'VITE_PRIVATE_API_KEY',
      'VITE_DATABASE_URL',
    ]);
  });

  test('missing required public keys are reported', () => {
    expect(findMissingRequiredPublicEnvKeys({ VITE_SUPABASE_URL: 'x' }, REQUIRED_PUBLIC_ENV_KEYS)).toEqual([
      'VITE_SUPABASE_ANON_KEY',
    ]);
  });

  test('empty values are reported', () => {
    expect(findEmptyEnvValues({ VITE_READY: 'ok', VITE_EMPTY: '   ', VITE_NULL: null })).toEqual([
      'VITE_EMPTY',
      'VITE_NULL',
    ]);
  });

  test('no service role, secret, password, or private token is allowed', () => {
    const result = auditFrontendConfigSafety(
      {
        VITE_SUPABASE_URL: 'https://example.invalid',
        VITE_SUPABASE_ANON_KEY: 'public-anon-key',
        VITE_SECRET_VALUE: 'blocked',
        VITE_PASSWORD_VALUE: 'blocked',
        VITE_PRIVATE_TOKEN: 'blocked',
      },
      REQUIRED_PUBLIC_ENV_KEYS,
    );

    expect(result.ok).toBe(false);
    expect(result.forbiddenKeys).toEqual([
      'VITE_SECRET_VALUE',
      'VITE_PASSWORD_VALUE',
      'VITE_PRIVATE_TOKEN',
    ]);
  });

  test('no network calls or file writes in config source', () => {
    const files = [
      '../../src/config/appConfig.js',
      '../../src/config/configSafetyAudit.js',
    ];

    files.forEach((file) => {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).not.toMatch(/fetch\s*\(/);
      expect(source).not.toMatch(/axios/);
      expect(source).not.toMatch(/XMLHttpRequest/);
      expect(source).not.toMatch(/writeFile/);
    });
  });
});
