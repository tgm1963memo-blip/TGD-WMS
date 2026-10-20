-- OT type (วันทำการ / วันหยุดพิเศษ) on deposit/withdrawal requests, and a
-- separate OVERTIME_HOLIDAY service rate with its own rate and minimum.
-- Billing pools OT per customer + work day + OT type and applies the rate's
-- min_charge_amount once per pool (computeOvertimePoolLines in
-- src/utils/billingRateCalc.js).
--
-- The set-overtime RPCs gain p_overtime_type. The old 4-argument versions
-- are dropped first: keeping them beside a 5-argument overload with
-- defaults would make named-argument calls ambiguous.
--
-- OVERTIME_HOLIDAY is added to both partial unique indexes and to the
-- matching ON CONFLICT predicates in tgd_upsert_product_service_rate (see
-- 20260819090000_fix_service_rate_uniqueness_missing_types.sql for why the
-- two must match). The function body below is the live definition with
-- only that list changed.

begin;

alter table public.tgd_customer_withdrawal_requests
  add column if not exists overtime_type text not null default 'WORKDAY'
    check (overtime_type in ('WORKDAY', 'HOLIDAY'));

alter table public.tgd_customer_deposit_requests
  add column if not exists overtime_type text not null default 'WORKDAY'
    check (overtime_type in ('WORKDAY', 'HOLIDAY'));

drop function if exists public.tgd_set_withdrawal_overtime(uuid, boolean, text, uuid);

create or replace function public.tgd_set_withdrawal_overtime(
  p_request_id  uuid,
  p_is_overtime boolean,
  p_note        text default null,
  p_actor_profile_id uuid default null,
  p_overtime_type text default 'WORKDAY'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_session_profile record;
  v_profile record;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_type text := upper(coalesce(nullif(btrim(p_overtime_type), ''), 'WORKDAY'));
  v_document record;
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_session_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if p_is_overtime is null then
    raise exception 'p_is_overtime is required';
  end if;

  if v_type not in ('WORKDAY', 'HOLIDAY') then
    raise exception 'p_overtime_type must be WORKDAY or HOLIDAY';
  end if;

  if not public.tgd_role_function_allowed(
    v_session_profile.role, 'customer_withdrawal_set_overtime',
    v_session_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to set overtime';
  end if;

  -- Handheld: the device session may be shared, so credit the staff member
  -- picked on the handheld, same as tgd_set_withdrawal_dispatch_time.
  v_profile := v_session_profile;
  if p_actor_profile_id is not null then
    select p.id, p.email, p.role into v_profile
    from public.tgd_user_profiles p
    where p.id = p_actor_profile_id
      and p.is_active = true
      and p.role = any(v_allowed_roles)
    limit 1;
    if not found then
      v_profile := v_session_profile;
    end if;
  end if;

  select w.id, w.customer_id, w.status, w.is_overtime, w.overtime_note, w.overtime_type
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot set overtime on a cancelled/rejected request';
  end if;

  update public.tgd_customer_withdrawal_requests
  set is_overtime = p_is_overtime,
      overtime_type = v_type,
      overtime_note = v_note,
      overtime_set_by_email = v_profile.email,
      overtime_set_at = now(),
      last_action_by_user_id = v_session_profile.id,
      last_action_by_email = v_session_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'SET_OVERTIME',
    v_profile.id, v_profile.email, v_profile.role, null,
    case when not p_is_overtime then 'ไม่คิด OT' when v_type = 'HOLIDAY' then 'OT วันหยุดพิเศษ' else 'OT วันทำการ' end || coalesce(': ' || v_note, ''),
    jsonb_build_object(
      'is_overtime', p_is_overtime, 'overtime_type', v_type, 'note', v_note,
      'previous', v_document.is_overtime, 'previous_type', v_document.overtime_type, 'previous_note', v_document.overtime_note
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'is_overtime', p_is_overtime,
    'overtime_type', v_type,
    'note', v_note,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

revoke all on function public.tgd_set_withdrawal_overtime(uuid, boolean, text, uuid, text) from public;
grant execute on function public.tgd_set_withdrawal_overtime(uuid, boolean, text, uuid, text) to authenticated;

drop function if exists public.tgd_set_deposit_overtime(uuid, boolean, text, uuid);

create or replace function public.tgd_set_deposit_overtime(
  p_request_id  uuid,
  p_is_overtime boolean,
  p_note        text default null,
  p_actor_profile_id uuid default null,
  p_overtime_type text default 'WORKDAY'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_session_profile record;
  v_profile record;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_type text := upper(coalesce(nullif(btrim(p_overtime_type), ''), 'WORKDAY'));
  v_document record;
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_session_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if p_is_overtime is null then
    raise exception 'p_is_overtime is required';
  end if;

  if v_type not in ('WORKDAY', 'HOLIDAY') then
    raise exception 'p_overtime_type must be WORKDAY or HOLIDAY';
  end if;

  if not public.tgd_role_function_allowed(
    v_session_profile.role, 'customer_deposit_set_overtime',
    v_session_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to set overtime';
  end if;

  v_profile := v_session_profile;
  if p_actor_profile_id is not null then
    select p.id, p.email, p.role into v_profile
    from public.tgd_user_profiles p
    where p.id = p_actor_profile_id
      and p.is_active = true
      and p.role = any(v_allowed_roles)
    limit 1;
    if not found then
      v_profile := v_session_profile;
    end if;
  end if;

  select d.id, d.customer_id, d.status, d.is_overtime, d.overtime_note, d.overtime_type
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot set overtime on a cancelled/rejected request';
  end if;

  update public.tgd_customer_deposit_requests
  set is_overtime = p_is_overtime,
      overtime_type = v_type,
      overtime_note = v_note,
      overtime_set_by_email = v_profile.email,
      overtime_set_at = now(),
      last_action_by_user_id = v_session_profile.id,
      last_action_by_email = v_session_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'SET_OVERTIME',
    v_profile.id, v_profile.email, v_profile.role, null,
    case when not p_is_overtime then 'ไม่คิด OT' when v_type = 'HOLIDAY' then 'OT วันหยุดพิเศษ' else 'OT วันทำการ' end || coalesce(': ' || v_note, ''),
    jsonb_build_object(
      'is_overtime', p_is_overtime, 'overtime_type', v_type, 'note', v_note,
      'previous', v_document.is_overtime, 'previous_type', v_document.overtime_type, 'previous_note', v_document.overtime_note
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'is_overtime', p_is_overtime,
    'overtime_type', v_type,
    'note', v_note,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

revoke all on function public.tgd_set_deposit_overtime(uuid, boolean, text, uuid, text) from public;
grant execute on function public.tgd_set_deposit_overtime(uuid, boolean, text, uuid, text) to authenticated;

drop index if exists public.tgd_product_service_rates_customer_uidx;
drop index if exists public.tgd_product_service_rates_product_uidx;

create unique index tgd_product_service_rates_customer_uidx
  on public.tgd_customer_product_service_rates (customer_id, service_type, (coalesce(temperature_type, '')))
  where customer_product_id is null
    and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME', 'OVERTIME_HOLIDAY']);

create unique index tgd_product_service_rates_product_uidx
  on public.tgd_customer_product_service_rates (customer_product_id, service_type)
  where customer_product_id is not null
    and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME', 'OVERTIME_HOLIDAY']);

CREATE OR REPLACE FUNCTION public.tgd_upsert_product_service_rate(p_rate_id uuid DEFAULT NULL::uuid, p_customer_product_id uuid DEFAULT NULL::uuid, p_service_type text DEFAULT NULL::text, p_rate numeric DEFAULT 0, p_unit_basis text DEFAULT NULL::text, p_currency text DEFAULT 'THB'::text, p_note text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_customer_id uuid DEFAULT NULL::uuid, p_period_days numeric DEFAULT NULL::numeric, p_temperature_type text DEFAULT NULL::text, p_max_quantity numeric DEFAULT NULL::numeric, p_min_charge_amount numeric DEFAULT NULL::numeric, p_contract_start_date date DEFAULT NULL::date, p_contract_end_date date DEFAULT NULL::date, p_free_days integer DEFAULT NULL::integer, p_discount_percent numeric DEFAULT NULL::numeric, p_contract_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME', 'OVERTIME_HOLIDAY'])
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
        and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME', 'OVERTIME_HOLIDAY'])
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
