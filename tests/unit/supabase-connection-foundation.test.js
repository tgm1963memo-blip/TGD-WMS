// tests/unit/supabase-connection-foundation.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import { getSupabaseConfig, validateSupabaseConfig, getSupabaseConfigStatus } from '../../src/config/supabaseConfig.js';
import { summarizeSupabaseReadiness } from '../../src/services/supabaseConnectionReadinessService.js';

// Helper to mock import.meta.env – Vite replaces at build time, but for vitest we can set globals
function setEnv(url, anon) {
  // @ts-ignore
  import.meta.env = {
    VITE_SUPABASE_URL: url ?? '',
    VITE_SUPABASE_ANON_KEY: anon ?? '',
  };
  // Set test env override
  globalThis.__supabaseTestEnv = {
    VITE_SUPABASE_URL: url ?? '',
    VITE_SUPABASE_ANON_KEY: anon ?? '',
  };
}

describe('Supabase configuration validation', () => {
  it('missing env -> not ready', () => {
    setEnv('', '');
    const status = getSupabaseConfigStatus();
    expect(status.isConfigured).toBe(false);
    expect(status.urlConfigured).toBe(false);
    expect(status.anonKeyConfigured).toBe(false);
  });

  it('missing URL -> not ready', () => {
    setEnv('', 'validanonkey1234');
    const status = getSupabaseConfigStatus();
    expect(status.urlConfigured).toBe(false);
    expect(status.isConfigured).toBe(false);
    expect(status.issues).toContain('VITE_SUPABASE_URL is missing');
  });

  it('missing anon key -> not ready', () => {
    setEnv('https://example.supabase.co', '');
    const status = getSupabaseConfigStatus();
    expect(status.anonKeyConfigured).toBe(false);
    expect(status.isConfigured).toBe(false);
    expect(status.issues).toContain('VITE_SUPABASE_ANON_KEY is missing');
  });

  it('invalid URL format -> not ready', () => {
    setEnv('http://invalid-url.com', 'validanonkey1234');
    const status = getSupabaseConfigStatus();
    expect(status.issues).toContain('VITE_SUPABASE_URL has invalid format');
    expect(status.isConfigured).toBe(false);
  });

  it('placeholder env values -> not ready', () => {
    setEnv('https://', 'abc'); // short placeholder
    const status = getSupabaseConfigStatus();
    expect(status.isConfigured).toBe(false);
    expect(status.issues).toContain('VITE_SUPABASE_ANON_KEY appears to be a placeholder');
  });

  it('valid URL and anon key -> ready', () => {
    setEnv('https://myproject.supabase.co', 'validanonkey12345678');
    const status = getSupabaseConfigStatus();
    expect(status.isConfigured).toBe(true);
    expect(status.isSafeForFrontend).toBe(true);
    expect(status.issues.length).toBe(0);
  });

  it('service_role-like key detection -> fail', () => {
    setEnv('https://myproject.supabase.co', 'service_role_key_123');
    const status = getSupabaseConfigStatus();
    expect(status.serviceRoleExposed).toBe(true);
    expect(status.isConfigured).toBe(false);
    expect(status.issues).toContain('Supabase anon key appears to be a service_role key');
  });

  it('config status does not expose full key', () => {
    setEnv('https://myproject.supabase.co', 'validanonkey12345678');
    const status = getSupabaseConfigStatus();
    expect(status.maskedAnonKey).not.toContain('validanonkey12345678');
    expect(status.maskedAnonKey).toMatch(/^.{4}••••.{4}$/);
  });

  it('readiness summary returns next action', () => {
    setEnv('', '');
    const summary = summarizeSupabaseReadiness();
    expect(summary.nextActions.length).toBeGreaterThan(0);
  });

  it('UI translation keys exist', async () => {
    // Ensure translation catalog contains supabase keys
    // @ts-ignore
    import.meta.env = {};
    // Dynamically import to get catalog
    // eslint-disable-next-line import/no-unresolved
    const { getTranslation } = await import('../../src/i18n/translationCatalog.js');
    expect(getTranslation('supabase_readiness.title', 'th')).toBe('สถานะการเชื่อมต่อ Supabase');
    expect(getTranslation('supabase_readiness.title', 'en')).toBe('Supabase Connection Readiness');
  });
});
