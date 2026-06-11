# UX-AUTH-1 — First-Time Password Setup (Foundation)

## Current state

TGD WMS UAT uses **Supabase Auth** with email/password sign-in. User roles and customer scope live in `tgd_user_profiles`, linked by `auth_user_id`.

There is **no in-app admin user management** in this gate. Profiles are provisioned outside the app (SQL/Supabase dashboard).

## Recommended first-time setup flow

1. **Admin creates Auth user** in Supabase Dashboard → Authentication → Users → *Add user* (email + temporary password), or via approved backend script using service role **outside the browser** (never in the client app).
2. **Admin creates/updates `tgd_user_profiles`** row with matching `auth_user_id`, `role`, `is_active`, and optional `customer_id`.
3. **Send password setup link** using one of:
   - **Invite email** (Supabase *Invite user* — user sets password from email link), or
   - **Password reset email** (`resetPasswordForEmail` with redirect to `/reset-password` — same UX as forgot password).

Both paths land on `/reset-password`, which calls `supabase.auth.updateUser({ password })` after the recovery session is established.

## UAT / Supabase configuration checklist

| Item | Action |
|------|--------|
| Site URL | Supabase Auth → URL Configuration → Site URL = UAT origin (e.g. `https://tgd-wms.vercel.app`) |
| Redirect URLs | Add `https://tgd-wms.vercel.app/reset-password` and local dev URL if needed |
| Email templates | Customize *Reset password* / *Invite* templates (TH/EN) in Supabase Auth → Email Templates |
| SMTP | Configure custom SMTP for production-like deliverability (optional for UAT) |

## What is implemented in UX-AUTH-1

- `/login` — forgot password link
- `/forgot-password` — requests reset email (generic success message to reduce email enumeration)
- `/reset-password` — set new password after recovery link
- `/settings/profile` — read-only profile + link to request password reset

## What is NOT implemented (by design)

- Full admin user CRUD UI
- Self-service role change
- Invite-user API from the browser using service role

## Security boundaries

- Client uses **anon key only**
- Role changes remain admin-only via database / approved ops tooling
- RLS on business tables unchanged in this gate
