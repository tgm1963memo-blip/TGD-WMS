-- TGM (customer_id 1def993f-17db-415d-9215-22d9ef5299cd) had 6 product
-- codes recorded with a truncated/typo'd last digit on some historical
-- deposit/withdrawal lines, while the catalog (tgd_customer_products)
-- has always only had the correct, full code:
--
--   90013-27  -> 90013-271   20240-57 -> 20240-571   20158-27 -> 20158-271
--   20092-27  -> 20092-271   10258-27 -> 10258-272   10140-18 -> 10140-181
--
-- Confirmed before writing this: the truncated codes never existed as
-- their own tgd_customer_products row (only the full code did) — this is
-- NOT a merge of two real catalog entries, no unique-constraint conflict,
-- no tgd_customer_product_service_rates row to reconcile (none configured
-- for any of these 6 products at all). customer_product_id is null on
-- every affected line (both tables denormalize customer_product_code as
-- plain text, no FK) — billingRateEngineService.js/stockBalanceCalc.js
-- both resolve the catalog match fresh from this text field at query
-- time, so correcting it is safe and, in fact, lets any future
-- product-specific rate for these codes actually resolve (it silently
-- couldn't before, since the code never matched the catalog).
--
-- internal_product_code carries the identical wrong value on every
-- affected row too (confirmed: always equal to customer_product_code
-- here) and is corrected alongside it — same product_id-resolution path
-- (movementLedgerReportService.js's getProductSkuMap) matches on either
-- field. Deposit and withdrawal lines updated together in one
-- transaction: stock balance nets deposits against withdrawals by a
-- (lot_no, customer_product_code) TEXT composite key, so leaving one
-- side uncorrected would break that match instead of fixing it.
--
-- Scoped by customer_id throughout — customer_product_code is only
-- unique per-customer, so the same short code string could legitimately
-- mean something else entirely for a different customer.

begin;

do $$
declare
  v_customer_id uuid := '1def993f-17db-415d-9215-22d9ef5299cd';
  v_pairs text[][] := array[
    array['90013-27', '90013-271'],
    array['20240-57', '20240-571'],
    array['20158-27', '20158-271'],
    array['20092-27', '20092-271'],
    array['10258-27', '10258-272'],
    array['10140-18', '10140-181']
  ];
  v_pair text[];
  v_dep_updated int;
  v_wd_updated int;
  v_total_dep int := 0;
  v_total_wd int := 0;
begin
  foreach v_pair slice 1 in array v_pairs loop
    update public.tgd_customer_deposit_request_lines dl
    set customer_product_code = v_pair[2],
        internal_product_code = v_pair[2]
    where dl.customer_product_code = v_pair[1]
      and exists (
        select 1 from public.tgd_customer_deposit_requests dr
        where dr.id = dl.deposit_request_id
          and dr.customer_id = v_customer_id
      );
    get diagnostics v_dep_updated = row_count;

    update public.tgd_customer_withdrawal_request_lines wl
    set customer_product_code = v_pair[2],
        internal_product_code = v_pair[2]
    where wl.customer_product_code = v_pair[1]
      and exists (
        select 1 from public.tgd_customer_withdrawal_requests wr
        where wr.id = wl.withdrawal_request_id
          and wr.customer_id = v_customer_id
      );
    get diagnostics v_wd_updated = row_count;

    raise notice '% -> %: % deposit line(s), % withdrawal line(s)', v_pair[1], v_pair[2], v_dep_updated, v_wd_updated;
    v_total_dep := v_total_dep + v_dep_updated;
    v_total_wd := v_total_wd + v_wd_updated;
  end loop;

  raise notice 'Total: % deposit line(s), % withdrawal line(s) recoded', v_total_dep, v_total_wd;
end $$;

commit;
