# 23J: Supabase RLS and Environment Diagnosis

## 1. Context & Hypothesis
Following the diagnostic deployment in `23I`, the UAT environment explicitly verified that both products and warehouses loaders are successfully invoked, but receive exactly `0 rows` back from the `supabase-js` client without triggering any postgrest errors. Since manual SQL queries confirm the data exists (`tgd_products` and `tgd_warehouses`), we must diagnose the backend restriction.

The two leading hypotheses are:
- **A. Environment Mismatch**: The frontend running on Vercel is pointing to a different Supabase project URL than the one containing our verified test data.
- **B. RLS Blocking**: The target environment correctly points to the expected database, but Row-Level Security (RLS) is enabled on `tgd_products` and `tgd_warehouses` with strict policies that silently evaluate to false for the anonymous or unauthenticated role, safely returning 0 rows.

## 2. Frontend Diagnostic Telemetry (23J)
To safely identify the target environment without compromising security keys, the following has been implemented:
- Inspected the Supabase client (`src/services/supabaseClient.js`) and confirmed it uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Modified `ReceivingCreatePage.jsx` to parse `import.meta.env.VITE_SUPABASE_URL` and extract strictly the `host` string.
- Rendered this host directly to the `#diagnostic-23j` UI panel for Playwright scraping.
- **No Sensitive Exposure**: Neither the full URL path nor the ANON KEY are exposed in the DOM or logs.

## 3. Required Manual SQL Diagnostic Checks
If the environment mismatch diagnosis (via the Playwright evidence) indicates the frontend is correctly talking to the intended project, an authorized database administrator must execute the following non-mutating SQL commands to diagnose RLS:

### a. Check RLS Status
```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('tgd_products', 'tgd_warehouses', 'tgd_customers');
```

### b. Audit Existing Policies
```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('tgd_products', 'tgd_warehouses', 'tgd_customers')
order by tablename, policyname;
```

### c. Verify Raw Data Count
```sql
select 'tgd_products' as table_name, count(*) from public.tgd_products
union all
select 'tgd_warehouses', count(*) from public.tgd_warehouses
union all
select 'tgd_customers', count(*) from public.tgd_customers;
```

## 4. Security & Rollout Boundaries
> [!WARNING]
> **Production Context**
> - **No automated SQL fixes have been applied.**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
