-- 042_uat_foundation_remediation_draft.sql
-- UAT-FOUNDATION-REMEDIATION-1: UAT-only schema drift remediation draft.
-- DRAFT ONLY — do NOT apply without Controller approval.
-- Do NOT apply to Production. Production should use full canonical chain (001_core, 009, 010, …).
-- Purpose: unblock CUSTOMER-PORTAL-2D migrations 040/041 on UAT (lievvsqbosvrolkrftna).
-- No data deletion. No stock movement execution. No profile linkage. No auth changes.

begin;

-- ---------------------------------------------------------------------------
-- 1. Canonical updated_at trigger function (missing on UAT)
-- Source: database/migrations/001_core_master_data.sql
-- Required by: 040 customer portal header triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'UAT-REMEDIATION-042: canonical updated_at trigger helper from 001_core_master_data. UAT draft only.';

-- ---------------------------------------------------------------------------
-- 2. Canonical picking documents shell (missing on UAT; legacy tgd_picking_tasks exists)
-- Source: database/migrations/010_picking_foundation.sql (structure only)
-- Required by: 041 tgd_customer_withdrawal_execution_links.picking_document_id FK
-- Intentionally omitted: tgd_picking_lines, tgd_confirm_picking_document RPC, allocation FK
--   (UAT lacks tgd_withdrawal_allocations from 009; full 010 is a separate gate)
-- ---------------------------------------------------------------------------

create table if not exists public.tgd_picking_documents (
  id uuid primary key default gen_random_uuid(),
  picking_no text not null unique,
  withdrawal_request_id uuid not null references public.tgd_withdrawal_requests(id),
  allocation_id uuid,
  customer_id uuid not null references public.tgd_customers(id),
  warehouse_id uuid not null references public.tgd_warehouses(id),
  status text not null default 'DRAFT',
  picking_method text not null default 'MANUAL',
  assigned_to uuid references public.tgd_user_profiles(id),
  planned_pick_date date,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references public.tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_picking_documents_status_check check (
    status in ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'PICKED', 'CANCELLED')
  ),
  constraint tgd_picking_documents_method_check check (
    picking_method in ('MANUAL', 'FIFO', 'FEFO', 'HANDHELD_SCAN', 'SYSTEM_SUGGESTED')
  )
);

comment on table public.tgd_picking_documents is
  'UAT-REMEDIATION-042: canonical picking document shell for 041 FK. Full 010 lines/RPC apply is a separate gate.';

create index if not exists tgd_picking_documents_picking_no_idx
  on public.tgd_picking_documents (picking_no);
create index if not exists tgd_picking_documents_withdrawal_request_id_idx
  on public.tgd_picking_documents (withdrawal_request_id);
create index if not exists tgd_picking_documents_customer_id_idx
  on public.tgd_picking_documents (customer_id);
create index if not exists tgd_picking_documents_status_idx
  on public.tgd_picking_documents (status);

drop trigger if exists set_tgd_picking_documents_updated_at on public.tgd_picking_documents;
create trigger set_tgd_picking_documents_updated_at
before update on public.tgd_picking_documents
for each row execute function public.set_updated_at();

-- Deferred: allocation_id FK to tgd_withdrawal_allocations until migration 009 exists on UAT.
-- Deferred: tgd_picking_lines and tgd_confirm_picking_document until full 010 gate approved.

commit;
