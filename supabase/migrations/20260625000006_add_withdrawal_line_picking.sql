-- Add picked_boxes / picked_weight / picked_at / picked_by_email to
-- tgd_customer_withdrawal_request_lines so handheld can record actual
-- quantities picked and admins can see them in the review page.

ALTER TABLE public.tgd_customer_withdrawal_request_lines
  ADD COLUMN IF NOT EXISTS picked_boxes  numeric,
  ADD COLUMN IF NOT EXISTS picked_weight numeric,
  ADD COLUMN IF NOT EXISTS picked_at     timestamptz,
  ADD COLUMN IF NOT EXISTS picked_by_email text;

-- RPC called by handheld to record the actual picked qty for one line.
CREATE OR REPLACE FUNCTION public.tgd_record_withdrawal_line_pick(
  p_line_id      uuid,
  p_picked_boxes numeric DEFAULT NULL,
  p_picked_weight numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if not exists (
    select 1 from public.tgd_customer_withdrawal_request_lines where id = p_line_id
  ) then
    raise exception 'Withdrawal request line not found';
  end if;

  update public.tgd_customer_withdrawal_request_lines
  set picked_boxes     = p_picked_boxes,
      picked_weight    = p_picked_weight,
      picked_at        = now(),
      picked_by_email  = v_profile.email
  where id = p_line_id;

  return jsonb_build_object(
    'id',           p_line_id,
    'picked_boxes', p_picked_boxes,
    'picked_weight', p_picked_weight
  );
end;
$$;
