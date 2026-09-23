-- The CDR staff work order print (CustomerDepositStaffWorkOrderPrint.jsx)
-- has always had "GOODS TEMP" and "TRUCK / CON. TEMP" rows, and the admin
-- detail modal already showed a (mislabeled, always-blank) "อุณหภูมิจัดเก็บ
-- (ที่ลูกค้าแจ้ง)" field reading header.goods_temp -- but no goods_temp or
-- truck_temp column has ever existed on tgd_customer_deposit_requests, so
-- both always rendered '-'. These are readings the receiving staff/admin
-- take when goods physically arrive, not something the customer declares,
-- so this adds the columns plus an RPC for admin to record them, and the
-- modal's field becomes editable instead of read-only.

begin;

alter table public.tgd_customer_deposit_requests
  add column if not exists goods_temp text,
  add column if not exists truck_temp text;

create or replace function public.tgd_set_deposit_receiving_temperature(
  p_request_id uuid,
  p_field      text,
  p_value      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_field text := upper(nullif(btrim(p_field), ''));
  v_value text := nullif(btrim(coalesce(p_value, '')), '');
  v_document record;
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_field not in ('GOODS', 'TRUCK') then
    raise exception 'p_field must be GOODS or TRUCK';
  end if;

  if not public.tgd_role_function_allowed(
    v_profile.role, 'customer_deposit_record_receiving_temperature',
    v_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to record receiving temperature';
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot record receiving temperature on a cancelled/rejected request';
  end if;

  if v_field = 'GOODS' then
    update public.tgd_customer_deposit_requests
    set goods_temp = v_value,
        last_action_by_user_id = v_profile.id,
        last_action_by_email = v_profile.email,
        last_action_at = now()
    where id = v_document.id;
  else
    update public.tgd_customer_deposit_requests
    set truck_temp = v_value,
        last_action_by_user_id = v_profile.id,
        last_action_by_email = v_profile.email,
        last_action_at = now()
    where id = v_document.id;
  end if;

  return jsonb_build_object(
    'id', v_document.id,
    'field', v_field,
    'value', v_value
  );
end;
$$;

revoke all on function public.tgd_set_deposit_receiving_temperature(uuid, text, text) from public;
grant execute on function public.tgd_set_deposit_receiving_temperature(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
