-- 056_tgd_wms_facility_usage_and_storage_rate_rules.sql
-- Facility usage requests (customer portal) and per-customer storage rate rules by charge basis.

begin;

create table if not exists public.tgd_customer_facility_usage_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  customer_id uuid not null references public.tgd_customers(id),
  status text not null default 'DRAFT',
  requested_usage_date date,
  usage_type text not null default 'STORAGE_AREA',
  duration_hours numeric,
  contact_name text,
  contact_phone text,
  note text,
  created_by_user_id uuid references public.tgd_user_profiles(id),
  created_by_email text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_customer_facility_usage_requests_status_check check (
    status in ('DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED', 'ADMIN_REJECTED', 'CANCELLED')
  ),
  constraint tgd_customer_facility_usage_requests_usage_type_check check (
    usage_type in ('STORAGE_AREA', 'LOADING_DOCK', 'INSPECTION_ROOM', 'OTHER')
  )
);

create table if not exists public.tgd_customer_storage_rate_rules (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.tgd_customers(id),
  charge_basis text not null,
  rate numeric not null default 0,
  currency text not null default 'THB',
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_customer_storage_rate_rules_charge_basis_check check (
    charge_basis in ('WEIGHT', 'PALLET')
  ),
  constraint tgd_customer_storage_rate_rules_customer_basis_unique unique (customer_id, charge_basis)
);

create or replace function public.tgd_next_facility_usage_request_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
begin
  select count(*) + 1 into v_seq from public.tgd_customer_facility_usage_requests;
  return 'CFU-' || to_char(now(), 'YYYYMM') || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

create or replace function public.tgd_create_customer_facility_usage_request(
  p_requested_usage_date date default null,
  p_usage_type text default 'STORAGE_AREA',
  p_duration_hours numeric default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_note text default null,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_customer_id uuid;
  v_request_id uuid;
  v_request_no text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;

  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  v_customer_id := coalesce(p_customer_id, v_profile.customer_id);
  if v_customer_id is null then raise exception 'customer_id is required'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_customer_id);

  v_request_no := public.tgd_next_facility_usage_request_no();

  insert into public.tgd_customer_facility_usage_requests (
    request_no, customer_id, status, requested_usage_date, usage_type,
    duration_hours, contact_name, contact_phone, note, created_by_user_id, created_by_email
  ) values (
    v_request_no, v_customer_id, 'DRAFT', p_requested_usage_date,
    upper(coalesce(nullif(btrim(p_usage_type), ''), 'STORAGE_AREA')),
    p_duration_hours, nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_phone), ''),
    nullif(btrim(p_note), ''), v_profile.id, v_profile.email
  ) returning id into v_request_id;

  return jsonb_build_object('id', v_request_id, 'request_no', v_request_no, 'status', 'DRAFT');
end;
$$;

create or replace function public.tgd_submit_customer_facility_usage_request(
  p_request_id uuid
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
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;

  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select r.id, r.customer_id, r.status into v_document
  from public.tgd_customer_facility_usage_requests r
  where r.id = p_request_id for update;

  if not found then raise exception 'Facility usage request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);

  if v_document.status <> 'DRAFT' then
    raise exception 'Facility usage request must be DRAFT before submit';
  end if;

  update public.tgd_customer_facility_usage_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_at = now(),
      updated_at = now()
  where id = v_document.id;

  return jsonb_build_object('id', v_document.id, 'status', 'SUBMITTED_BY_CUSTOMER');
end;
$$;

create or replace function public.tgd_upsert_customer_storage_rate_rule(
  p_rule_id uuid default null,
  p_customer_id uuid default null,
  p_charge_basis text default null,
  p_rate numeric default null,
  p_currency text default 'THB',
  p_note text default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_basis text := upper(nullif(btrim(p_charge_basis), ''));
  v_rule_id uuid;
begin
  if auth.uid() is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = auth.uid() and p.is_active = true limit 1;

  if not found or v_profile.role not in ('admin', 'accounting') then
    raise exception 'Admin or accounting role required';
  end if;

  if p_customer_id is null then raise exception 'customer_id is required'; end if;
  if v_basis not in ('WEIGHT', 'PALLET') then raise exception 'charge_basis must be WEIGHT or PALLET'; end if;

  if p_rule_id is not null then
    update public.tgd_customer_storage_rate_rules
    set charge_basis = v_basis,
        rate = coalesce(p_rate, 0),
        currency = coalesce(nullif(btrim(p_currency), ''), 'THB'),
        note = nullif(btrim(p_note), ''),
        is_active = coalesce(p_is_active, true),
        updated_at = now()
    where id = p_rule_id and customer_id = p_customer_id
    returning id into v_rule_id;
  else
    insert into public.tgd_customer_storage_rate_rules (
      customer_id, charge_basis, rate, currency, note, is_active
    ) values (
      p_customer_id, v_basis, coalesce(p_rate, 0),
      coalesce(nullif(btrim(p_currency), ''), 'THB'),
      nullif(btrim(p_note), ''), coalesce(p_is_active, true)
    )
    on conflict (customer_id, charge_basis) do update set
      rate = excluded.rate,
      currency = excluded.currency,
      note = excluded.note,
      is_active = excluded.is_active,
      updated_at = now()
    returning id into v_rule_id;
  end if;

  return jsonb_build_object('id', v_rule_id, 'customer_id', p_customer_id, 'charge_basis', v_basis);
end;
$$;

alter table public.tgd_customer_facility_usage_requests enable row level security;
alter table public.tgd_customer_storage_rate_rules enable row level security;

drop policy if exists rls_customer_facility_usage_requests_select on public.tgd_customer_facility_usage_requests;
create policy rls_customer_facility_usage_requests_select
on public.tgd_customer_facility_usage_requests for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_storage_rate_rules_select on public.tgd_customer_storage_rate_rules;
create policy rls_customer_storage_rate_rules_select
on public.tgd_customer_storage_rate_rules for select to authenticated
using (public.tgd_current_user_is_active());

revoke insert, update, delete on public.tgd_customer_facility_usage_requests from anon, authenticated;
revoke insert, update, delete on public.tgd_customer_storage_rate_rules from anon, authenticated;

grant execute on function public.tgd_next_facility_usage_request_no() to authenticated;
grant execute on function public.tgd_create_customer_facility_usage_request(date, text, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.tgd_submit_customer_facility_usage_request(uuid) to authenticated;
grant execute on function public.tgd_upsert_customer_storage_rate_rule(uuid, uuid, text, numeric, text, text, boolean) to authenticated;

commit;
