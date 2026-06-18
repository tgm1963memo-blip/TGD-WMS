-- Migration 059: Add actual receipt columns to deposit request lines
-- Allows warehouse staff to record actual received quantities per product line.

alter table public.tgd_customer_deposit_request_lines
  add column if not exists actual_boxes integer,
  add column if not exists actual_weight numeric,
  add column if not exists actual_note text;

-- Function for warehouse/admin staff to record actual received quantities
create or replace function public.tgd_record_deposit_line_actual_receipt(
  p_line_id uuid,
  p_actual_boxes integer,
  p_actual_weight numeric,
  p_note text default null
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
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff') then
    raise exception 'Warehouse or admin role required to record actual receipt';
  end if;

  select l.id, l.deposit_request_id
  into v_line
  from public.tgd_customer_deposit_request_lines l
  where l.id = p_line_id;

  if not found then
    raise exception 'Deposit request line not found';
  end if;

  update public.tgd_customer_deposit_request_lines
  set actual_boxes  = p_actual_boxes,
      actual_weight = p_actual_weight,
      actual_note   = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_line_id;

  return jsonb_build_object(
    'id', v_line.id,
    'deposit_request_id', v_line.deposit_request_id,
    'actual_boxes', p_actual_boxes,
    'actual_weight', p_actual_weight
  );
end;
$$;

grant execute on function public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text)
  to authenticated;
