-- Migration 091: Add admin_note to withdrawal request lines
--
-- Adds a free-text admin_note column to tgd_customer_withdrawal_request_lines
-- so TGC admin can annotate individual line items during the review/dispatch process.
-- Also creates a dedicated RPC for updating only the admin note on a line.

begin;

alter table public.tgd_customer_withdrawal_request_lines
  add column if not exists admin_note text;

-- RPC: update admin_note on a single withdrawal line
create or replace function public.tgd_update_withdrawal_line_admin_note(
  p_line_id   uuid,
  p_admin_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
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

  update public.tgd_customer_withdrawal_request_lines
  set admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where id = p_line_id;

  if not found then
    raise exception 'Withdrawal request line not found';
  end if;

  return jsonb_build_object('id', p_line_id, 'admin_note', p_admin_note);
end;
$$;

revoke all on function public.tgd_update_withdrawal_line_admin_note(uuid, text) from public;
grant execute on function public.tgd_update_withdrawal_line_admin_note(uuid, text) to authenticated;

commit;
