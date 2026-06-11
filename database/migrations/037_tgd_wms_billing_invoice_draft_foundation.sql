-- 037_tgd_wms_billing_invoice_draft_foundation.sql
-- Gate 3B-1: Invoice draft header/lines foundation (data layer only).
-- Additive only. No invoice UI, no Bplus export, no BILLED workflow.
-- Production remains HOLD. FINAL GO is NOT AUTHORIZED.

create sequence if not exists tgd_billing_invoice_draft_no_seq start 1;

create or replace function public.tgd_next_billing_invoice_draft_no()
returns text
language plpgsql
as $$
declare
  v_seq bigint;
begin
  v_seq := nextval('tgd_billing_invoice_draft_no_seq');
  return 'BID-' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

comment on function public.tgd_next_billing_invoice_draft_no() is
  'Generates sequential billing invoice draft numbers for Gate 3B-1.';

create table if not exists public.tgd_billing_invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_no text not null unique,
  customer_id uuid not null,
  customer_name text,
  billing_period_start date,
  billing_period_end date,
  status text not null default 'DRAFT',
  total_qty numeric not null default 0,
  total_net_weight numeric not null default 0,
  total_gross_weight numeric not null default 0,
  total_chargeable_weight numeric not null default 0,
  total_amount numeric,
  currency text not null default 'THB',
  note text,
  internal_reference text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  constraint tgd_billing_invoice_drafts_status_chk check (
    status in (
      'DRAFT',
      'READY_TO_REVIEW',
      'APPROVED',
      'EXPORTED_TO_BPLUS',
      'CANCELLED',
      'BILLED',
      'ON_HOLD'
    )
  )
);

create index if not exists tgd_billing_invoice_drafts_customer_idx
  on public.tgd_billing_invoice_drafts (customer_id);

create index if not exists tgd_billing_invoice_drafts_status_idx
  on public.tgd_billing_invoice_drafts (status);

create index if not exists tgd_billing_invoice_drafts_created_at_idx
  on public.tgd_billing_invoice_drafts (created_at desc);

create table if not exists public.tgd_billing_invoice_draft_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_draft_id uuid not null references public.tgd_billing_invoice_drafts (id) on delete cascade,
  source_movement_id uuid not null,
  source_document_no text,
  source_document_type text,
  customer_id uuid not null,
  product_id uuid,
  product_code text,
  product_name text,
  lot_no text,
  pallet_no text,
  movement_type text,
  movement_date timestamptz,
  qty numeric not null default 0,
  uom text,
  net_weight numeric,
  gross_weight numeric,
  chargeable_weight numeric,
  billing_status text,
  rate numeric,
  amount numeric,
  line_note text,
  duplicate_guard_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tgd_billing_invoice_draft_lines_draft_idx
  on public.tgd_billing_invoice_draft_lines (invoice_draft_id);

create index if not exists tgd_billing_invoice_draft_lines_movement_idx
  on public.tgd_billing_invoice_draft_lines (source_movement_id);

create unique index if not exists tgd_billing_invoice_draft_lines_active_movement_uidx
  on public.tgd_billing_invoice_draft_lines (source_movement_id)
  where duplicate_guard_active = true;

comment on table public.tgd_billing_invoice_drafts is
  'Gate 3B-1 billing invoice draft headers. Service foundation only.';

comment on table public.tgd_billing_invoice_draft_lines is
  'Gate 3B-1 billing invoice draft lines linked to billing movement sources.';

comment on column public.tgd_billing_invoice_draft_lines.duplicate_guard_active is
  'When true, source_movement_id is protected from reuse in another active draft. Set false on draft cancel.';

grant execute on function public.tgd_next_billing_invoice_draft_no() to authenticated;

grant select, insert, update on public.tgd_billing_invoice_drafts to authenticated;
grant select, insert, update on public.tgd_billing_invoice_draft_lines to authenticated;
