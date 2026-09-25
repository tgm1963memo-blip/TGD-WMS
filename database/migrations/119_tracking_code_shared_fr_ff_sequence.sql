-- FR (FROZEN) and FF (FREEZE_FROZEN) tracking codes share one running number
-- per day: FR260925001, FF260925002, FR260925003, ...
--
-- Existing codes are NOT rewritten. On days where both FR001 and FF001
-- already exist they stay as they are; the next code simply continues from
-- the higher of the two. CH / FZ / AM / XX keep their own per-prefix
-- counters. Output format and signature are unchanged.

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
  -- Prefixes that share one daily counter.
  v_group   text := case when v_prefix in ('FR', 'FF') then 'FR|FF' else v_prefix end;
  v_day_key text := to_char(p_code_date, 'YYMMDD');
  v_seq     integer;
begin
  perform pg_advisory_xact_lock(hashtext('deposit_tracking_code:' || replace(v_group, '|', '') || ':' || v_day_key));

  select coalesce(max(substring(dl.tracking_code from 9)::integer), 0) + 1
  into v_seq
  from public.tgd_customer_deposit_request_lines dl
  where dl.tracking_code ~ ('^(' || v_group || ')' || v_day_key || '[0-9]+$');

  return v_prefix || v_day_key || lpad(v_seq::text, 3, '0');
end;
$$;

commit;
