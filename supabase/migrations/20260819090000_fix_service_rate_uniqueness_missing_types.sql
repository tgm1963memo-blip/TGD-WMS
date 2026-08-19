-- Bug fix, found via E2E testing of Part G: the two partial unique indexes
-- backing tgd_upsert_product_service_rate's ON CONFLICT upsert logic
-- restrict to a hardcoded service_type allowlist
-- ('STORAGE','HANDLING_IN','HANDLING_OUT','LABEL','FREEZING') that has never
-- included R3_DOCUMENT (a pre-existing gap) and, as of this session, also
-- excludes the newly-added PLUG_IN/OVERTIME types.
--
-- Postgres does not error when an INSERT ... ON CONFLICT (cols) WHERE <pred>
-- targets a row that doesn't satisfy <pred> — it silently skips conflict
-- detection for that row and just inserts. Confirmed by direct testing:
-- repeatedly "upserting" the same customer+OVERTIME+all-items combination
-- created 5 separate duplicate rows instead of updating one, since OVERTIME
-- isn't in the index's allowlist. The same silent-duplication risk already
-- existed for R3_DOCUMENT (e.g. via the Excel bulk-import "re-import is
-- idempotent" path, which relies entirely on this ON CONFLICT behavior) —
-- fixing it here too rather than leaving a known-bad type in production.
--
-- Fix: extend both partial unique indexes' allowlist, and re-create
-- tgd_upsert_product_service_rate's two ON CONFLICT clauses to match
-- (Postgres requires the ON CONFLICT predicate to exactly match an existing
-- index's predicate). No column/table changes, no data migration needed —
-- any duplicate rows already created during testing were manually deleted
-- via the admin UI, not by this migration.

begin;

drop index if exists public.tgd_product_service_rates_customer_uidx;
drop index if exists public.tgd_product_service_rates_product_uidx;

create unique index tgd_product_service_rates_customer_uidx
  on public.tgd_customer_product_service_rates (customer_id, service_type, (coalesce(temperature_type, '')))
  where customer_product_id is null
    and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME']);

create unique index tgd_product_service_rates_product_uidx
  on public.tgd_customer_product_service_rates (customer_product_id, service_type)
  where customer_product_id is not null
    and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME']);

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
  p_max_quantity numeric default null,
  p_min_charge_amount numeric default null,
  p_contract_start_date date default null,
  p_contract_end_date date default null,
  p_free_days integer default null,
  p_discount_percent numeric default null,
  p_contract_note text default null
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
        min_charge_amount   = p_min_charge_amount,
        contract_start_date = p_contract_start_date,
        contract_end_date   = p_contract_end_date,
        free_days           = p_free_days,
        discount_percent    = p_discount_percent,
        contract_note       = p_contract_note,
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
      period_days, temperature_type, max_quantity,
      min_charge_amount, contract_start_date, contract_end_date, free_days, discount_percent, contract_note
    ) values (
      p_customer_product_id, p_service_type, coalesce(p_rate, 0), p_unit_basis,
      coalesce(p_currency, 'THB'), p_note, coalesce(p_is_active, true),
      p_period_days, p_temperature_type, p_max_quantity,
      p_min_charge_amount, p_contract_start_date, p_contract_end_date, p_free_days, p_discount_percent, p_contract_note
    )
    on conflict (customer_product_id, service_type)
      where customer_product_id is not null
        and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME'])
    do update set
      rate       = excluded.rate,
      unit_basis = excluded.unit_basis,
      currency   = excluded.currency,
      note       = excluded.note,
      is_active  = excluded.is_active,
      period_days = excluded.period_days,
      temperature_type = excluded.temperature_type,
      max_quantity = excluded.max_quantity,
      min_charge_amount   = excluded.min_charge_amount,
      contract_start_date = excluded.contract_start_date,
      contract_end_date   = excluded.contract_end_date,
      free_days           = excluded.free_days,
      discount_percent    = excluded.discount_percent,
      contract_note       = excluded.contract_note,
      updated_at = now()
    returning * into v_row;
  else
    insert into public.tgd_customer_product_service_rates (
      customer_id, service_type, rate, unit_basis, currency, note, is_active,
      period_days, temperature_type, max_quantity,
      min_charge_amount, contract_start_date, contract_end_date, free_days, discount_percent, contract_note
    ) values (
      p_customer_id, p_service_type, coalesce(p_rate, 0), p_unit_basis,
      coalesce(p_currency, 'THB'), p_note, coalesce(p_is_active, true),
      p_period_days, p_temperature_type, p_max_quantity,
      p_min_charge_amount, p_contract_start_date, p_contract_end_date, p_free_days, p_discount_percent, p_contract_note
    )
    on conflict (customer_id, service_type, (coalesce(temperature_type, '')))
      where customer_product_id is null
        and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME'])
    do update set
      rate       = excluded.rate,
      unit_basis = excluded.unit_basis,
      currency   = excluded.currency,
      note       = excluded.note,
      is_active  = excluded.is_active,
      period_days = excluded.period_days,
      temperature_type = excluded.temperature_type,
      max_quantity = excluded.max_quantity,
      min_charge_amount   = excluded.min_charge_amount,
      contract_start_date = excluded.contract_start_date,
      contract_end_date   = excluded.contract_end_date,
      free_days           = excluded.free_days,
      discount_percent    = excluded.discount_percent,
      contract_note       = excluded.contract_note,
      updated_at = now()
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$function$;

notify pgrst, 'reload schema';

commit;
