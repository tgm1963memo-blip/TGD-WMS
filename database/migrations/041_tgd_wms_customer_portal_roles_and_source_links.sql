-- 041_tgd_wms_customer_portal_roles_and_source_links.sql
-- CUSTOMER-PORTAL-2C-041: Customer role constraint + source linkage + attachment status extension.
-- DRAFT ONLY — do NOT apply to UAT/Production without Controller approval.
-- Prerequisite: migration 040 applied first (customer portal source tables must exist).
-- No data deletion. No stock movement. No export. No user role assignment. No auth user changes.

begin;

-- ---------------------------------------------------------------------------
-- 1. Role constraint — extend tgd_user_profiles with customer portal roles
-- Safe pattern: DROP + ADD CHECK with NOT VALID (preserves existing rows; 007 precedent).
-- Does NOT update any profile rows or assign roles.
-- ---------------------------------------------------------------------------

alter table if exists public.tgd_user_profiles
  drop constraint if exists tgd_user_profiles_role_check;

alter table if exists public.tgd_user_profiles
  add constraint tgd_user_profiles_role_check
  check (
    role in (
      'admin',
      'warehouse_manager',
      'warehouse_staff',
      'accounting',
      'viewer',
      'customer_admin',
      'customer_user'
    )
  )
  not valid;

comment on constraint tgd_user_profiles_role_check on public.tgd_user_profiles is
  'CUSTOMER-PORTAL-041: adds customer_admin and customer_user for portal RLS. Internal roles unchanged.';

-- ---------------------------------------------------------------------------
-- 2. Header-level source linkage (hybrid Option 1) — nullable, backward compatible
-- Inspected table names: tgd_receiving_documents (004), tgd_withdrawal_requests (008).
-- NOT tgd_receiving_headers / tgd_withdrawal_request_headers.
-- ---------------------------------------------------------------------------

alter table if exists public.tgd_receiving_documents
  add column if not exists source_customer_deposit_request_id uuid;

alter table if exists public.tgd_receiving_documents
  add column if not exists source_customer_deposit_request_no text;

do $$
begin
  if to_regclass('public.tgd_customer_deposit_requests') is not null
    and not exists (
      select 1 from pg_constraint where conname = 'tgd_receiving_documents_source_deposit_request_id_fkey'
    )
  then
    alter table public.tgd_receiving_documents
      add constraint tgd_receiving_documents_source_deposit_request_id_fkey
      foreign key (source_customer_deposit_request_id)
      references public.tgd_customer_deposit_requests(id)
      not valid;
  end if;
end $$;

alter table if exists public.tgd_withdrawal_requests
  add column if not exists source_customer_withdrawal_request_id uuid;

alter table if exists public.tgd_withdrawal_requests
  add column if not exists source_customer_withdrawal_no text;

do $$
begin
  if to_regclass('public.tgd_customer_withdrawal_requests') is not null
    and not exists (
      select 1 from pg_constraint where conname = 'tgd_withdrawal_requests_source_withdrawal_request_id_fkey'
    )
  then
    alter table public.tgd_withdrawal_requests
      add constraint tgd_withdrawal_requests_source_withdrawal_request_id_fkey
      foreign key (source_customer_withdrawal_request_id)
      references public.tgd_customer_withdrawal_requests(id)
      not valid;
  end if;
end $$;

create index if not exists tgd_receiving_documents_source_deposit_request_id_idx
  on public.tgd_receiving_documents (source_customer_deposit_request_id)
  where source_customer_deposit_request_id is not null;

create index if not exists tgd_withdrawal_requests_source_withdrawal_request_id_idx
  on public.tgd_withdrawal_requests (source_customer_withdrawal_request_id)
  where source_customer_withdrawal_request_id is not null;

comment on column public.tgd_receiving_documents.source_customer_deposit_request_id is
  'Nullable FK to customer deposit source document. Manual/internal receiving keeps NULL.';
comment on column public.tgd_withdrawal_requests.source_customer_withdrawal_request_id is
  'Nullable FK to customer withdrawal source document. Complements request_source/request_reference_id.';

-- ---------------------------------------------------------------------------
-- 3. Line-level link tables (hybrid Option 2) — partial / 1:N execution support
-- ---------------------------------------------------------------------------

create table if not exists public.tgd_customer_deposit_receiving_links (
  id uuid primary key default gen_random_uuid(),
  customer_deposit_request_id uuid not null,
  customer_deposit_request_line_id uuid,
  receiving_document_id uuid not null references public.tgd_receiving_documents(id),
  receiving_line_id uuid references public.tgd_receiving_lines(id),
  link_scope text not null default 'HEADER',
  created_by_user_id uuid references public.tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  constraint tgd_customer_deposit_receiving_links_scope_check check (
    link_scope in ('HEADER', 'LINE')
  )
);

do $$
begin
  if to_regclass('public.tgd_customer_deposit_requests') is not null
    and not exists (
      select 1 from pg_constraint where conname = 'tgd_customer_deposit_receiving_links_deposit_request_id_fkey'
    )
  then
    alter table public.tgd_customer_deposit_receiving_links
      add constraint tgd_customer_deposit_receiving_links_deposit_request_id_fkey
      foreign key (customer_deposit_request_id)
      references public.tgd_customer_deposit_requests(id)
      not valid;
  end if;

  if to_regclass('public.tgd_customer_deposit_request_lines') is not null
    and not exists (
      select 1 from pg_constraint where conname = 'tgd_customer_deposit_receiving_links_deposit_line_id_fkey'
    )
  then
    alter table public.tgd_customer_deposit_receiving_links
      add constraint tgd_customer_deposit_receiving_links_deposit_line_id_fkey
      foreign key (customer_deposit_request_line_id)
      references public.tgd_customer_deposit_request_lines(id)
      not valid;
  end if;
end $$;

create table if not exists public.tgd_customer_withdrawal_execution_links (
  id uuid primary key default gen_random_uuid(),
  customer_withdrawal_request_id uuid not null,
  customer_withdrawal_request_line_id uuid,
  internal_withdrawal_request_id uuid references public.tgd_withdrawal_requests(id),
  picking_document_id uuid references public.tgd_picking_documents(id),
  dispatch_document_id uuid references public.tgd_dispatch_documents(id),
  link_scope text not null default 'HEADER',
  created_by_user_id uuid references public.tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  constraint tgd_customer_withdrawal_execution_links_scope_check check (
    link_scope in ('HEADER', 'LINE', 'PICKING', 'DISPATCH')
  )
);

do $$
begin
  if to_regclass('public.tgd_customer_withdrawal_requests') is not null
    and not exists (
      select 1 from pg_constraint where conname = 'tgd_customer_withdrawal_execution_links_withdrawal_request_id_fkey'
    )
  then
    alter table public.tgd_customer_withdrawal_execution_links
      add constraint tgd_customer_withdrawal_execution_links_withdrawal_request_id_fkey
      foreign key (customer_withdrawal_request_id)
      references public.tgd_customer_withdrawal_requests(id)
      not valid;
  end if;

  if to_regclass('public.tgd_customer_withdrawal_request_lines') is not null
    and not exists (
      select 1 from pg_constraint where conname = 'tgd_customer_withdrawal_execution_links_withdrawal_line_id_fkey'
    )
  then
    alter table public.tgd_customer_withdrawal_execution_links
      add constraint tgd_customer_withdrawal_execution_links_withdrawal_line_id_fkey
      foreign key (customer_withdrawal_request_line_id)
      references public.tgd_customer_withdrawal_request_lines(id)
      not valid;
  end if;
end $$;

create index if not exists tgd_customer_deposit_receiving_links_deposit_request_id_idx
  on public.tgd_customer_deposit_receiving_links (customer_deposit_request_id);
create index if not exists tgd_customer_deposit_receiving_links_receiving_document_id_idx
  on public.tgd_customer_deposit_receiving_links (receiving_document_id);

create index if not exists tgd_customer_withdrawal_execution_links_withdrawal_request_id_idx
  on public.tgd_customer_withdrawal_execution_links (customer_withdrawal_request_id);
create index if not exists tgd_customer_withdrawal_execution_links_internal_withdrawal_id_idx
  on public.tgd_customer_withdrawal_execution_links (internal_withdrawal_request_id);

-- ---------------------------------------------------------------------------
-- 4. Attachment status extension (requires 040 table)
-- Adds PENDING and FAILED for upload lifecycle before ACTIVE.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.tgd_customer_document_attachments') is not null then
    alter table public.tgd_customer_document_attachments
      drop constraint if exists tgd_customer_document_attachments_status_check;

    alter table public.tgd_customer_document_attachments
      add constraint tgd_customer_document_attachments_status_check
      check (status in ('PENDING', 'ACTIVE', 'FAILED', 'ARCHIVED', 'DELETED'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Link table RLS (read via customer scope; writes via RPC in Gate 2E)
-- ---------------------------------------------------------------------------

alter table if exists public.tgd_customer_deposit_receiving_links enable row level security;
alter table if exists public.tgd_customer_withdrawal_execution_links enable row level security;

drop policy if exists rls_customer_deposit_receiving_links_select on public.tgd_customer_deposit_receiving_links;
create policy rls_customer_deposit_receiving_links_select
on public.tgd_customer_deposit_receiving_links
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in (
    'admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer'
  )
);

drop policy if exists rls_customer_withdrawal_execution_links_select on public.tgd_customer_withdrawal_execution_links;
create policy rls_customer_withdrawal_execution_links_select
on public.tgd_customer_withdrawal_execution_links
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in (
    'admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer'
  )
);

revoke delete on public.tgd_customer_deposit_receiving_links from anon, authenticated;
revoke delete on public.tgd_customer_withdrawal_execution_links from anon, authenticated;

commit;
