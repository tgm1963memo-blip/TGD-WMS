-- 039_tgd_wms_billing_invoice_draft_rls_hardening.sql
-- Gate 3B-RLS: Billing invoice draft RLS hardening (phase 1 role + customer scope).
-- Additive only. No DROP/TRUNCATE/DELETE/RESET. Production HOLD.
-- Reuses tgd_current_user_role(), tgd_current_user_customer_id(), tgd_current_user_is_active().

alter table public.tgd_billing_invoice_drafts enable row level security;
alter table public.tgd_billing_invoice_draft_lines enable row level security;

create policy rls_billing_invoice_drafts_select
on public.tgd_billing_invoice_drafts
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
);

create policy rls_billing_invoice_drafts_insert
on public.tgd_billing_invoice_drafts
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
);

create policy rls_billing_invoice_drafts_update
on public.tgd_billing_invoice_drafts
for update
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
)
with check (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
);

create policy rls_billing_invoice_draft_lines_select
on public.tgd_billing_invoice_draft_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.tgd_billing_invoice_drafts d
    where d.id = tgd_billing_invoice_draft_lines.invoice_draft_id
      and public.tgd_current_user_is_active()
      and public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager')
      and (
        public.tgd_current_user_customer_id() is null
        or public.tgd_current_user_customer_id() = d.customer_id
      )
  )
);

create policy rls_billing_invoice_draft_lines_insert
on public.tgd_billing_invoice_draft_lines
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
  and exists (
    select 1
    from public.tgd_billing_invoice_drafts d
    where d.id = invoice_draft_id
      and (
        public.tgd_current_user_customer_id() is null
        or public.tgd_current_user_customer_id() = d.customer_id
      )
  )
);

create policy rls_billing_invoice_draft_lines_update
on public.tgd_billing_invoice_draft_lines
for update
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
  and exists (
    select 1
    from public.tgd_billing_invoice_drafts d
    where d.id = invoice_draft_id
      and (
        public.tgd_current_user_customer_id() is null
        or public.tgd_current_user_customer_id() = d.customer_id
      )
  )
)
with check (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
  and exists (
    select 1
    from public.tgd_billing_invoice_drafts d
    where d.id = invoice_draft_id
      and (
        public.tgd_current_user_customer_id() is null
        or public.tgd_current_user_customer_id() = d.customer_id
      )
  )
);

comment on table public.tgd_billing_invoice_drafts is
  'Gate 3B-1 billing invoice draft headers. RLS hardened Gate 3B-RLS.';

comment on table public.tgd_billing_invoice_draft_lines is
  'Gate 3B-1 billing invoice draft lines. RLS hardened Gate 3B-RLS.';
