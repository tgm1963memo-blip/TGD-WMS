-- Discovered while testing the previous migration: prior revisions of
-- tgd_record_deposit_line_actual_receipt (20260709090000, 20260722140000,
-- etc.) added parameters over time without ever dropping the earlier
-- signatures first, leaving THREE overloads of the same function name
-- live in the database simultaneously — including one from before p_note/
-- p_lot_no/etc. even existed. The frontend always calls it with the full
-- current 9-argument signature, so this was invisible in normal use, but
-- any call with a shorter/ambiguous argument set either fails outright
-- (PostgREST can't pick between candidates) or, worse, could silently run
-- one of the old bodies that has none of the withdrawal-amount guard or
-- audit logging just added. Drop both obsolete overloads so only the one
-- current signature remains callable.

begin;

drop function if exists public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text);
drop function if exists public.tgd_record_deposit_line_actual_receipt(uuid, numeric, numeric, text);

commit;
