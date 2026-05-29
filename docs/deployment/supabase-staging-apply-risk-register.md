# Supabase Staging Apply Risk Register

## Risk matrix
| Risk ID | Description | Severity (1‑5) | Likelihood (1‑5) | Risk Score (S×L) | Mitigation | Owner | Status |
|---------|-------------|----------------|------------------|-------------------|------------|-------|--------|
| R01 | Wrong Supabase project/environment (staging vs production) applied. | 5 | 2 | 10 | Use distinct project URLs and anon keys, double‑check environment variables, require Controller sign‑off before any `supabase db push`. | Lead Dev | Open |
| R02 | Accidental production apply by mistake. | 5 | 1 | 5 | CI pipeline must lock production URL, scripts require explicit `--project-id prod` flag, gate with manual approval. | DevOps | Open |
| R03 | service_role exposure in frontend or docs. | 4 | 2 | 8 | Never commit `.env.*`, remove any `service_role` references, only comment warnings allowed. | Security Lead | Open |
| R04 | RLS policies too permissive (granting unintended access). | 4 | 3 | 12 | Validate RLS using SQL checklist, run smoke tests for isolation, peer‑review policies. | Security Lead | Open |
| R05 | RLS policies too restrictive (blocking legitimate access). | 3 | 3 | 9 | Smoke test includes admin and staff scenarios, rollback plan ready. | Lead Dev | Open |
| R06 | Seed data conflicts with existing demo data (duplicate keys). | 3 | 3 | 9 | Use unique UUIDs, truncate tables before seed, verify seed file IDs are fresh. | Data Engineer | Open |
| R07 | Trigger double‑counting leading to incorrect balances. | 4 | 2 | 8 | Trigger creation is single; include idempotent `DROP IF EXISTS` before create, test with multiple movements. | Lead Dev | Open |
| R08 | Negative stock balance after movement insert. | 4 | 2 | 8 | Business rule validation in RPC, smoke test verifies balance never negative. | Lead Dev | Open |
| R09 | RPC privilege escalation (users can call RPC they shouldn't). | 4 | 2 | 8 | RPC functions defined with `SECURITY DEFINER` and RLS checks inside, test roles. | Security Lead | Open |
| R10 | Customer data leakage to other customers. | 5 | 2 | 10 | RLS isolation validated, audit logs verified, rollback ready. | Security Lead | Open |
| R11 | Rollback failure (cannot revert applied objects). | 4 | 2 | 8 | Backup dump before apply, documented rollback steps per object, test rollback in a copy environment. | DevOps | Open |
| R12 | UI accidentally connected to staging before approval. | 3 | 2 | 6 | Feature flag gating UI, require Controller approval before enabling connection. | Frontend Lead | Open |

> **Prepared only – no execution performed.**
