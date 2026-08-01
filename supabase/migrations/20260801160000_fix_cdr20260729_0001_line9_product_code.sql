-- Data correction, confirmed with the user against the physical printed
-- work order for CDR-20260729-0001: line 9 (tracking FR260730009, LOT
-- 198, 19 boxes / 95 kg) was recorded under customer_product_code
-- '10286-557' (สโมคเบค่อน ตราหมูสองตัว 5 มม.), but the customer's
-- annotation on the paper and confirmation via chat both say it should
-- be '20362-7' (สโมคเบค่อนมิกซ์สไปซ์ (15 มม)) -- the same product code
-- already correctly recorded on the sibling line 10 (tracking
-- FR260730010, same LOT 198, 1 box / 3 kg). No withdrawal has claimed
-- against this deposit line or tracking code yet (verified before this
-- migration), so this is a pure identity correction with no balance
-- side effects.
--
-- Only the product-identity fields change; the physically-received
-- boxes/weight (19 / 95 kg, matching what was actually counted) are
-- left untouched -- the quantity was always right, only the product
-- code was mistyped.

begin;

do $$
declare
  v_rows integer;
begin
  update public.tgd_customer_deposit_request_lines
  set customer_product_code = '20362-7',
      internal_product_code = '20362-7',
      product_name = 'สโมคเบค่อนมิกซ์สไปซ์ (15 มม) 1,000 กรัม แช่แข็ง'
  where id = '41ccc4dd-f474-4d0b-a51d-a8bd881b86a0'
    and deposit_request_id = 'c3f49273-cf37-4d92-8595-481ee3d22e8e'
    and line_no = 9
    and tracking_code = 'FR260730009'
    and customer_product_code = '10286-557';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Expected exactly 1 row to update for CDR-20260729-0001 line 9, got % — aborting', v_rows;
  end if;
end;
$$;

insert into public.tgd_customer_document_timeline_events (
  document_type, document_id, customer_id, action, from_status, to_status,
  comment, metadata_json
) values (
  'CUSTOMER_DEPOSIT_REQUEST', 'c3f49273-cf37-4d92-8595-481ee3d22e8e', '1def993f-17db-415d-9215-22d9ef5299cd',
  'ADMIN_FIX_LINE_PRODUCT_CODE', 'RECEIVED_CONFIRMED', 'RECEIVED_CONFIRMED',
  'Corrected line 9 product code 10286-557 -> 20362-7 per physical work-order annotation, confirmed with customer',
  jsonb_build_object('line_id', '41ccc4dd-f474-4d0b-a51d-a8bd881b86a0', 'from_code', '10286-557', 'to_code', '20362-7')
);

commit;
