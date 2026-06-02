-- 018_tgd_wms_receiving_rpc_contract.sql
-- Sprint 13J-K Receiving RPC Migration Draft.
-- Staging review required. Production locked until Controller approval.
-- Do not apply this migration to production without explicit approval.
-- Receiving UI remains locked; this draft does not enable frontend write flows.
-- Receiving writes are RPC-only. Direct frontend table insert/update/delete is revoked.

alter table public.tgd_receiving_documents enable row level security;
alter table public.tgd_receiving_lines enable row level security;

drop policy if exists rls_receiving_documents on public.tgd_receiving_documents;
drop policy if exists rls_receiving_documents_select on public.tgd_receiving_documents;
drop policy if exists rls_receiving_documents_insert on public.tgd_receiving_documents;
drop policy if exists rls_receiving_documents_update on public.tgd_receiving_documents;
drop policy if exists rls_receiving_documents_delete on public.tgd_receiving_documents;

create policy rls_receiving_documents_select
on public.tgd_receiving_documents
for select
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'warehouse_manager', 'warehouse_staff', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
);

revoke insert, update, delete on public.tgd_receiving_documents from anon, authenticated;

drop policy if exists rls_receiving_lines_select on public.tgd_receiving_lines;
drop policy if exists rls_receiving_lines_insert on public.tgd_receiving_lines;
drop policy if exists rls_receiving_lines_update on public.tgd_receiving_lines;
drop policy if exists rls_receiving_lines_delete on public.tgd_receiving_lines;

create policy rls_receiving_lines_select
on public.tgd_receiving_lines
for select
using (
  exists (
    select 1
    from public.tgd_receiving_documents d
    where d.id = tgd_receiving_lines.document_id
      and public.tgd_current_user_is_active()
      and public.tgd_current_user_role() in ('admin', 'warehouse_manager', 'warehouse_staff', 'accounting')
      and (
        public.tgd_current_user_customer_id() is null
        or public.tgd_current_user_customer_id() = d.customer_id
      )
  )
);

revoke insert, update, delete on public.tgd_receiving_lines from anon, authenticated;

create or replace function public.tgd_rpc_create_receiving_draft(
  p_customer_id uuid,
  p_document_no text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_new_document_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required for receiving draft creation';
  end if;

  select
    p.id,
    p.auth_user_id,
    p.role,
    p.customer_id,
    p.is_active
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active user profile required for receiving draft creation';
  end if;

  if v_profile.role not in ('admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'Role % is not allowed to create receiving drafts', v_profile.role;
  end if;

  if p_customer_id is null then
    raise exception 'customer_id is required for receiving draft creation';
  end if;

  if v_profile.role = 'warehouse_staff'
    and v_profile.customer_id is not null
    and v_profile.customer_id <> p_customer_id then
    raise exception 'Customer isolation violation for receiving draft creation';
  end if;

  if nullif(btrim(p_document_no), '') is null then
    raise exception 'document_no is required for receiving draft creation';
  end if;

  insert into public.tgd_receiving_documents (
    customer_id,
    document_no,
    status
  ) values (
    p_customer_id,
    btrim(p_document_no),
    'DRAFT'
  )
  returning id into v_new_document_id;

  return v_new_document_id;
end;
$$;

create or replace function public.tgd_rpc_add_receiving_line(
  p_document_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_weight numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_new_line_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required for receiving line creation';
  end if;

  select
    p.id,
    p.auth_user_id,
    p.role,
    p.customer_id,
    p.is_active
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active user profile required for receiving line creation';
  end if;

  if v_profile.role not in ('admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'Role % is not allowed to add receiving lines', v_profile.role;
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_receiving_documents d
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'Receiving document not found';
  end if;

  if v_document.status <> 'DRAFT' then
    raise exception 'Receiving document must be DRAFT before adding lines';
  end if;

  if v_profile.customer_id is not null and v_profile.customer_id <> v_document.customer_id then
    raise exception 'Customer isolation violation for receiving line creation';
  end if;

  if p_product_id is null then
    raise exception 'product_id is required for receiving line creation';
  end if;

  if p_lot_id is null then
    raise exception 'lot_id is required for receiving line creation';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero for receiving line creation';
  end if;

  if p_weight is not null and p_weight < 0 then
    raise exception 'weight must be null or greater than or equal to zero';
  end if;

  insert into public.tgd_receiving_lines (
    document_id,
    product_id,
    lot_id,
    quantity,
    weight
  ) values (
    p_document_id,
    p_product_id,
    p_lot_id,
    p_quantity,
    p_weight
  )
  returning id into v_new_line_id;

  return v_new_line_id;
end;
$$;

create or replace function public.tgd_rpc_confirm_receiving_document(
  p_document_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_line_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required for receiving confirmation';
  end if;

  select
    p.id,
    p.auth_user_id,
    p.role,
    p.customer_id,
    p.is_active
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active user profile required for receiving confirmation';
  end if;

  if v_profile.role not in ('admin', 'warehouse_manager') then
    raise exception 'Role % is not allowed to confirm receiving documents', v_profile.role;
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_receiving_documents d
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'Receiving document not found';
  end if;

  if v_profile.customer_id is not null and v_profile.customer_id <> v_document.customer_id then
    raise exception 'Customer isolation violation for receiving confirmation';
  end if;

  if v_document.status <> 'DRAFT' then
    raise exception 'Receiving document must be DRAFT before confirmation';
  end if;

  select count(*)
  into v_line_count
  from public.tgd_receiving_lines l
  where l.document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'Receiving document must have at least one line before confirmation';
  end if;

  if exists (
    select 1
    from public.tgd_receiving_lines l
    where l.document_id = v_document.id
      and (l.quantity is null or l.quantity <= 0)
  ) then
    raise exception 'All receiving lines must have quantity greater than zero';
  end if;

  raise exception 'Receiving stock posting is not enabled until stock movement RPC accepts product_id, lot_id, and location_id';

  return v_document.id;
end;
$$;

grant execute on function public.tgd_rpc_create_receiving_draft(uuid, text) to authenticated;
grant execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.tgd_rpc_confirm_receiving_document(uuid) to authenticated;

comment on function public.tgd_rpc_create_receiving_draft(uuid, text)
is 'Sprint 13J-K staging review draft. Production locked. Receiving UI remains locked until Controller approval.';

comment on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric)
is 'Sprint 13J-K staging review draft. Production locked. Adds draft receiving line only after RLS and customer isolation review.';

comment on function public.tgd_rpc_confirm_receiving_document(uuid)
is 'Sprint 13J-K staging review draft. Production locked. Placeholder raises before stock posting until stock movement RPC accepts product_id, lot_id, and location_id.';
