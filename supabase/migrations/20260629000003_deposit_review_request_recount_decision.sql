-- Add REQUEST_RECOUNT decision to tgd_review_customer_deposit_request.
-- Allows admin/warehouse roles to move a RECEIVED_CONFIRMED deposit back to
-- ADMIN_RECOUNT_REQUESTED so handheld can recount and update actual quantities.

CREATE OR REPLACE FUNCTION public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision text,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
  v_document     record;
  v_decision     text := upper(nullif(btrim(p_decision), ''));
  v_to_status    text;
  v_receiving_id uuid;
BEGIN
  IF v_auth_user_id IS NULL OR NOT public.tgd_current_user_is_active() THEN
    RAISE EXCEPTION 'Active authenticated user required';
  END IF;

  SELECT p.id, p.email, p.role, p.customer_id
  INTO v_profile
  FROM public.tgd_user_profiles p
  WHERE p.auth_user_id = v_auth_user_id
    AND p.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_decision NOT IN ('ACCEPT', 'REJECT', 'REVIEWING', 'CONFIRM_RECEIPT', 'COUNT_VARIANCE', 'REQUEST_RECOUNT') THEN
    RAISE EXCEPTION 'Decision must be ACCEPT, REJECT, REVIEWING, CONFIRM_RECEIPT, COUNT_VARIANCE, or REQUEST_RECOUNT';
  END IF;

  -- CONFIRM_RECEIPT, COUNT_VARIANCE, REQUEST_RECOUNT allow warehouse roles
  IF v_decision IN ('CONFIRM_RECEIPT', 'COUNT_VARIANCE', 'REQUEST_RECOUNT') THEN
    IF v_profile.role NOT IN ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin') THEN
      RAISE EXCEPTION 'Admin, accounting, or warehouse role required';
    END IF;
  ELSE
    IF v_profile.role NOT IN ('admin', 'accounting') THEN
      RAISE EXCEPTION 'Admin or accounting role required to review a deposit request';
    END IF;
  END IF;

  SELECT d.id, d.customer_id, d.status
  INTO v_document
  FROM public.tgd_customer_deposit_requests d
  WHERE d.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer deposit request not found';
  END IF;

  IF v_decision = 'REVIEWING' AND v_document.status = 'SUBMITTED_BY_CUSTOMER' THEN
    v_to_status := 'ADMIN_REVIEWING';
  ELSIF v_decision = 'ACCEPT' AND v_document.status = 'ADMIN_REVIEWING' THEN
    v_to_status := 'ADMIN_ACCEPTED';
  ELSIF v_decision = 'REJECT' AND v_document.status = 'ADMIN_REVIEWING' THEN
    v_to_status := 'ADMIN_REJECTED';
  ELSIF v_decision = 'CONFIRM_RECEIPT' AND v_document.status IN ('WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED') THEN
    v_to_status := 'RECEIVED_CONFIRMED';
  ELSIF v_decision = 'COUNT_VARIANCE' AND v_document.status IN ('ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING') THEN
    v_to_status := 'COUNT_VARIANCE_REVIEW';
  ELSIF v_decision = 'REQUEST_RECOUNT' AND v_document.status IN ('RECEIVED_CONFIRMED', 'COUNT_VARIANCE_REVIEW', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'ADMIN_ACCEPTED') THEN
    v_to_status := 'ADMIN_RECOUNT_REQUESTED';
  ELSE
    RAISE EXCEPTION 'Invalid deposit review transition from % using %',
      v_document.status, v_decision;
  END IF;

  UPDATE public.tgd_customer_deposit_requests
  SET status                  = v_to_status,
      reviewed_by_user_id     = CASE WHEN v_decision IN ('ACCEPT', 'REJECT') THEN v_profile.id ELSE reviewed_by_user_id END,
      reviewed_by_email       = CASE WHEN v_decision IN ('ACCEPT', 'REJECT') THEN v_profile.email ELSE reviewed_by_email END,
      reviewed_at             = CASE WHEN v_decision IN ('ACCEPT', 'REJECT') THEN now() ELSE reviewed_at END,
      web_approved_by_user_id = CASE WHEN v_decision = 'CONFIRM_RECEIPT' THEN v_profile.id ELSE web_approved_by_user_id END,
      web_approved_by_email   = CASE WHEN v_decision = 'CONFIRM_RECEIPT' THEN v_profile.email ELSE web_approved_by_email END,
      review_comment          = nullif(btrim(p_comment), ''),
      last_action_by_user_id  = v_profile.id,
      last_action_by_email    = v_profile.email,
      last_action_at          = now()
  WHERE id = v_document.id;

  IF v_decision = 'ACCEPT' THEN
    v_receiving_id := public.tgd_bridge_customer_deposit_to_receiving(v_document.id, v_profile.id);
  END IF;

  INSERT INTO public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) VALUES (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status,
    CASE WHEN v_decision = 'ACCEPT' THEN 'WAREHOUSE_RECEIVING' ELSE v_to_status END,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  RETURN jsonb_build_object(
    'id',                   v_document.id,
    'customer_id',          v_document.customer_id,
    'status',               CASE WHEN v_decision = 'ACCEPT' THEN 'WAREHOUSE_RECEIVING' ELSE v_to_status END,
    'action',               'REVIEW_' || v_decision,
    'receiving_document_id', v_receiving_id
  );
END;
$$;
