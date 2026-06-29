-- Migration 083: Add FREEZE_FROZEN as a valid temperature_type value
-- Covers combined cold-storage zones (Freeze & Frozen together)

begin;

-- 1. Widen the check constraint to include FREEZE_FROZEN
alter table public.tgd_customer_storage_rate_rules
  drop constraint if exists tgd_customer_storage_rate_rules_temperature_type_check;
alter table public.tgd_customer_storage_rate_rules
  add constraint tgd_customer_storage_rate_rules_temperature_type_check
  check (temperature_type in ('CHILLED', 'FROZEN', 'FREEZE', 'FREEZE_FROZEN'));

-- 2. Replace the upsert function with updated validation
drop function if exists public.tgd_upsert_customer_storage_rate_rule(uuid, uuid, text, numeric, text, text, boolean, text);

create or replace function public.tgd_upsert_customer_storage_rate_rule(
  p_rule_id uuid default null,
  p_customer_id uuid default null,
  p_charge_basis text default null,
  p_rate numeric default null,
  p_currency text default 'THB',
  p_note text default null,
  p_is_active boolean default true,
  p_temperature_type text default 'FROZEN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_basis text := upper(nullif(btrim(p_charge_basis), ''));
  v_temp_type text := upper(nullif(btrim(p_temperature_type), ''));
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
  if v_temp_type not in ('CHILLED', 'FROZEN', 'FREEZE', 'FREEZE_FROZEN') then
    raise exception 'temperature_type must be CHILLED, FROZEN, FREEZE, or FREEZE_FROZEN';
  end if;

  if p_rule_id is not null then
    update public.tgd_customer_storage_rate_rules
    set charge_basis = v_basis,
        temperature_type = v_temp_type,
        rate = coalesce(p_rate, 0),
        currency = coalesce(nullif(btrim(p_currency), ''), 'THB'),
        note = nullif(btrim(p_note), ''),
        is_active = coalesce(p_is_active, true),
        updated_at = now()
    where id = p_rule_id and customer_id = p_customer_id
    returning id into v_rule_id;
  else
    insert into public.tgd_customer_storage_rate_rules (
      customer_id, charge_basis, temperature_type, rate, currency, note, is_active
    ) values (
      p_customer_id, v_basis, v_temp_type,
      coalesce(p_rate, 0),
      coalesce(nullif(btrim(p_currency), ''), 'THB'),
      nullif(btrim(p_note), ''),
      coalesce(p_is_active, true)
    )
    on conflict (customer_id, charge_basis, temperature_type) do update set
      rate = excluded.rate,
      currency = excluded.currency,
      note = excluded.note,
      is_active = excluded.is_active,
      updated_at = now()
    returning id into v_rule_id;
  end if;

  return jsonb_build_object(
    'id', v_rule_id,
    'customer_id', p_customer_id,
    'charge_basis', v_basis,
    'temperature_type', v_temp_type
  );
end;
$$;

grant execute on function public.tgd_upsert_customer_storage_rate_rule(uuid, uuid, text, numeric, text, text, boolean, text) to authenticated;

commit;
