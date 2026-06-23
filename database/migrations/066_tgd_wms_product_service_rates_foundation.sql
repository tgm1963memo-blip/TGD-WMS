-- 066_tgd_wms_product_service_rates_foundation.sql
-- Creates tgd_customer_product_service_rates table and upsert RPC.
-- These were missing from all prior migrations — referenced by productServiceRatesService.js
-- and the admin Product Service Rates page (/admin/product-service-rates).

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. Create tgd_customer_product_service_rates
-- ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.tgd_customer_product_service_rates (
  id                  uuid primary key default gen_random_uuid(),
  customer_product_id uuid not null references public.tgd_customer_products(id) on delete cascade,
  service_type        text not null check (service_type in (
                        'STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'OTHER'
                      )),
  rate                numeric not null default 0,
  unit_basis          text not null check (unit_basis in (
                        'PER_KG', 'PER_UNIT', 'PER_PALLET', 'PER_TRIP', 'PER_DAY', 'FLAT'
                      )),
  currency            text not null default 'THB',
  note                text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint tgd_product_service_rates_unique unique (customer_product_id, service_type)
);

create index if not exists tgd_product_service_rates_product_idx
  on public.tgd_customer_product_service_rates (customer_product_id);

drop trigger if exists set_tgd_product_service_rates_updated_at on public.tgd_customer_product_service_rates;
create trigger set_tgd_product_service_rates_updated_at
  before update on public.tgd_customer_product_service_rates
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ────────────────────────────────────────────────────────────────────────────────
alter table public.tgd_customer_product_service_rates enable row level security;

drop policy if exists rls_product_service_rates_read on public.tgd_customer_product_service_rates;
create policy rls_product_service_rates_read
  on public.tgd_customer_product_service_rates
  for select
  to authenticated
  using (
    public.tgd_current_user_role() in (
      'admin', 'warehouse_manager', 'warehouse_admin', 'accounting', 'viewer'
    )
  );

drop policy if exists rls_product_service_rates_write on public.tgd_customer_product_service_rates;
create policy rls_product_service_rates_write
  on public.tgd_customer_product_service_rates
  for all
  to authenticated
  using (public.tgd_current_user_role() = 'admin')
  with check (public.tgd_current_user_role() = 'admin');

-- ────────────────────────────────────────────────────────────────────────────────
-- 3. Upsert RPC
-- ────────────────────────────────────────────────────────────────────────────────
create or replace function public.tgd_upsert_product_service_rate(
  p_rate_id             uuid default null,
  p_customer_product_id uuid default null,
  p_service_type        text default null,
  p_rate                numeric default 0,
  p_unit_basis          text default null,
  p_currency            text default 'THB',
  p_note                text default null,
  p_is_active           boolean default true
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
        updated_at   = now()
    where id = p_rate_id
    returning * into v_row;

    if not found then
      raise exception 'Product service rate not found: %', p_rate_id;
    end if;
  else
    if p_customer_product_id is null or p_service_type is null or p_unit_basis is null then
      raise exception 'customer_product_id, service_type, and unit_basis are required for new rates';
    end if;

    insert into public.tgd_customer_product_service_rates (
      customer_product_id, service_type, rate, unit_basis, currency, note, is_active
    ) values (
      p_customer_product_id, p_service_type, coalesce(p_rate, 0), p_unit_basis,
      coalesce(p_currency, 'THB'), p_note, coalesce(p_is_active, true)
    )
    on conflict (customer_product_id, service_type)
    do update set
      rate       = excluded.rate,
      unit_basis = excluded.unit_basis,
      currency   = excluded.currency,
      note       = excluded.note,
      is_active  = excluded.is_active,
      updated_at = now()
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.tgd_upsert_product_service_rate(uuid, uuid, text, numeric, text, text, text, boolean)
  to authenticated;

comment on table public.tgd_customer_product_service_rates is
  'Per-product service rates for admin billing configuration (handling, storage, labeling, etc.)';
