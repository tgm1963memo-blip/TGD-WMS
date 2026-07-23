-- Lets admin recode a withdrawal line's customer_product_code/lot_no
-- directly, and — the important part — keeps them in sync when the
-- tracking code is corrected: tracking_code is globally unique across
-- tgd_customer_deposit_request_lines (104_deposit_line_tracking_code.sql),
-- so a corrected tracking code identifies exactly one physical lot; this
-- re-derives customer_product_code/lot_no/source_customer_deposit_request_*
-- from THAT lot rather than leaving them independently stale.
--
-- Mirrors 20260722140000_admin_recode_deposit_line_product_code.sql's
-- "resolve from a trusted source, reject rather than silently desync"
-- shape, one step downstream (withdrawal line -> its source deposit line,
-- instead of deposit line -> catalog).
--
-- Also replaces the prior bare client-side .update() used for tracking-code
-- edits (updateWithdrawalLineTrackingCode in
-- customerWithdrawalRequestService.js), which had no role check at all,
-- unlike every sibling write on this table.

begin;

create or replace function public.tgd_admin_update_withdrawal_line_source(
  p_line_id               uuid,
  p_customer_product_code text default null,
  p_lot_no                text default null,
  p_tracking_code         text default null
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
  v_new_tracking_code text := nullif(btrim(coalesce(p_tracking_code, '')), '');
  v_source record;
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

  select l.id, wr.customer_id
  into v_line
  from public.tgd_customer_withdrawal_request_lines l
  join public.tgd_customer_withdrawal_requests wr on wr.id = l.withdrawal_request_id
  where l.id = p_line_id;

  if not found then
    raise exception 'Withdrawal request line not found';
  end if;

  if v_new_tracking_code is not null then
    select dl.id as deposit_line_id, dl.deposit_request_id, dl.customer_product_code, dl.lot_no, dr.customer_id
    into v_source
    from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dl.tracking_code = v_new_tracking_code;

    if not found then
      raise exception 'No deposit lot found with tracking code %', v_new_tracking_code;
    end if;

    if v_source.customer_id is distinct from v_line.customer_id then
      raise exception 'Tracking code % belongs to a different customer''s lot', v_new_tracking_code;
    end if;
  end if;

  update public.tgd_customer_withdrawal_request_lines
  set customer_product_code = case
        when v_new_tracking_code is not null then v_source.customer_product_code
        else coalesce(nullif(btrim(coalesce(p_customer_product_code, '')), ''), customer_product_code)
      end,
      lot_no = case
        when v_new_tracking_code is not null then v_source.lot_no
        else coalesce(nullif(btrim(coalesce(p_lot_no, '')), ''), lot_no)
      end,
      tracking_code = case
        when p_tracking_code is not null then v_new_tracking_code
        else tracking_code
      end,
      source_customer_deposit_request_line_id = case
        when v_new_tracking_code is not null then v_source.deposit_line_id
        else source_customer_deposit_request_line_id
      end,
      source_customer_deposit_request_id = case
        when v_new_tracking_code is not null then v_source.deposit_request_id
        else source_customer_deposit_request_id
      end
  where id = p_line_id;

  return (
    select jsonb_build_object(
      'id', l.id,
      'customer_product_code', l.customer_product_code,
      'lot_no', l.lot_no,
      'tracking_code', l.tracking_code,
      'source_customer_deposit_request_line_id', l.source_customer_deposit_request_line_id,
      'source_customer_deposit_request_id', l.source_customer_deposit_request_id
    )
    from public.tgd_customer_withdrawal_request_lines l
    where l.id = p_line_id
  );
end;
$$;

revoke all on function public.tgd_admin_update_withdrawal_line_source(uuid, text, text, text) from public;
grant execute on function public.tgd_admin_update_withdrawal_line_source(uuid, text, text, text) to authenticated;

commit;
