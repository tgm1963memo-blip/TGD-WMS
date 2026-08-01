-- Data correction, confirmed with the user (not a code bug): three
-- withdrawal lines against deposit lot 198 / tracking FR260729014
-- (product 20284-27, ไส้กรอกอาราบีกิ 500 กรัม แช่แข็ง) were all created
-- assuming 10 kg/box, but the deposit's own actual receiving record
-- (60 boxes / 300 kg = 5 kg/box) and the product catalog's own
-- pack_weight_kg (5) both independently agree the real weight is
-- 5 kg/box. The wrong 10 kg/box assumption on the withdrawal side
-- pushed claimed weight (100+200+200=500 kg) past the entire 300 kg
-- batch, even though box-wise everything was fine (50 of 60 boxes
-- claimed) -- discovered when the user tried to recount
-- CWR-20260731-0011's line from 200kg down to 100kg and the balance
-- lock added in migration 20260731100000 correctly refused it, since
-- the OTHER two lines' still-wrong weights alone already used up the
-- whole batch.
--
-- Corrects all three lines to 5 kg/box (boxes unchanged):
--   CWR-20260730-0003 (COMPLETED):        10 boxes, 100 -> 50 kg
--   CWR-20260731-0011 (COMPLETED):        20 boxes, 200 -> 100 kg (the recount the user was trying to make)
--   CWR-20260801-0007 (WAREHOUSE_PICKING): 20 boxes, 200 -> 100 kg requested (not yet picked, picked_weight stays null)
-- Each UPDATE is scoped to its specific line id, not a broad predicate.

begin;

update public.tgd_customer_withdrawal_request_lines
set requested_weight = 50,
    picked_weight = 50
where id = 'b10c43be-73b8-48dc-9ae8-0d3b9b35fbcd'
  and tracking_code = 'FR260729014'
  and requested_boxes = 10
  and requested_weight = 100;

update public.tgd_customer_withdrawal_request_lines
set requested_weight = 100,
    picked_weight = 100
where id = 'e10d5365-9da7-4bb3-b543-3cb9a4a56bab'
  and tracking_code = 'FR260729014'
  and requested_boxes = 20
  and requested_weight = 200;

update public.tgd_customer_withdrawal_request_lines
set requested_weight = 100
where id = '72a7aaa3-7390-4bdd-9360-02bdc3ea6c73'
  and tracking_code = 'FR260729014'
  and requested_boxes = 20
  and requested_weight = 200
  and picked_weight is null;

do $$
declare
  v_total_boxes numeric;
  v_total_weight numeric;
begin
  select coalesce(sum(coalesce(picked_boxes, requested_boxes)), 0),
         coalesce(sum(coalesce(picked_weight, requested_weight)), 0)
  into v_total_boxes, v_total_weight
  from public.tgd_customer_withdrawal_request_lines
  where tracking_code = 'FR260729014'
    and withdrawal_request_id in (
      select id from public.tgd_customer_withdrawal_requests where status <> 'CANCELLED'
    );

  if v_total_boxes > 60 or v_total_weight > 300 then
    raise exception 'Lot 198 / FR260729014 still over-claimed after correction: % boxes, % kg (max 60 boxes / 300 kg)',
      v_total_boxes, v_total_weight;
  end if;
end;
$$;

commit;
