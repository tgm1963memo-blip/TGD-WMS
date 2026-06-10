# 23N: Controlled Location Master Read Policy for Receiving UAT

## 1. Confirmed RLS Root Cause
During Receiving line entry (Scenario C), Playwright was blocked at the Location selection dropdown, recording a `MISSING_OPTION: Cannot find option matching QC-HOLD-01` error. The actual table `public.tgd_locations` contains data including `QC-HOLD-01`, but it had RLS enabled with no `SELECT` policy allowing authenticated users to read it. As a result, the frontend received 0 rows, blocking the selection.

## 2. Policy Implementation
To resolve this while maintaining strict boundaries, we implemented Migration `033_tgd_wms_controlled_location_read_policy.sql` with the following configuration:
- Targets `public.tgd_locations` exclusively.
- Applies ONLY to the `SELECT` operation (`for select`).
- Granted only to the `authenticated` role (`to authenticated`).
- No `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` privileges were granted.
- No `FOR ALL` policy was used.

## 3. Frontend Updates
The frontend `getReceivingLocations()` query in `receivingService.js` was updated to explicitly select `id, code, name, description` to map correctly to the required data structure without assuming legacy aliases like `room_code` or `warehouse_code`, ensuring clean data flow to the UI picker.

## 4. Migration Status
- Migration file `database/migrations/033_tgd_wms_controlled_location_read_policy.sql` has been staged.
- **Migration file created. Equivalent SQL was manually applied in Supabase SQL Editor on UAT environment.** It awaits explicit Controller approval.

## 5. Security & Rollout Boundaries
> [!WARNING]
> **Production Context**
> - **No write access (insert/update/delete) was granted to master data.**
> - **No direct stock balance updates were made.**
> - **No movement ledger bypass was executed.**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
