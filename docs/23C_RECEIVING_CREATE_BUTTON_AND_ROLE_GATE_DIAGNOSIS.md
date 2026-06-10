# 23C: Receiving Create Button and Role Gate Diagnosis

## 1. Context and Evidence
- The Receiving Create Draft button is missing on the UAT/Production environment.
- The Playwright tests reported: `Receiving draft creation BLOCKED because a:has-text("Create Receiving Draft") was not found.`
- The UAT database (Supabase) does not have a `tgd_user_profiles` table, meaning there is no backend source of truth for user roles/profiles.
- Phase 23B UI commits (`25e3b8f Implement controlled receiving create UI`, `456075a Add receiving business process review...`) were successfully committed and pushed to the `main` branch.

## 2. Source Code Findings
- **ReceivingListPage.jsx:** 
  The component imports `getCurrentUserRole` from `src/security/currentUserRole.js`.
  ```jsx
  const userRole = getCurrentUserRole();
  const canWrite = hasRoleAccess(userRole, 'warehouse_staff');
  ```
  The button is conditionally rendered:
  ```jsx
  createHref={canWrite ? "/operations/receiving/create" : null}
  createLabel={canWrite ? "Create Receiving Draft" : null}
  ```
- **currentUserRole.js & demoRoleSelectorControl.js:**
  `getCurrentUserRole()` is a "Frontend-only demo role source".
  If `isDemoRoleSelectorAllowed` evaluates to false (which it does in UAT/Production mode unless overridden), `getCurrentUserRole()` automatically returns the `PRODUCTION_FALLBACK_ROLE`, which is `'viewer'`.
- **permissionGuard.js:**
  The `hasRoleAccess` function checks the user's role against the required role level based on the `ROLE_HIERARCHY`. A `'viewer'` (level 1) does NOT have access to `'warehouse_staff'` (level 2) permissions. Thus, `canWrite` evaluates to `false`.
- **Database / Backend Profile Source:**
  There is no `public.tgd_user_profiles` table. Although `supabaseAuthRoleMappingService.js` contains a foundation for mapping auth profiles, it depends on a non-existent table.

## 3. Root Cause Classification
**Primary Root Causes:**
- **D. button hidden by role guard:** The UI logic successfully hides the write features because the evaluated role does not meet the `warehouse_staff` minimum requirement.
- **E. role/profile source missing:** In UAT/Production, the demo role fallback returns `'viewer'`. Because there is no real `tgd_user_profiles` table or Supabase JWT role metadata configured to replace the demo context with a real user role, every user defaults to a `'viewer'`. 

## 4. Required Next Fix Recommendation
**Option A: Implement a safe UAT role fallback only in controlled UAT mode.**
*Description:* Given that the real user profile schema is not yet designed, approved, or deployed, we cannot safely implement Option B or C without breaking strict constraints (no schema modifications, no production GO). The safest way to unblock UAT while preserving production security is to introduce a specific environment variable override (e.g., `VITE_UAT_ROLE_OVERRIDE`) or allow the demo selector specifically in the UAT configuration, *but explicitly assert that it fails in true production.*

**However, the most robust and formally correct approach for the enterprise would be:**
**Option B: Create proper user role/profile schema in a separate approved phase.**
*Description:* In a follow-up phase, carefully design and deploy the `tgd_user_profiles` table. Hook up the Supabase Auth listener to populate a React Context with the true authenticated role.

**Recommendation for Immediate UAT Unblocking:**
Pursue **Option A** as a temporary, explicitly documented exception for the UAT environment to allow testers to proceed, or **Option D: Keep write gate locked and mark Transaction UAT BLOCKED** until the business signs off on Option B.

## 5. Security & Constraint Adherence
- NO Supabase schema modifications were made.
- NO database migrations were created.
- NO data was inserted, updated, or deleted.
- NO stock balances were altered.
- Production remains HOLD.
- FINAL GO is NOT AUTHORIZED.
