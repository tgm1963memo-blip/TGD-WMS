-- Migration 108: Reorder tracking code date segment from DDMMYYYY to YYYYMMDD
--
-- Format changes from {prefix}{DDMMYYYY}{seq} (e.g. CH03072026001) to
-- {prefix}{YYYYMMDD}{seq} (e.g. CH20260703001) — same length, same prefix/
-- sequence meaning, just the date segment reordered.
--
-- Rewrites BOTH the generator (for codes created from now on) AND every
-- existing tracking_code already stored on deposit lines and on withdrawal
-- lines (which keep a denormalized copy for handheld scan-to-pick matching,
-- see migration 106) — both must be updated together or the two tables would
-- fall out of sync and the scan-to-pick lookup would stop matching.

begin;

create or replace function public.tgd_generate_deposit_line_tracking_code(
  p_temperature_type text,
  p_code_date        date default (timezone('utc', now()))::date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix  text := case upper(coalesce(p_temperature_type, ''))
    when 'FROZEN'        then 'FR'
    when 'FREEZE'        then 'FZ'
    when 'CHILLED'       then 'CH'
    when 'FREEZE_FROZEN' then 'FF'
    when 'AMBIENT'       then 'AM'
    else 'XX'
  end;
  v_day_key text := to_char(p_code_date, 'YYYYMMDD');
  v_seq     integer;
begin
  perform pg_advisory_xact_lock(hashtext('deposit_tracking_code:' || v_prefix || ':' || v_day_key));

  select coalesce(max(
    nullif(regexp_replace(dl.tracking_code, '^' || v_prefix || v_day_key, ''), '')::integer
  ), 0) + 1
  into v_seq
  from public.tgd_customer_deposit_request_lines dl
  where dl.tracking_code like v_prefix || v_day_key || '%';

  return v_prefix || v_day_key || lpad(v_seq::text, 3, '0');
end;
$$;

-- Reformat every existing code: {2-letter prefix}{DD}{MM}{YYYY}{3-digit seq}
-- -> {2-letter prefix}{YYYY}{MM}{DD}{3-digit seq}. The regex requires a
-- valid DD (01-31) then a valid MM (01-12) right after the prefix, which
-- only the OLD arrangement satisfies — in an already-converted code, that
-- same position holds the last two digits of the year (e.g. "26" from
-- 2026), which isn't a valid month, so this is a no-op if re-run.
update public.tgd_customer_deposit_request_lines
set tracking_code =
  substring(tracking_code from 1 for 2) ||
  substring(tracking_code from 7 for 4) ||
  substring(tracking_code from 5 for 2) ||
  substring(tracking_code from 3 for 2) ||
  substring(tracking_code from 11 for 3)
where tracking_code ~ '^[A-Z]{2}(0[1-9]|[12][0-9]|3[01])(0[1-9]|1[0-2])[0-9]{4}[0-9]{3}$';

update public.tgd_customer_withdrawal_request_lines
set tracking_code =
  substring(tracking_code from 1 for 2) ||
  substring(tracking_code from 7 for 4) ||
  substring(tracking_code from 5 for 2) ||
  substring(tracking_code from 3 for 2) ||
  substring(tracking_code from 11 for 3)
where tracking_code ~ '^[A-Z]{2}(0[1-9]|[12][0-9]|3[01])(0[1-9]|1[0-2])[0-9]{4}[0-9]{3}$';

commit;
