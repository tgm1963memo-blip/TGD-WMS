# 23D: Controlled UAT Role Override for Receiving Transaction UAT

## 1. Context and Root Cause from 23C
During Phase 23C diagnosis, we discovered that the "Create Receiving Draft" button was hidden in the UAT environment because the `hasRoleAccess(userRole, 'warehouse_staff')` guard evaluated to `false`. The application defaults to the `PRODUCTION_FALLBACK_ROLE` (`'viewer'`) when running in production-like environments where the demo role selector is disabled. Furthermore, because there is no `public.tgd_user_profiles` schema deployed to Supabase, no real user profiles exist to provide the correct role context. This resulted in the Receiving Create UI being inaccessible, blocking the Playwright transaction tests.

## 2. Controlled UAT Role Override
To unblock Transaction UAT without making unauthorized database modifications, we implemented a controlled UAT role override. This allows UAT testers and Playwright automation to explicitly set their session role via environment variables strictly within a UAT boundary.

### Exact Environment Variables
To activate the override, **BOTH** of the following environment variables must be configured in the deployment platform (e.g., Vercel) for the UAT environment, or locally:
- `VITE_UAT_MODE=true` or `VITE_APP_ENV=uat`
- `VITE_UAT_ROLE_OVERRIDE=warehouse_staff`

### Allowed Roles
The system strictly limits the override to the following recognized values:
- `warehouse_staff`
- `supervisor`
- `admin`

Any other value will be rejected, and the system will safely fall back to `'viewer'`.

## 3. Security Boundary
- **Role Guard Preserved:** The original `hasRoleAccess` security guard remains completely intact. We did NOT implement unconditional write access.
- **Production Safety:** This override logic explicitly requires `VITE_UAT_MODE` or `VITE_APP_ENV=uat`. It will NOT silently activate in standard Production if `VITE_UAT_ROLE_OVERRIDE` is accidentally leaked, because true Production uses `VITE_APP_ENV=production` and lacks `VITE_UAT_MODE=true`.
- **Database Safety:** No schema modifications or database roles were altered.

## 4. How to Set for Testing

### In Vercel for UAT
1. Go to your Project Settings > Environment Variables.
2. Select the Preview or UAT environment.
3. Add `VITE_UAT_MODE` and set it to `true`.
4. Add `VITE_UAT_ROLE_OVERRIDE` and set it to `warehouse_staff`.
5. Trigger a new deployment for the changes to take effect.

### Locally for Playwright
You can run the application with the override by setting the environment variables in your `.env.local` or inline:
```bash
VITE_UAT_MODE=true VITE_UAT_ROLE_OVERRIDE=warehouse_staff npm run dev
```

### Retest Command
Run unit tests to confirm the security boundaries:
```bash
npm test -- --run tests/unit/controlled-uat-role-override.test.js
```

> [!WARNING]
> This override is strictly a UAT gateway to validate business logic. It does not imply Go Live approval.
> **Production remains HOLD.**
> **FINAL GO is NOT AUTHORIZED.**
