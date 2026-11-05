-- ค่าละลาย (THAW): customers/TGC staff tick "ละลาย" per withdrawal line, and
-- the period invoice draft bills picked weight x a per-kg THAW rate, dated by
-- the withdrawal's confirmed dispatch day — the same mechanism as HANDLING_OUT
-- (computeHandlingOutFeeLines in src/utils/billingRateCalc.js).
--
-- THAW joins the canonical service types in both partial unique indexes and
-- the matching ON CONFLICT predicates of tgd_upsert_product_service_rate (see
-- 20260819090000_fix_service_rate_uniqueness_missing_types.sql for why the
-- two must match). The function body below is the live definition as of
-- 2026-11-05 with only 'THAW' added to those two arrays.

begin;

-- 1. Per-line flag
alter table public.tgd_customer_withdrawal_request_lines
  add column if not exists requires_thaw boolean not null default false,
  add column if not exists thaw_set_by_email text,
  add column if not exists thaw_set_at timestamptz;

-- 2. THAW as a canonical rate type
drop index if exists public.tgd_product_service_rates_customer_uidx;
drop index if exists public.tgd_product_service_rates_product_uidx;

create unique index tgd_product_service_rates_customer_uidx
  on public.tgd_customer_product_service_rates (customer_id, service_type, (coalesce(temperature_type, '')))
  where customer_product_id is null
    and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME', 'OVERTIME_HOLIDAY', 'THAW']);

create unique index tgd_product_service_rates_product_uidx
  on public.tgd_customer_product_service_rates (customer_product_id, service_type)
  where customer_product_id is not null
    and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME', 'OVERTIME_HOLIDAY', 'THAW']);

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
        and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME', 'OVERTIME_HOLIDAY', 'THAW'])
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
        and service_type = any (array['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'R3_DOCUMENT', 'PLUG_IN', 'OVERTIME', 'OVERTIME_HOLIDAY', 'THAW'])
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

-- 3. Tick/untick ละลาย on one line. Customers only while the request is a
-- draft; TGC staff (proxy roles) at any status short of cancelled/rejected,
-- since thawing is often decided at the dock.
create or replace function public.tgd_set_withdrawal_line_thaw(
  p_line_id uuid,
  p_requires_thaw boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_line record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active profile required';
  end if;

  if p_requires_thaw is null then
    raise exception 'p_requires_thaw is required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select l.id, l.line_no, l.customer_product_code, l.requires_thaw,
         w.id as request_id, w.customer_id, w.status
  into v_line
  from public.tgd_customer_withdrawal_request_lines l
  join public.tgd_customer_withdrawal_requests w on w.id = l.withdrawal_request_id
  where l.id = p_line_id
  for update of l;

  if not found then
    raise exception 'Withdrawal line not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_line.customer_id
  );

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_line.status <> 'WITHDRAWAL_DRAFT' then
      raise exception 'ละลาย can only be changed by the customer while the request is WITHDRAWAL_DRAFT';
    end if;
  elsif v_line.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot set ละลาย on a cancelled/rejected request';
  end if;

  if v_line.requires_thaw is distinct from p_requires_thaw then
    update public.tgd_customer_withdrawal_request_lines
    set requires_thaw = p_requires_thaw,
        thaw_set_by_email = v_profile.email,
        thaw_set_at = now()
    where id = v_line.id;

    insert into public.tgd_customer_document_timeline_events (
      document_type, document_id, customer_id, action, from_status, to_status,
      actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
    ) values (
      'CUSTOMER_WITHDRAWAL_REQUEST', v_line.request_id, v_line.customer_id,
      'SET_LINE_THAW', v_line.status, v_line.status,
      v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
      format('รายการที่ %s (%s): %s', v_line.line_no, coalesce(v_line.customer_product_code, '-'),
        case when p_requires_thaw then 'ต้องการละลาย' else 'ไม่ละลาย' end),
      jsonb_build_object('line_id', v_line.id, 'requires_thaw', p_requires_thaw, 'previous', v_line.requires_thaw)
    );
  end if;

  return jsonb_build_object(
    'id', v_line.id,
    'requires_thaw', p_requires_thaw,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

revoke all on function public.tgd_set_withdrawal_line_thaw(uuid, boolean) from public, anon;
grant execute on function public.tgd_set_withdrawal_line_thaw(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
