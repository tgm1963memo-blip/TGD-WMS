-- Lets admin/warehouse_manager/warehouse_admin ("tgc admin"/"manager")
-- recall a deposit request that's already had receipt confirmed, within 24
-- hours of confirmation, back to WAREHOUSE_RECEIVING so the received
-- quantities/lines can be corrected (e.g. staff mis-keyed a count, or
-- realized a line needs fixing shortly after confirming). This is a much
-- more consequential undo than the earlier pre-confirmation recall
-- (tgd_recall_customer_deposit_request, DRAFT/SUBMITTED_BY_CUSTOMER/
-- ADMIN_REVIEWING only) — CONFIRM_RECEIPT already created real
-- tgd_stock_movements rows and incremented tgd_stock_balances
-- (tgd_create_stock_movements_from_deposit), so recalling it must reverse
-- both, not just flip a status flag.
--
-- Per explicit product decision: if ANY of this deposit's stock has
-- already been picked against a COMPLETED withdrawal in the meantime,
-- the recall is BLOCKED outright (not attempted with a partial/adjusted
-- reversal) — reversing receipt of goods that have already physically
-- left the warehouse doesn't make sense, and silently under-reversing
-- would leave stock_balances wrong in a way that's much harder to notice
-- than a blocked action with a clear reason.
--
-- actual_boxes/actual_weight on the lines are left untouched — the point
-- is to let staff edit them (via the existing recount / add-line tools,
-- both already available once back in WAREHOUSE_RECEIVING), not to wipe
-- what was already entered.

begin;

create or replace function public.tgd_recall_confirmed_deposit_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_blocking_line record;
  v_movement record;
  v_reversed_count integer := 0;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;
  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'warehouse_manager', 'warehouse_admin') then
    raise exception 'Admin or warehouse manager/admin role required to recall a confirmed receipt';
  end if;

  select d.id, d.customer_id, d.status, d.last_action_at into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;
  if not found then
    raise exception 'Deposit request not found';
  end if;

  if v_document.status not in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED') then
    raise exception 'Request must already have receipt confirmed to recall it';
  end if;

  if v_document.last_action_at is null or now() - v_document.last_action_at > interval '1 day' then
    raise exception 'Recall window (24 hours after confirmation) has passed';
  end if;

  -- Block if any line's stock has already been picked against a completed
  -- withdrawal (exact link, or tracking-code match — same matching tiers
  -- tgd_get_customer_stock_balance already uses for this same question).
  select l.id, l.tracking_code, l.lot_no, l.customer_product_code
  into v_blocking_line
  from public.tgd_customer_deposit_request_lines l
  join public.tgd_customer_withdrawal_request_lines wl
    on wl.source_customer_deposit_request_line_id = l.id
    or (
      wl.source_customer_deposit_request_line_id is null
      and wl.tracking_code is not null
      and wl.tracking_code = l.tracking_code
    )
    or (
      wl.source_customer_deposit_request_line_id is null
      and wl.tracking_code is null
      and coalesce(nullif(btrim(wl.source_lot_no), ''), wl.lot_no) = l.lot_no
      and wl.customer_product_code = l.customer_product_code
    )
  join public.tgd_customer_withdrawal_requests wr
    on wr.id = wl.withdrawal_request_id
   and wr.status = 'COMPLETED'
  where l.deposit_request_id = p_request_id
  limit 1;

  if found then
    raise exception 'Cannot recall — stock from this deposit has already been withdrawn (LOT %, tracking %)',
      coalesce(v_blocking_line.lot_no, '-'), coalesce(v_blocking_line.tracking_code, '-');
  end if;

  -- Reverse each RECEIVE_CONFIRM movement this deposit's lines created:
  -- decrement the matching stock_balances row by the same amount, then
  -- delete the movement. Looped (not a single multi-table UPDATE) so each
  -- balance decrement is computed from the movement's own recorded
  -- quantity/weight — the simplest way to guarantee the reversal is exact.
  for v_movement in
    select sm.id, sm.customer_id, sm.product_id, sm.lot_id, sm.to_location_id as location_id,
           sm.quantity, sm.weight
    from public.tgd_stock_movements sm
    join public.tgd_customer_deposit_request_lines l on l.id = sm.source_line_id
    where l.deposit_request_id = p_request_id
      and sm.movement_type = 'RECEIVE_CONFIRM'
  loop
    if v_movement.location_id is not null then
      update public.tgd_stock_balances
      set quantity    = quantity    - v_movement.quantity,
          qty_on_hand = qty_on_hand - v_movement.quantity,
          weight      = weight      - v_movement.weight,
          updated_at  = now()
      where customer_id = v_movement.customer_id
        and product_id  = v_movement.product_id
        and location_id = v_movement.location_id
        and lot_id is not distinct from v_movement.lot_id;
    end if;

    delete from public.tgd_stock_movements where id = v_movement.id;
    v_reversed_count := v_reversed_count + 1;
  end loop;

  update public.tgd_customer_deposit_requests
  set status = 'WAREHOUSE_RECEIVING',
      has_receipt_variance = false,
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'ADMIN_RECALL_CONFIRMED', v_document.status, 'WAREHOUSE_RECEIVING',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), ''),
    jsonb_build_object('reversed_movement_count', v_reversed_count)
  );

  return jsonb_build_object(
    'id', v_document.id,
    'status', 'WAREHOUSE_RECEIVING',
    'reversed_movement_count', v_reversed_count
  );
end;
$$;

grant execute on function public.tgd_recall_confirmed_deposit_request(uuid, text) to authenticated;

commit;
