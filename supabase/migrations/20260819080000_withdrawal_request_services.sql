-- Part G: structured recording of plug-in (ค่าเสียบปลั๊ก) and overtime
-- (ค่า OT) fees on the withdrawal side. The generic per-request auxiliary
-- service mechanism already exists for deposits
-- (tgd_customer_deposit_request_services, from 20260712090000_billing_rate_engine.sql)
-- but has no withdrawal-side equivalent — this migration is an exact
-- structural/RLS/RPC mirror of that table, so withdrawal requests get the
-- same "select a configured service + quantity" capability deposits
-- already have. Staff type OT hours directly (no time-of-day/business-hours
-- auto-detection), matching the existing requires_r3_document precedent of
-- a simple staff-set value rather than an auto-derived one.
--
-- Fully additive: new table, new RPCs, no existing table/column/RPC
-- touched. A withdrawal request with no services selected behaves exactly
-- as it does today.

begin;

create table if not exists public.tgd_customer_withdrawal_request_services (
  id uuid primary key default gen_random_uuid(),
  withdrawal_request_id uuid not null references public.tgd_customer_withdrawal_requests(id) on delete cascade,
  service_rate_id uuid not null references public.tgd_customer_product_service_rates(id),
  quantity numeric not null default 1 check (quantity > 0),
  note text,
  created_by_user_id uuid references public.tgd_user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists tgd_customer_withdrawal_request_services_request_idx
  on public.tgd_customer_withdrawal_request_services (withdrawal_request_id);

alter table public.tgd_customer_withdrawal_request_services enable row level security;

drop policy if exists rls_withdrawal_request_services_select on public.tgd_customer_withdrawal_request_services;
create policy rls_withdrawal_request_services_select
  on public.tgd_customer_withdrawal_request_services
  for select
  to authenticated
  using (
    public.tgd_current_user_is_active()
    and exists (
      select 1 from public.tgd_customer_withdrawal_requests wr
      where wr.id = withdrawal_request_id
        and (
          public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff')
          or (
            public.tgd_current_user_role() in ('customer_admin', 'customer_user')
            and public.tgd_current_user_customer_id() = wr.customer_id
          )
        )
    )
  );

drop policy if exists rls_withdrawal_request_services_write on public.tgd_customer_withdrawal_request_services;
create policy rls_withdrawal_request_services_write
  on public.tgd_customer_withdrawal_request_services
  for all
  to authenticated
  using (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')
  )
  with check (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')
  );

-- RPC: upsert one selected service on a withdrawal request (create if
-- p_id is null, else update quantity/note). Exact mirror of
-- tgd_upsert_customer_deposit_request_service's role/scope checks.
create or replace function public.tgd_upsert_customer_withdrawal_request_service(
  p_withdrawal_request_id uuid,
  p_service_rate_id       uuid,
  p_quantity              numeric default 1,
  p_note                  text default null,
  p_id                    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_row public.tgd_customer_withdrawal_request_services;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;
  if not found then raise exception 'Active profile required'; end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    raise exception 'Warehouse or admin role required to manage withdrawal request services';
  end if;

  select id, customer_id into v_document
  from public.tgd_customer_withdrawal_requests
  where id = p_withdrawal_request_id;
  if not found then raise exception 'Withdrawal request not found'; end if;

  if p_id is not null then
    update public.tgd_customer_withdrawal_request_services
    set quantity = coalesce(p_quantity, quantity),
        note = p_note
    where id = p_id and withdrawal_request_id = p_withdrawal_request_id
    returning * into v_row;
    if not found then raise exception 'Withdrawal request service not found'; end if;
  else
    insert into public.tgd_customer_withdrawal_request_services (
      withdrawal_request_id, service_rate_id, quantity, note, created_by_user_id
    ) values (
      p_withdrawal_request_id, p_service_rate_id, coalesce(p_quantity, 1), p_note, v_profile.id
    )
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.tgd_upsert_customer_withdrawal_request_service(uuid, uuid, numeric, text, uuid)
  to authenticated;

create or replace function public.tgd_delete_customer_withdrawal_request_service(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role text;
begin
  if v_auth_user_id is null then raise exception 'Authentication required'; end if;

  select p.role into v_role
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if v_role not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    raise exception 'Warehouse or admin role required to manage withdrawal request services';
  end if;

  delete from public.tgd_customer_withdrawal_request_services where id = p_id;
  return jsonb_build_object('id', p_id, 'deleted', true);
end;
$$;

grant execute on function public.tgd_delete_customer_withdrawal_request_service(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
