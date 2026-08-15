-- Customer TGM (customer_id 1def993f-17db-415d-9215-22d9ef5299cd) reported
-- that the single lot under tracking code XX260630027 was mistagged as
-- RCC020 ("มันไก่") when it should be RCF021 ("มันไก่แช่แข็ง") — both are
-- real, independently-used catalog codes for this customer (RCC020 alone
-- has 11 other deposit lines across other tracking codes/lots), so this is
-- NOT a blanket per-customer code substitution like the earlier 6-code
-- recode (20260810110000) — it must be scoped to this exact tracking code
-- only, leaving every other RCC020 line untouched.
--
-- Confirmed before writing this: no tgd_customer_product_service_rates row
-- exists for either RCC020's or RCF021's catalog id for this customer, so
-- there is no retroactive billing-rate change from this recode. Both
-- customer_product_code and internal_product_code carry the identical
-- wrong value "RCC020" on the deposit line's downstream withdrawal lines
-- (the deposit line itself has internal_product_code left null); all are
-- corrected to "RCF021" to match the catalog entry exactly. product_name
-- is corrected too (RCC020's "มันไก่" -> RCF021's "มันไก่แช่แข็ง") since
-- getDepositInventoryLines and the withdrawal print documents display the
-- line's own stored product_name directly, not a fresh catalog join.
--
-- Two withdrawal lines reference this tracking code: one already
-- COMPLETED (CWR-20260730-0001) and one still WAREHOUSE_PICKING today
-- (CWR-20260815-0002) — both updated, matching "ตั้งแต่ฝากเข้าจนถึงปัจจุบัน"
-- (from the original deposit through to today).

begin;

do $$
declare
  v_customer_id uuid := '1def993f-17db-415d-9215-22d9ef5299cd';
  v_tracking_code text := 'XX260630027';
  v_new_code text := 'RCF021';
  v_new_name text := 'มันไก่แช่แข็ง';
  v_dep_updated int;
  v_wd_updated int;
begin
  update public.tgd_customer_deposit_request_lines dl
  set customer_product_code = v_new_code,
      internal_product_code = v_new_code,
      product_name = v_new_name
  where dl.tracking_code = v_tracking_code
    and exists (
      select 1 from public.tgd_customer_deposit_requests dr
      where dr.id = dl.deposit_request_id
        and dr.customer_id = v_customer_id
    );
  get diagnostics v_dep_updated = row_count;

  update public.tgd_customer_withdrawal_request_lines wl
  set customer_product_code = v_new_code,
      internal_product_code = v_new_code,
      product_name = v_new_name
  where wl.tracking_code = v_tracking_code
    and exists (
      select 1 from public.tgd_customer_withdrawal_requests wr
      where wr.id = wl.withdrawal_request_id
        and wr.customer_id = v_customer_id
    );
  get diagnostics v_wd_updated = row_count;

  raise notice 'XX260630027: RCC020 -> RCF021 on % deposit line(s), % withdrawal line(s)', v_dep_updated, v_wd_updated;

  if v_dep_updated <> 1 then
    raise exception 'Expected exactly 1 deposit line for tracking code %, found %', v_tracking_code, v_dep_updated;
  end if;

  if v_wd_updated <> 2 then
    raise exception 'Expected exactly 2 withdrawal lines for tracking code %, found %', v_tracking_code, v_wd_updated;
  end if;
end $$;

commit;
