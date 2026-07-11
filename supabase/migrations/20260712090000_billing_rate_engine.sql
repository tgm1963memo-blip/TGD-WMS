-- Billing rate engine: lets a service rate recur every N days (storage
-- fees billed per period, not once), scope a customer-wide rate to a
-- specific temperature tier (a customer can have different FROZEN/CHILLED
-- storage rates without one row per product), add PER_HOUR for time-based
-- services (e.g. container reefer plug-in billed by the hour, capped),
-- and let a customer select per-request "extra" services (container
-- plug-in, overnight flat fee, etc.) that aren't tied to any product's
-- weight at deposit time.

begin;

-- 1. tgd_customer_product_service_rates: period + temperature scope + PER_HOUR
alter table public.tgd_customer_product_service_rates
  add column if not exists period_days numeric,
  add column if not exists temperature_type text,
  add column if not exists max_quantity numeric;

alter table public.tgd_customer_product_service_rates
  drop constraint if exists tgd_product_service_rates_period_days_check;
alter table public.tgd_customer_product_service_rates
  add constraint tgd_product_service_rates_period_days_check check (
    period_days is null or period_days > 0
  );

alter table public.tgd_customer_product_service_rates
  drop constraint if exists tgd_product_service_rates_max_quantity_check;
alter table public.tgd_customer_product_service_rates
  add constraint tgd_product_service_rates_max_quantity_check check (
    max_quantity is null or max_quantity > 0
  );

alter table public.tgd_customer_product_service_rates
  drop constraint if exists tgd_customer_product_service_rates_unit_basis_check;
alter table public.tgd_customer_product_service_rates
  add constraint tgd_customer_product_service_rates_unit_basis_check check (
    unit_basis in ('PER_KG', 'PER_UNIT', 'PER_PALLET', 'PER_TRIP', 'PER_DAY', 'PER_HOUR', 'FLAT')
  );

comment on column public.tgd_customer_product_service_rates.period_days is
  'When set, this rate recurs every N days a lot remains in storage (e.g. 0.27/kg every 15 days) instead of being charged once. NULL = charged once per occurrence.';
comment on column public.tgd_customer_product_service_rates.temperature_type is
  'Only meaningful for an all-items (customer_id-scoped) rate: restricts it to products of this temperature tier (e.g. FROZEN vs CHILLED each get their own storage rate). NULL = applies regardless of temperature.';
comment on column public.tgd_customer_product_service_rates.max_quantity is
  'Optional cap on the billable quantity per occurrence (e.g. container reefer plug-in capped at 12 hours).';

-- Extend the upsert RPC to accept/persist the three new columns. Same
-- drop-then-recreate pattern as the all-items migration before it, since
-- CREATE OR REPLACE cannot change the argument list.
drop function if exists public.tgd_upsert_product_service_rate(uuid, uuid, text, numeric, text, text, text, boolean, uuid);

create or replace function public.tgd_upsert_product_service_rate(
  p_rate_id             uuid default null,
  p_customer_product_id uuid default null,
  p_service_type        text default null,
  p_rate                numeric default 0,
  p_unit_basis          text default null,
  p_currency            text default 'THB',
  p_note                text default null,
  p_is_active           boolean default true,
  p_customer_id         uuid default null,
  p_period_days         numeric default null,
  p_temperature_type    text default null,
  p_max_quantity        numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role text;
  v_row  public.tgd_customer_product_service_rates;
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.role into v_role
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if v_role not in ('admin') then
    raise exception 'Admin role required to manage product service rates';
  end if;

  if p_rate_id is not null then
    update public.tgd_customer_product_service_rates
    set service_type = coalesce(p_service_type, service_type),
        rate         = coalesce(p_rate, rate),
        unit_basis   = coalesce(p_unit_basis, unit_basis),
        currency     = coalesce(p_currency, currency),
        note         = p_note,
        is_active    = coalesce(p_is_active, is_active),
        period_days  = p_period_days,
        temperature_type = p_temperature_type,
        max_quantity = p_max_quantity,
        updated_at   = now()
    where id = p_rate_id
    returning * into v_row;

    if not found then
      raise exception 'Product service rate not found: %', p_rate_id;
    end if;

    return to_jsonb(v_row);
  end if;

  if p_service_type is null or p_unit_basis is null then
    raise exception 'service_type and unit_basis are required for new rates';
  end if;

  if (p_customer_product_id is not null and p_customer_id is not null)
     or (p_customer_product_id is null and p_customer_id is null) then
    raise exception 'Provide exactly one of customer_product_id or customer_id (for an all-items rate)';
  end if;

  if p_customer_product_id is not null then
    insert into public.tgd_customer_product_service_rates (
      customer_product_id, service_type, rate, unit_basis, currency, note, is_active,
      period_days, temperature_type, max_quantity
    ) values (
      p_customer_product_id, p_service_type, coalesce(p_rate, 0), p_unit_basis,
      coalesce(p_currency, 'THB'), p_note, coalesce(p_is_active, true),
      p_period_days, p_temperature_type, p_max_quantity
    )
    on conflict (customer_product_id, service_type) where customer_product_id is not null
    do update set
      rate       = excluded.rate,
      unit_basis = excluded.unit_basis,
      currency   = excluded.currency,
      note       = excluded.note,
      is_active  = excluded.is_active,
      period_days = excluded.period_days,
      temperature_type = excluded.temperature_type,
      max_quantity = excluded.max_quantity,
      updated_at = now()
    returning * into v_row;
  else
    insert into public.tgd_customer_product_service_rates (
      customer_id, service_type, rate, unit_basis, currency, note, is_active,
      period_days, temperature_type, max_quantity
    ) values (
      p_customer_id, p_service_type, coalesce(p_rate, 0), p_unit_basis,
      coalesce(p_currency, 'THB'), p_note, coalesce(p_is_active, true),
      p_period_days, p_temperature_type, p_max_quantity
    )
    on conflict (customer_id, service_type) where customer_product_id is null
    do update set
      rate       = excluded.rate,
      unit_basis = excluded.unit_basis,
      currency   = excluded.currency,
      note       = excluded.note,
      is_active  = excluded.is_active,
      period_days = excluded.period_days,
      temperature_type = excluded.temperature_type,
      max_quantity = excluded.max_quantity,
      updated_at = now()
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.tgd_upsert_product_service_rate(uuid, uuid, text, numeric, text, text, text, boolean, uuid, numeric, text, numeric)
  to authenticated;

-- 2. Auxiliary per-request services selected at deposit time (container
--    reefer plug-in, overnight flat fee, Slow Freeze prep, etc.) — these
--    apply to the whole deposit request / container, not a specific
--    product's weight, so they can't flow through the automatic
--    weight x rate storage engine.
create table if not exists public.tgd_customer_deposit_request_services (
  id uuid primary key default gen_random_uuid(),
  deposit_request_id uuid not null references public.tgd_customer_deposit_requests(id) on delete cascade,
  service_rate_id uuid not null references public.tgd_customer_product_service_rates(id),
  quantity numeric not null default 1 check (quantity > 0),
  note text,
  created_by_user_id uuid references public.tgd_user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists tgd_customer_deposit_request_services_request_idx
  on public.tgd_customer_deposit_request_services (deposit_request_id);

alter table public.tgd_customer_deposit_request_services enable row level security;

drop policy if exists rls_deposit_request_services_select on public.tgd_customer_deposit_request_services;
create policy rls_deposit_request_services_select
  on public.tgd_customer_deposit_request_services
  for select
  to authenticated
  using (
    public.tgd_current_user_is_active()
    and exists (
      select 1 from public.tgd_customer_deposit_requests dr
      where dr.id = deposit_request_id
        and (
          public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff')
          or (
            public.tgd_current_user_role() in ('customer_admin', 'customer_user')
            and public.tgd_current_user_customer_id() = dr.customer_id
          )
        )
    )
  );

drop policy if exists rls_deposit_request_services_write on public.tgd_customer_deposit_request_services;
create policy rls_deposit_request_services_write
  on public.tgd_customer_deposit_request_services
  for all
  to authenticated
  using (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')
  )
  with check (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')
  );

-- RPC: upsert one selected service on a deposit request (create if
-- p_id is null, else update quantity/note). Mirrors the deposit line
-- upsert RPC's role/scope checks.
create or replace function public.tgd_upsert_customer_deposit_request_service(
  p_deposit_request_id uuid,
  p_service_rate_id    uuid,
  p_quantity           numeric default 1,
  p_note               text default null,
  p_id                 uuid default null
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
  v_row public.tgd_customer_deposit_request_services;
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
    raise exception 'Warehouse or admin role required to manage deposit request services';
  end if;

  select id, customer_id into v_document
  from public.tgd_customer_deposit_requests
  where id = p_deposit_request_id;
  if not found then raise exception 'Deposit request not found'; end if;

  if p_id is not null then
    update public.tgd_customer_deposit_request_services
    set quantity = coalesce(p_quantity, quantity),
        note = p_note
    where id = p_id and deposit_request_id = p_deposit_request_id
    returning * into v_row;
    if not found then raise exception 'Deposit request service not found'; end if;
  else
    insert into public.tgd_customer_deposit_request_services (
      deposit_request_id, service_rate_id, quantity, note, created_by_user_id
    ) values (
      p_deposit_request_id, p_service_rate_id, coalesce(p_quantity, 1), p_note, v_profile.id
    )
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.tgd_upsert_customer_deposit_request_service(uuid, uuid, numeric, text, uuid)
  to authenticated;

create or replace function public.tgd_delete_customer_deposit_request_service(p_id uuid)
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
    raise exception 'Warehouse or admin role required to manage deposit request services';
  end if;

  delete from public.tgd_customer_deposit_request_services where id = p_id;
  return jsonb_build_object('id', p_id, 'deleted', true);
end;
$$;

grant execute on function public.tgd_delete_customer_deposit_request_service(uuid) to authenticated;

-- 3. Invoice draft lines: allow storage/auxiliary lines with no single
--    source movement, and carry the resolved rate/period for transparency.
alter table public.tgd_billing_invoice_draft_lines
  alter column source_movement_id drop not null;

alter table public.tgd_billing_invoice_draft_lines
  add column if not exists service_rate_id uuid references public.tgd_customer_product_service_rates(id),
  add column if not exists period_days numeric,
  add column if not exists storage_days integer;

notify pgrst, 'reload schema';

commit;
