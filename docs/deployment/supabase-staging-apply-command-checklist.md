# Sprint 13J - Controlled Supabase Staging Apply

Project: TGD WMS
Phase: 13J-A Preflight / Documentation Only
Status: Prepared only
Controller Approval: Pending
Production Apply: Not executed
Staging Apply: Not executed
UI Live Write: Not implemented
Real Warehouse Transaction: Not executed

## Apply Command Checklist

- Command: `supabase db push --file ./sql/**/*.sql`
- Flag: `--stop-on-failure` (ensures abort on any error)
- Backup path template: `C:\TGD-WMS-Backups\staging\`
- Staging Project Reference: `<STAGING_PROJECT_REF_MASKED>`
- No real Supabase URL, API key, or secret is present.
- **Do not continue after failure** – the `--stop-on-failure` flag enforces this.
