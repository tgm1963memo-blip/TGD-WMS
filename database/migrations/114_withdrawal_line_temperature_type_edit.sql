-- Allow warehouse/admin staff to record or correct temperature_type on
-- customer withdrawal request lines from the admin review screen.

begin;

alter table public.tgd_customer_withdrawal_request_lines
  add column if not exists temperature_type text;

alter table public.tgd_customer_withdrawal_request_lines
  drop constraint if exists tgd_customer_withdrawal_request_lines_temperature_type_check;

alter table public.tgd_customer_withdrawal_request_lines
  add constraint tgd_customer_withdrawal_request_lines_temperature_type_check
  check (
    temperature_type is null
    or temperature_type in ('FROZEN', 'FREEZE', 'CHILLED', 'AMBIENT', 'FREEZE_FROZEN')
  );

create or replace function public.tgd_update_withdrawal_line_temperature_type(
  p_line_id uuid,
  p_temperature_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_temperature_type text := nullif(upper(btrim(coalesce(p_temperature_type, ''))), '');
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin') then
    raise exception 'Admin or warehouse role required';
  end if;

  if v_temperature_type is not null
     and v_temperature_type not in ('FROZEN', 'FREEZE', 'CHILLED', 'AMBIENT', 'FREEZE_FROZEN') then
    raise exception 'Invalid temperature_type: %', v_temperature_type;
  end if;

  update public.tgd_customer_withdrawal_request_lines
  set temperature_type = v_temperature_type
  where id = p_line_id;

  if not found then
    raise exception 'Withdrawal request line not found';
  end if;

  return jsonb_build_object(
    'id', p_line_id,
    'temperature_type', v_temperature_type
  );
end;
$$;

revoke all on function public.tgd_update_withdrawal_line_temperature_type(uuid, text) from public;
grant execute on function public.tgd_update_withdrawal_line_temperature_type(uuid, text) to authenticated;

commit;
