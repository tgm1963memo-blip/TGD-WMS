-- Fixes two related bugs in the "one rate per customer/product/service_type"
-- uniqueness rule on tgd_customer_product_service_rates:
--
-- 1. FROZEN vs CHILLED all-items STORAGE rates could not coexist. The
--    all-items unique index was (customer_id, service_type) only — it did
--    not consider temperature_type, so saving a CHILLED STORAGE rate for a
--    customer silently overwrote that customer's existing FROZEN STORAGE
--    rate (same conflict key: customer_id + 'STORAGE'), even though the
--    admin UI (CustomerProductServiceRatesPage.jsx) lets you pick a
--    temperature category specifically so the two can be priced
--    differently.
--
-- 2. Distinct ad-hoc "other" services (e.g. container reefer plug-in,
--    Slow Freeze prep fee) could not both be saved for the same customer,
--    because both naturally get entered under the same generic
--    service_type ('OTHER', or any other custom free-text type an admin
--    reuses for more than one real service) — the old unique index treated
--    service_type alone as the row's identity, so the second save
--    overwrote the first. Deposit-time auxiliary service selection
--    (CustomerDepositRequestCreatePage.jsx's auxServiceOptions) lists these
--    by rate id specifically because it expects an arbitrary number of
--    distinct configured services to exist side by side, not one per
--    service_type.
--
-- Fix: only enforce the "one rate per key" rule for the fixed/canonical
-- service types that really do mean "the current rate" (STORAGE,
-- HANDLING_IN, HANDLING_OUT, LABEL, FREEZING) — extending the all-items
-- variant of that rule to also key on temperature_type. Any other
-- service_type (OTHER, or any admin-typed custom value) is intentionally
-- exempt from the uniqueness constraint, so any number of distinct
-- auxiliary services can be configured under it.

begin;

drop index if exists public.tgd_product_service_rates_customer_uidx;
drop index if exists public.tgd_product_service_rates_product_uidx;

create unique index tgd_product_service_rates_customer_uidx
  on public.tgd_customer_product_service_rates (customer_id, service_type, (coalesce(temperature_type, '')))
  where customer_product_id is null
    and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING']);

create unique index tgd_product_service_rates_product_uidx
  on public.tgd_customer_product_service_rates (customer_product_id, service_type)
  where customer_product_id is not null
    and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING']);

create or replace function public.tgd_upsert_product_service_rate(
  p_rate_id uuid default null,
  p_customer_product_id uuid default null,
  p_service_type text default null,
  p_rate numeric default 0,
  p_unit_basis text default null,
  p_currency text default 'THB',
  p_note text default null,
  p_is_active boolean default true,
  p_customer_id uuid default null,
  p_period_days numeric default null,
  p_temperature_type text default null,
  p_max_quantity numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    on conflict (customer_product_id, service_type)
      where customer_product_id is not null
        and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING'])
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
    on conflict (customer_id, service_type, (coalesce(temperature_type, '')))
      where customer_product_id is null
        and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING'])
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
$function$;

commit;
