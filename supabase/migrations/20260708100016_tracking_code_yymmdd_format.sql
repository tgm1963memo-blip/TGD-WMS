-- Migration 109: Shorten tracking code date segment from YYYYMMDD to YYMMDD
--
-- Format changes from {prefix}{YYYYMMDD}{seq} (e.g. FR20260703001) to
-- {prefix}{YYMMDD}{seq} (e.g. FR260703001) — drops the century digits,
-- same prefix/sequence meaning.
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
  v_day_key text := to_char(p_code_date, 'YYMMDD');
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

-- Reformat every existing code: {2-letter prefix}{YYYY}{MM}{DD}{3-digit seq}
-- -> {2-letter prefix}{YY}{MM}{DD}{3-digit seq}, i.e. drop the "20" century
-- digits. The regex requires the year segment to literally start with "20"
-- and be exactly 13 characters total, which only the OLD (YYYYMMDD) format
-- satisfies — an already-converted 11-character code can't match, so this
-- is a no-op if re-run.
update public.tgd_customer_deposit_request_lines
set tracking_code =
  substring(tracking_code from 1 for 2) ||
  substring(tracking_code from 5 for 2) ||
  substring(tracking_code from 7 for 4) ||
  substring(tracking_code from 11 for 3)
where tracking_code ~ '^[A-Z]{2}20[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{3}$';

update public.tgd_customer_withdrawal_request_lines
set tracking_code =
  substring(tracking_code from 1 for 2) ||
  substring(tracking_code from 5 for 2) ||
  substring(tracking_code from 7 for 4) ||
  substring(tracking_code from 11 for 3)
where tracking_code ~ '^[A-Z]{2}20[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{3}$';

commit;
