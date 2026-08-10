-- Companion to 20260810090000 (which stops this from happening going
-- forward). Backfills the 45 real withdrawal requests already COMPLETED
-- with picked_boxes AND picked_weight both still null on some or all
-- lines (216 lines total) — sets both to the line's own requested_boxes/
-- requested_weight (the customer's own declared amount; the best
-- available estimate absent any real pick confirmation), stamped with
-- the document's own confirm-dispatch time/actor and a note explaining
-- this is a backfilled estimate, not a literal scan/weigh event.
--
-- Confirmed via getAuthoritativeBalanceTotals / tgd_get_customer_stock_
-- balance's own COALESCE(picked_boxes, requested_boxes) fallback that
-- this is a no-op for every customer-facing "ยอดคงเหลือ" figure — those
-- already treated a null picked_boxes as equivalent to requested_boxes.
--
-- Separately fixes tgd_sync_stock_balances_for_withdrawal (the warehouse
-- location-occupancy sync run at CONFIRM_DISPATCH, a DIFFERENT table
-- from the customer-facing balance above): it used COALESCE(picked_
-- boxes, 0) instead of the same COALESCE(picked_boxes, requested_boxes)
-- convention used everywhere else, so these 45 documents' null-picked
-- lines contributed a ZERO deduction to tgd_stock_balances at confirm
-- time. Investigated whether that left stale occupancy to correct
-- retroactively: none of the 216 affected lines' lots have ANY
-- tgd_stock_balances row at all (that table isn't populated for these
-- lots), so re-running the (now-fixed) sync below is a confirmed no-op —
-- done anyway for consistency, in case that ever changes.

begin;

create or replace function public.tgd_sync_stock_balances_for_withdrawal(
  p_withdrawal_request_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_id     uuid;
  v_line            record;
  v_lot_id          uuid;
  v_dep_location_id uuid;
  v_deduct_qty      numeric;
  v_remaining       numeric;
  v_take            numeric;
  v_bal             record;
begin
  select customer_id into v_customer_id
  from public.tgd_customer_withdrawal_requests
  where id = p_withdrawal_request_id;

  if v_customer_id is null then return; end if;

  for v_line in
    select
      wl.id,
      coalesce(nullif(btrim(wl.source_lot_no), ''), nullif(btrim(wl.lot_no), '')) as effective_lot_no,
      wl.source_customer_deposit_request_id,
      -- Matches the same coalesce(picked, requested) convention used by
      -- every other balance computation in this codebase (tgd_get_
      -- customer_stock_balance, getAuthoritativeBalanceTotals, etc.) —
      -- a line with no picked_boxes recorded is treated as claiming its
      -- requested amount, not zero.
      coalesce(wl.picked_boxes, wl.requested_boxes, 0) as picked_boxes
    from public.tgd_customer_withdrawal_request_lines wl
    where wl.withdrawal_request_id = p_withdrawal_request_id
      and coalesce(wl.picked_boxes, wl.requested_boxes, 0) > 0
  loop
    if v_line.effective_lot_no is null then continue; end if;

    select lt.id into v_lot_id
    from public.tgd_lots lt
    where lt.lot_number = v_line.effective_lot_no
      and lt.customer_id = v_customer_id
    limit 1;

    if v_lot_id is null then continue; end if;

    v_dep_location_id := null;
    if v_line.source_customer_deposit_request_id is not null then
      select dl.location_id into v_dep_location_id
      from public.tgd_customer_deposit_request_lines dl
      where dl.deposit_request_id = v_line.source_customer_deposit_request_id
        and dl.lot_no = v_line.effective_lot_no
        and dl.location_id is not null
      order by dl.line_no
      limit 1;
    end if;

    v_deduct_qty := v_line.picked_boxes;

    if v_dep_location_id is not null then
      update public.tgd_stock_balances
      set qty_on_hand = greatest(0, qty_on_hand - v_deduct_qty),
          quantity    = greatest(0, quantity    - v_deduct_qty),
          updated_at  = now()
      where lot_id      = v_lot_id
        and customer_id = v_customer_id
        and location_id = v_dep_location_id;
    else
      v_remaining := v_deduct_qty;
      for v_bal in
        select id, qty_on_hand
        from public.tgd_stock_balances
        where lot_id      = v_lot_id
          and customer_id = v_customer_id
          and qty_on_hand > 0
        order by qty_on_hand desc
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_bal.qty_on_hand);
        update public.tgd_stock_balances
        set qty_on_hand = greatest(0, qty_on_hand - v_take),
            quantity    = greatest(0, quantity    - v_take),
            updated_at  = now()
        where id = v_bal.id;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;
  end loop;
end;
$$;

grant execute on function public.tgd_sync_stock_balances_for_withdrawal(uuid) to authenticated;


do $$
declare
  v_actor_id uuid := '44444444-4444-4444-8444-444444444444';
  v_actor_email text := 'thitiwat.tan@tgm.co.th';
  v_backfill_note text := 'ปรับปรุงจำนวนยืนยันย้อนหลังให้ตรงกับจำนวนที่แจ้งเบิก เนื่องจากยืนยันจ่ายเสร็จสิ้นโดยไม่มีการบันทึกจำนวนจริงระหว่างจัดสินค้า';
  v_doc record;
  v_line_count int;
  v_lines_snapshot jsonb;
  v_total_lines int := 0;
  v_total_docs int := 0;
begin
  for v_doc in
    select wr.id, wr.customer_id, wr.status, wr.last_action_at, wr.last_action_by_email
    from public.tgd_customer_withdrawal_requests wr
    where wr.status = 'COMPLETED'
      and exists (
        select 1 from public.tgd_customer_withdrawal_request_lines wl
        where wl.withdrawal_request_id = wr.id
          and wl.picked_boxes is null
          and wl.picked_weight is null
      )
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
             'line_id', wl.id, 'line_no', wl.line_no,
             'requested_boxes', wl.requested_boxes, 'requested_weight', wl.requested_weight
           )), '[]'::jsonb), count(*)
    into v_lines_snapshot, v_line_count
    from public.tgd_customer_withdrawal_request_lines wl
    where wl.withdrawal_request_id = v_doc.id
      and wl.picked_boxes is null
      and wl.picked_weight is null;

    update public.tgd_customer_withdrawal_request_lines wl
    set picked_boxes    = wl.requested_boxes,
        picked_weight   = wl.requested_weight,
        picked_at       = v_doc.last_action_at,
        picked_by_email = coalesce(v_doc.last_action_by_email, v_actor_email),
        admin_note      = case
          when wl.admin_note is null or btrim(wl.admin_note) = '' then v_backfill_note
          else wl.admin_note || ' | ' || v_backfill_note
        end
    where wl.withdrawal_request_id = v_doc.id
      and wl.picked_boxes is null
      and wl.picked_weight is null;

    insert into public.tgd_customer_document_timeline_events (
      document_type, document_id, customer_id, action, from_status, to_status,
      actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
    ) values (
      'CUSTOMER_WITHDRAWAL_REQUEST', v_doc.id, v_doc.customer_id,
      'ADMIN_BACKFILL_PICKED_QTY', v_doc.status, v_doc.status,
      v_actor_id, v_actor_email, 'admin', null,
      v_backfill_note || format(' (%s รายการ)', v_line_count),
      jsonb_build_object('line_count', v_line_count, 'lines', v_lines_snapshot)
    );

    -- Re-run the (now-fixed) location sync with the freshly-backfilled
    -- picked_boxes — confirmed a no-op for all 216 lines (none of their
    -- lots have any tgd_stock_balances row at all), kept for consistency.
    perform public.tgd_sync_stock_balances_for_withdrawal(v_doc.id);

    v_total_lines := v_total_lines + v_line_count;
    v_total_docs := v_total_docs + 1;
  end loop;

  raise notice 'Backfilled % line(s) across % withdrawal request(s)', v_total_lines, v_total_docs;
end $$;

commit;
