-- Migration 092: Backfill stock movements for RECEIVED_CONFIRMED deposits
--
-- Problem: Deposits confirmed between migration 089 (broke CONFIRM_RECEIPT) and
-- migration 090 (restored it) have no stock movements → tgd_stock_balances is
-- empty for those deposits → warehouse map always shows 0%.
--
-- Fix: Call tgd_create_stock_movements_from_deposit for every RECEIVED_CONFIRMED /
-- CUSTOMER_NOTIFIED / COMPLETED deposit that has confirmed lines but no RECEIVE_CONFIRM
-- stock movement yet.  The function has a NOT EXISTS guard so this is safe to run
-- even if some movements already exist (they will be skipped, not duplicated).

begin;

do $backfill$
declare
  v_req       record;
  v_actor_id  uuid;
begin
  -- Use any active admin user as the actor (required by the function signature)
  select id into v_actor_id
  from public.tgd_user_profiles
  where role in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin')
    and is_active = true
  order by created_at
  limit 1;

  if v_actor_id is null then
    raise exception 'No active admin user found for backfill actor';
  end if;

  for v_req in
    select distinct dr.id
    from public.tgd_customer_deposit_requests dr
    join public.tgd_customer_deposit_request_lines l
      on l.deposit_request_id = dr.id
     and l.actual_boxes is not null
     and l.actual_boxes > 0
     and l.location_id is not null
    where dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED')
      -- Only process deposits that have at least one line WITHOUT a stock movement yet
      and exists (
        select 1
        from public.tgd_customer_deposit_request_lines l2
        where l2.deposit_request_id = dr.id
          and l2.actual_boxes is not null
          and not exists (
            select 1 from public.tgd_stock_movements sm
            where sm.source_line_id = l2.id
              and sm.movement_type  = 'RECEIVE_CONFIRM'
          )
      )
  loop
    raise notice 'Backfilling stock movements for deposit %', v_req.id;
    perform public.tgd_create_stock_movements_from_deposit(v_req.id, v_actor_id);
  end loop;

  raise notice 'Backfill complete.';
end;
$backfill$;

commit;
