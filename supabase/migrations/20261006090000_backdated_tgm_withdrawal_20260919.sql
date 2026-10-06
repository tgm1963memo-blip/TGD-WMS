-- Backdated withdrawal for TGM (C002): goods were sent to TGM on 19/09/2026
-- but no withdrawal request was ever recorded, so stock was never deducted
-- ("ADJIUST STOCK.xlsx" Sheet1, Case 3 -- 10 lots, 1,501.95 kg). Each lot's
-- whole remaining balance left on that day; every quantity below equals the
-- lot's system balance as of 06/10/2026, so no lot goes negative.
--
-- Recorded retroactively on 06/10/2026 by thitiwat.tan@tgm.co.th. Mirrors
-- what the normal flow produces (tgd_create_customer_withdrawal_request ->
-- ACCEPT -> SEND_TO_PICKING -> CONFIRM_DISPATCH): header + lines with exact
-- source deposit-line links, the internal-withdrawal bridge, the
-- tgd_stock_balances sync, and timeline events -- all dated 19/09/2026 so
-- the as-of-date balance, movement ledger and storage billing (picked_at /
-- REVIEW_CONFIRM_DISPATCH created_at) put the dispatch on the right day.

begin;

do $$
declare
  v_customer_id uuid := '1def993f-17db-415d-9215-22d9ef5299cd'; -- C002 TGM
  v_actor_id    uuid := '44444444-4444-4444-8444-444444444444'; -- thitiwat.tan@tgm.co.th
  v_actor_email text := 'thitiwat.tan@tgm.co.th';
  v_actor_role  text := 'admin';
  v_t_create    timestamptz := '2026-09-19 09:00:00+07';
  v_t_accept    timestamptz := '2026-09-19 09:05:00+07';
  v_t_pick      timestamptz := '2026-09-19 09:30:00+07';
  v_t_done      timestamptz := '2026-09-19 10:00:00+07';
  v_note        text := 'ปรับปรุงสต๊อก Case 3: ส่งให้ TGM 19/09/2569 แต่ไม่ได้ทำใบเบิก (บันทึกย้อนหลังเมื่อ 06/10/2569)';
  v_seq         int;
  v_no          text;
  v_id          uuid;
  v_line_no     int := 0;
  v_item        record;
  v_dl          record;
begin
  if exists (select 1 from tgd_customer_withdrawal_requests where note = v_note) then
    raise exception 'Backdated TGM withdrawal for 19/09/2026 already exists';
  end if;

  select coalesce(max(nullif(regexp_replace(withdrawal_no, '^CWR-20260919-', ''), '')::int), 0) + 1
  into v_seq
  from tgd_customer_withdrawal_requests
  where withdrawal_no like 'CWR-20260919-%';
  v_no := format('CWR-20260919-%s', lpad(v_seq::text, 4, '0'));

  insert into tgd_customer_withdrawal_requests (
    withdrawal_no, customer_id, status, requested_dispatch_date, delivery_type,
    destination, note,
    created_by_user_id, created_by_email, created_by_role,
    submitted_by_user_id, submitted_by_email, submitted_at,
    reviewed_by_user_id, reviewed_by_email, reviewed_at,
    last_action_by_user_id, last_action_by_email, last_action_at,
    created_at, requires_r3_document
  ) values (
    v_no, v_customer_id, 'ADMIN_ACCEPTED', '2026-09-19', 'DELIVERY',
    'TGM', v_note,
    v_actor_id, v_actor_email, v_actor_role,
    v_actor_id, v_actor_email, v_t_create,
    v_actor_id, v_actor_email, v_t_accept,
    v_actor_id, v_actor_email, v_t_accept,
    v_t_create, false
  ) returning id into v_id;

  for v_item in
    select * from (values
      ('FR260917023', 133::numeric, 665::numeric),
      ('FR260908008', 177, 70.8),
      ('FR260908015', 10, 50),
      ('FR260901013', 26, 130),
      ('FR260831051', 12, 60),
      ('FR260831015', 1372, 178.35),
      ('FR260829029', 50, 250),
      ('FR260828005', 102, 40.8),
      ('FR260818016', 8, 42),
      ('FR260808053', 3, 15)
    ) as t(tracking_code, boxes, weight)
  loop
    select l.*, r.customer_id
    into v_dl
    from tgd_customer_deposit_request_lines l
    join tgd_customer_deposit_requests r on r.id = l.deposit_request_id
    where l.tracking_code = v_item.tracking_code;

    if not found or v_dl.customer_id <> v_customer_id then
      raise exception 'Deposit line % not found for TGM', v_item.tracking_code;
    end if;

    v_line_no := v_line_no + 1;
    insert into tgd_customer_withdrawal_request_lines (
      withdrawal_request_id, line_no,
      source_customer_deposit_request_id, source_customer_deposit_request_line_id,
      source_lot_no, lot_no, customer_product_code, internal_product_code, product_name,
      mfg_date, exp_date, tracking_code, temperature_type,
      requested_boxes, requested_weight, picking_rule, pack_entry_mode,
      picked_boxes, picked_weight, picked_at, picked_by_email,
      admin_note, created_at
    ) values (
      v_id, v_line_no,
      v_dl.deposit_request_id, v_dl.id,
      v_dl.lot_no, v_dl.lot_no, v_dl.customer_product_code, v_dl.customer_product_code, v_dl.product_name,
      v_dl.mfg_date, v_dl.exp_date, v_dl.tracking_code, v_dl.temperature_type,
      v_item.boxes, v_item.weight, 'SPECIFIC_DEPOSIT', 'WEIGHT',
      v_item.boxes, v_item.weight, v_t_pick, v_actor_email,
      'บันทึกย้อนหลัง 06/10/2569', v_t_create
    );
  end loop;

  -- Same side effects as REVIEW_ACCEPT (needs ADMIN_ACCEPTED) and
  -- REVIEW_CONFIRM_DISPATCH in tgd_review_customer_withdrawal_request.
  perform tgd_bridge_customer_withdrawal_to_internal(v_id, v_actor_id);
  perform tgd_sync_stock_balances_for_withdrawal(v_id);

  update tgd_customer_withdrawal_requests
  set status = 'COMPLETED', last_action_at = v_t_done
  where id = v_id;

  insert into tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, created_at
  ) values
    ('CUSTOMER_WITHDRAWAL_REQUEST', v_id, v_customer_id, 'CREATE_DRAFT', null, 'WITHDRAWAL_DRAFT',
     v_actor_id, v_actor_email, v_actor_role, null, v_note, v_t_create),
    ('CUSTOMER_WITHDRAWAL_REQUEST', v_id, v_customer_id, 'SUBMIT', 'WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER',
     v_actor_id, v_actor_email, v_actor_role, null, null, v_t_create + interval '1 minute'),
    ('CUSTOMER_WITHDRAWAL_REQUEST', v_id, v_customer_id, 'REVIEW_ACCEPT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_ACCEPTED',
     v_actor_id, v_actor_email, v_actor_role, null, null, v_t_accept),
    ('CUSTOMER_WITHDRAWAL_REQUEST', v_id, v_customer_id, 'REVIEW_SEND_TO_PICKING', 'ADMIN_ACCEPTED', 'WAREHOUSE_PICKING',
     v_actor_id, v_actor_email, v_actor_role, null, null, v_t_accept + interval '1 minute'),
    ('CUSTOMER_WITHDRAWAL_REQUEST', v_id, v_customer_id, 'REVIEW_CONFIRM_DISPATCH', 'WAREHOUSE_PICKING', 'COMPLETED',
     v_actor_id, v_actor_email, v_actor_role, null, 'บันทึกย้อนหลังเมื่อ 06/10/2569', v_t_done);

  raise notice 'Created % (%), % lines', v_no, v_id, v_line_no;
end $$;

commit;
