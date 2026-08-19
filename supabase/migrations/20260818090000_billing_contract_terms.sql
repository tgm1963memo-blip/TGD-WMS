-- Adds customer contract terms to the storage rate engine: a minimum
-- charge floor, a contract validity window (start/end date), a free-days
-- grace period, and a percentage discount — plus the matching traceability
-- columns on invoice draft lines so every adjustment shows up on the
-- persisted line, not just in a live preview.
--
-- Fully additive: every new column is nullable (or defaults to false for
-- the two booleans). Every existing rate row and every existing invoice
-- draft line is unaffected — resolveServiceRate/computeStorageInvoiceLines
-- (see src/utils/billingRateCalc.js) treat a null contract window / null
-- free_days / null discount_percent / null min_charge_amount exactly as
-- they did before these columns existed.
--
-- The RPC signature change below only APPENDS new defaulted parameters
-- after the existing 12 — Postgres allows this via `create or replace
-- function` without dropping it, so any existing caller that doesn't pass
-- the 6 new params keeps working unchanged.

begin;

alter table public.tgd_customer_product_service_rates
  add column if not exists min_charge_amount numeric,
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists free_days integer,
  add column if not exists discount_percent numeric,
  add column if not exists contract_note text;

comment on column public.tgd_customer_product_service_rates.min_charge_amount is
  'Minimum charge per billing cycle for this rate — final amount = greatest(computed, min_charge_amount) when set. Null = no floor (existing behavior).';
comment on column public.tgd_customer_product_service_rates.contract_start_date is
  'Rate only resolvable for a cycle/receipt on or after this date, when set. Null = always valid from the start (existing behavior).';
comment on column public.tgd_customer_product_service_rates.contract_end_date is
  'Rate only resolvable for a cycle/receipt on or before this date, when set. Null = never expires (existing behavior).';
comment on column public.tgd_customer_product_service_rates.free_days is
  'Initial N days from a lot''s receipt date that are billed at zero. Null = no free period (existing behavior).';
comment on column public.tgd_customer_product_service_rates.discount_percent is
  '0-100, applied to the computed amount before the min_charge_amount floor. Null = no discount (existing behavior).';
comment on column public.tgd_customer_product_service_rates.contract_note is
  'Human-readable reason for the contract terms above, shown on invoice line adjustment notes.';

alter table public.tgd_billing_invoice_draft_lines
  add column if not exists discount_amount numeric,
  add column if not exists min_charge_applied boolean not null default false,
  add column if not exists min_charge_topup_amount numeric,
  add column if not exists free_period_applied boolean not null default false,
  add column if not exists adjustment_note text;

comment on column public.tgd_billing_invoice_draft_lines.discount_amount is
  'Baht amount subtracted by the rate''s discount_percent, if any. Null when no discount applied.';
comment on column public.tgd_billing_invoice_draft_lines.min_charge_applied is
  'True when this line''s amount was topped up to the rate''s min_charge_amount floor.';
comment on column public.tgd_billing_invoice_draft_lines.min_charge_topup_amount is
  'Baht amount added to reach min_charge_amount, when min_charge_applied is true.';
comment on column public.tgd_billing_invoice_draft_lines.free_period_applied is
  'True when this line fell within the rate''s free_days window and was billed at zero.';
comment on column public.tgd_billing_invoice_draft_lines.adjustment_note is
  'Human-readable summary of whichever contract-term adjustments applied to this line, if any.';

-- Append 6 new defaulted params to the existing 12-param upsert RPC.
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
