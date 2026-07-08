# `supabase/migrations/` vs `database/migrations/`

This project has two migration directories. They are **not** kept in sync automatically.

- **`database/migrations/*.sql`** (numbered `001`, `002`, ... `112`, ...) is the directory this
  project actually deploys from. Changes are applied to the live Supabase project ad-hoc via:

  ```
  npx supabase db query --linked -f "database/migrations/<file>.sql"
  ```

  (see `scripts/apply-pending-migrations.mjs` for a historical example of this pattern). This is
  the authoritative, up-to-date source — if you want to know what's actually live in the
  database, read this directory, not `supabase/migrations/`.

- **`supabase/migrations/*.sql`** (timestamp-named, the Supabase CLI's own convention) is what
  `supabase db push` / `supabase db reset` would use if anyone ever ran those commands. It had
  drifted significantly behind `database/migrations/` — missing migrations 095 through 112,
  including a stock-balance calculation bug (see `112_fix_stock_balance_lot_fanout_overcount.sql`)
  that had already been fixed in `database/migrations/` but was still present here. Those missing
  files were copied over on 2026-07-08 (timestamps `20260708100000`–`20260708100019`) so a future
  `db reset`/`db push` can't silently reintroduce an already-fixed bug. They were copied as a
  historical record only — **not** re-executed, since their changes are already live in the
  database via the `database/migrations/` path above.

**If you add a new migration**, add it to `database/migrations/` (matching the existing numbering)
and apply it via `db query -f` as above. Only mirror it into `supabase/migrations/` if you're
specifically trying to keep that directory usable for `db push`/`db reset` — otherwise it's safe
to leave it out, since nothing in this project's actual deploy path reads from it.
