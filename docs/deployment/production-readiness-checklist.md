# Production Readiness Checklist

Sprint 8D adds frontend production readiness foundations for TGD WMS. This checklist supports deployment review for the cold storage deposit, storage, and customer withdrawal system.

## Pre-Deployment Checklist

- Run `npm.cmd test` and confirm the full suite passes.
- Run `npm.cmd run build` and confirm the Vite production build succeeds.
- Confirm required public frontend config values are present.
- Confirm no secret-like keys are exposed to the frontend bundle.
- Confirm backend RLS and database policies are reviewed separately before production use.
- Confirm Thai remains the default language and English remains available.

## Env And Config Safety

- Frontend code may read only public Vite keys.
- Required public keys are checked by `src/config/appConfig.js`.
- Secret-like key names are flagged by `src/config/configSafetyAudit.js`.
- Service credentials, database passwords, private API credentials, and internal tokens must never be placed in frontend config.

## Frontend Error Boundary Status

- `src/components/common/AppErrorBoundary.jsx` catches React render errors.
- The fallback screen shows a generic message and timestamp reference.
- Stack traces and raw error details are not shown to users.
- No external reporting service is wired in Sprint 8D.

## Smoke Test Checklist

- App loads to the dashboard route.
- Sidebar navigation renders.
- Report pages render for permitted roles.
- Language toggle still switches Thai and English labels.
- Error fallback can render without language context.
- Missing public config produces a warning summary rather than a crash.

## Rollback Checklist

- Keep the last approved build artifact available.
- Roll back the deployed frontend artifact if smoke tests fail.
- Do not change database schema or policies as part of this rollback.
- Re-run `npm.cmd test` and `npm.cmd run build` after any corrective patch.

## Not Yet Production Security

- Frontend guards do not replace backend RLS.
- Frontend config validation does not prove backend access control.
- This sprint does not add authentication redesign, audit backend enforcement, or security monitoring.
- Production approval still requires backend policy review and environment review.
