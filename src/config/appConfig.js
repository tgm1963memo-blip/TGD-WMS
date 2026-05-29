import { auditFrontendConfigSafety } from './configSafetyAudit.js';

const publicEnv = import.meta.env || {};

function normalizeAppEnv(value) {
  if (!value || typeof value !== 'string') return 'development';
  return value.trim().toLowerCase();
}

function normalizePublicBoolean(value) {
  if (value === true || value === 'true' || value === '1' || value === 'yes') return true;
  return false;
}

export const APP_ENV = normalizeAppEnv(publicEnv.VITE_APP_ENV || publicEnv.MODE || 'development');
export const IS_PRODUCTION = APP_ENV === 'production';
export const IS_DEVELOPMENT = APP_ENV === 'development';
export const ALLOW_DEMO_ROLE_SELECTOR = normalizePublicBoolean(publicEnv.VITE_ALLOW_DEMO_ROLE_SELECTOR);

export const REQUIRED_PUBLIC_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

export const OPTIONAL_PUBLIC_ENV_KEYS = [
  'VITE_APP_ENV',
  'VITE_APP_NAME',
  'VITE_ALLOW_DEMO_ROLE_SELECTOR',
];

export function getPublicEnvValue(key) {
  if (!key || !key.startsWith('VITE_')) {
    return undefined;
  }

  return publicEnv[key];
}

export function validateAppConfig(envObject = publicEnv) {
  return auditFrontendConfigSafety(envObject, REQUIRED_PUBLIC_ENV_KEYS);
}

export function isProductionApp(envValue = APP_ENV) {
  return normalizeAppEnv(envValue) === 'production';
}

export function getAppRuntimeConfig(envObject = publicEnv) {
  const appEnvironment = normalizeAppEnv(envObject.VITE_APP_ENV || envObject.MODE || APP_ENV);

  return {
    appMode: appEnvironment,
    environment: appEnvironment,
    isProduction: isProductionApp(appEnvironment),
    allowDemoRoleSelector: normalizePublicBoolean(envObject.VITE_ALLOW_DEMO_ROLE_SELECTOR),
  };
}

export function summarizeAppConfigValidation(envObject = publicEnv) {
  const validation = validateAppConfig(envObject);

  return {
    status: validation.ok ? 'READY' : 'WARNING',
    isProduction: IS_PRODUCTION,
    isDevelopment: IS_DEVELOPMENT,
    allowDemoRoleSelector: ALLOW_DEMO_ROLE_SELECTOR,
    requiredKeys: REQUIRED_PUBLIC_ENV_KEYS,
    optionalKeys: OPTIONAL_PUBLIC_ENV_KEYS,
    ...validation,
  };
}
