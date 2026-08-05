-- Removes the temporary verification helper added in
-- 20260804162000_temp_debug_deposit_edit_guard.sql, used to confirm the
-- withdrawn-amount guard logic in tgd_record_deposit_line_actual_receipt
-- (20260804160000) behaves correctly without needing a real authenticated
-- session for testing.

begin;

drop function if exists public.tgd_debug_check_deposit_edit_guard(uuid, numeric, numeric);

commit;
