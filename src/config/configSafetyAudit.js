export const FORBIDDEN_ENV_KEY_PATTERNS = [
  /SERVICE_ROLE/i,
  /SECRET/i,
  /PRIVATE/i,
  /PASSWORD/i,
  /TOKEN/i,
  /DATABASE_URL/i,
];

function entriesFromEnv(envObject = {}) {
  return Object.entries(envObject || {});
}

export function findForbiddenEnvKeys(envObject = {}) {
  return entriesFromEnv(envObject)
    .filter(([key]) => FORBIDDEN_ENV_KEY_PATTERNS.some((pattern) => pattern.test(key)))
    .map(([key]) => key);
}

export function findMissingRequiredPublicEnvKeys(envObject = {}, requiredKeys = []) {
  return requiredKeys.filter((key) => !Object.prototype.hasOwnProperty.call(envObject, key));
}

export function findEmptyEnvValues(envObject = {}) {
  return entriesFromEnv(envObject)
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([key]) => key);
}

export function auditFrontendConfigSafety(envObject = {}, requiredKeys = []) {
  const forbiddenKeys = findForbiddenEnvKeys(envObject);
  const missingRequiredKeys = findMissingRequiredPublicEnvKeys(envObject, requiredKeys);
  const emptyValueKeys = findEmptyEnvValues(envObject);

  return {
    ok: forbiddenKeys.length === 0 && missingRequiredKeys.length === 0 && emptyValueKeys.length === 0,
    forbiddenKeys,
    missingRequiredKeys,
    emptyValueKeys,
  };
}
