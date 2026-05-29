# Config Safety Foundation

Sprint 8D introduces frontend config safety helpers for TGD WMS deployment readiness.

## Rules

- Use public Vite frontend config only.
- Keep all service credentials, database passwords, private API credentials, and internal tokens out of frontend config.
- Treat all frontend config as visible to users.
- Validate config before deployment using `summarizeAppConfigValidation()`.

## Forbidden Env Key Patterns

`src/config/configSafetyAudit.js` flags key names containing:

- `SERVICE_ROLE`
- `SECRET`
- `PRIVATE`
- `PASSWORD`
- `TOKEN`
- `DATABASE_URL`

These patterns are intentionally conservative. A public frontend key should not be named like a secret even if the value is harmless.

## Helper Usage

- `findForbiddenEnvKeys(envObject)` reports secret-like key names.
- `findMissingRequiredPublicEnvKeys(envObject, requiredKeys)` reports missing public keys.
- `findEmptyEnvValues(envObject)` reports blank values.
- `auditFrontendConfigSafety(envObject)` returns a combined status.
- `summarizeAppConfigValidation()` returns a deployment-friendly summary for the current frontend config.

## Known Limitations

- These helpers do not enforce backend RLS.
- These helpers do not scan deployed build artifacts.
- These helpers do not validate whether a public endpoint is reachable.
- These helpers do not replace manual deployment review.
