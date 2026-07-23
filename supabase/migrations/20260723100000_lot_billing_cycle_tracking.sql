-- Per-lot recurring storage billing: lets a storage charge be generated as
-- one line per N-day cycle anchored to EACH LOT's own receipt date (e.g. a
-- lot received on the 30th bills in 30-14/15-29/30-14 windows), instead of
-- one shared period typed by staff for the whole customer. Additive only.

begin;

-- 1. tgd_billing_invoice_draft_lines: tag a storage line back to its exact
--    physical lot and the specific cycle window it covers, so a later
--    auto-billing run can find "what's the latest date already billed for
--    this lot" instead of re-deriving it from the (customer-wide,
--    line-agnostic) header period.
alter table public.tgd_billing_invoice_draft_lines
  add column if not exists deposit_line_id uuid references public.tgd_customer_deposit_request_lines(id),
  add column if not exists billing_period_start date,
  add column if not exists billing_period_end date;

comment on column public.tgd_billing_invoice_draft_lines.deposit_line_id is
  'Which physical deposit line (lot) this storage/auxiliary line was computed for. NULL for lines predating this column or not tied to one lot.';
comment on column public.tgd_billing_invoice_draft_lines.billing_period_start is
  'Start of the specific cycle window this line bills, when it differs per-lot from the draft header''s billing_period_start (auto per-lot billing). NULL for lines that share the header period as-is.';
comment on column public.tgd_billing_invoice_draft_lines.billing_period_end is
  'End of the specific cycle window this line bills. See billing_period_start.';

create index if not exists tgd_billing_invoice_draft_lines_deposit_line_idx
  on public.tgd_billing_invoice_draft_lines (deposit_line_id)
  where deposit_line_id is not null;

-- 2. One-time, per-lot seed: the first time auto per-lot billing is turned
--    on for a lot that may already have been billed under the old
--    "staff-typed date range" flow (which never recorded deposit_line_id),
--    staff must explicitly say "already billed through this date" so the
--    system never silently assumes a lot was never billed and double-charges
--    it. Deliberately a separate small table rather than reusing invoice
--    draft lines, since a seed carries no charge/amount of its own.
create table if not exists public.tgd_lot_billing_cutoff_overrides (
  id uuid primary key default gen_random_uuid(),
  deposit_line_id uuid not null references public.tgd_customer_deposit_request_lines(id) on delete cascade,
  billed_through_date date not null,
  note text,
  set_by_user_id uuid references public.tgd_user_profiles(id),
  set_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deposit_line_id)
);

comment on table public.tgd_lot_billing_cutoff_overrides is
  'One-time per-lot seed for auto per-lot storage billing: the date storage was already charged through under the prior manual date-range billing flow, entered once by staff before a lot''s first auto-billing run.';

alter table public.tgd_lot_billing_cutoff_overrides enable row level security;

drop policy if exists rls_lot_billing_cutoff_overrides_select on public.tgd_lot_billing_cutoff_overrides;
create policy rls_lot_billing_cutoff_overrides_select
on public.tgd_lot_billing_cutoff_overrides
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager')
  and (
    public.tgd_current_user_customer_id() is null
    or exists (
      select 1
      from public.tgd_customer_deposit_request_lines l
      join public.tgd_customer_deposit_requests r on r.id = l.deposit_request_id
      where l.id = tgd_lot_billing_cutoff_overrides.deposit_line_id
        and r.customer_id = public.tgd_current_user_customer_id()
    )
  )
);

drop policy if exists rls_lot_billing_cutoff_overrides_write on public.tgd_lot_billing_cutoff_overrides;
create policy rls_lot_billing_cutoff_overrides_write
on public.tgd_lot_billing_cutoff_overrides
for all
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
)
with check (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
);

notify pgrst, 'reload schema';

commit;
