-- Add customer note + admin (warehouse) note to the stock balance RPCs so the
-- inventory balance (admin) and customer stock balance pages can display them.
-- DROP first: Postgres requires this when the return column set changes.

DROP FUNCTION IF EXISTS public.tgd_get_customer_stock_balance(uuid);
DROP FUNCTION IF EXISTS public.tgd_get_all_customer_stock_balances();

CREATE OR REPLACE FUNCTION public.tgd_get_customer_stock_balance(
  p_customer_id uuid
)
RETURNS TABLE (
  deposit_line_id       uuid,
  deposit_request_id    uuid,
  request_no            text,
  lot_no                text,
  customer_product_code text,
  product_name          text,
  mfg_date              date,
  exp_date              date,
  temperature_type      text,
  received_at           timestamptz,
  received_boxes        numeric,
  received_weight       numeric,
  withdrawn_boxes       numeric,
  withdrawn_weight      numeric,
  balance_boxes         numeric,
  balance_weight        numeric,
  note                  text,
  actual_note            text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    dl.id                                                         AS deposit_line_id,
    dl.deposit_request_id,
    dr.request_no,
    dl.lot_no,
    dl.customer_product_code,
    dl.product_name,
    dl.mfg_date,
    dl.exp_date,
    dl.temperature_type,
    COALESCE(dr.last_action_at, dr.expected_arrival_date)         AS received_at,
    COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)             AS received_boxes,
    COALESCE(dl.actual_weight, dl.expected_weight, 0)             AS received_weight,
    COALESCE(w.total_boxes,  0)                                   AS withdrawn_boxes,
    COALESCE(w.total_weight, 0)                                   AS withdrawn_weight,
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0))                              AS balance_boxes,
    GREATEST(0,
      COALESCE(dl.actual_weight, dl.expected_weight, 0)
      - COALESCE(w.total_weight, 0))                              AS balance_weight,
    dl.note                                                       AS note,
    dl.actual_note                                                AS actual_note
  FROM public.tgd_customer_deposit_request_lines dl
  JOIN public.tgd_customer_deposit_requests dr
    ON dr.id  = dl.deposit_request_id
   AND dr.customer_id = p_customer_id
   AND dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.status      = 'COMPLETED'
     AND wr.customer_id = p_customer_id
    WHERE
      -- A: direct link via source deposit request + lot
      (
        wl.source_customer_deposit_request_id = dl.deposit_request_id
        AND (
          wl.source_lot_no = dl.lot_no
          OR  wl.lot_no    = dl.lot_no
          OR (wl.source_lot_no IS NULL AND wl.lot_no IS NULL AND dl.lot_no IS NULL)
        )
      )
      OR
      -- B: no direct link — match by LOT; product_code is optional (NULL = any)
      (
        wl.source_customer_deposit_request_id IS NULL
        AND COALESCE(wl.lot_no, '') = COALESCE(dl.lot_no, '')
        AND (
          NULLIF(BTRIM(COALESCE(wl.customer_product_code, '')), '') IS NULL
          OR wl.customer_product_code = dl.customer_product_code
        )
      )
  ) w ON true
  WHERE
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0)
    ) > 0
  ORDER BY dr.last_action_at DESC, dl.line_no;
$$;

CREATE OR REPLACE FUNCTION public.tgd_get_all_customer_stock_balances()
RETURNS TABLE (
  customer_id           uuid,
  deposit_line_id       uuid,
  deposit_request_id    uuid,
  request_no            text,
  lot_no                text,
  customer_product_code text,
  product_name          text,
  mfg_date              date,
  exp_date              date,
  temperature_type      text,
  received_at           timestamptz,
  received_boxes        numeric,
  received_weight       numeric,
  withdrawn_boxes       numeric,
  withdrawn_weight      numeric,
  balance_boxes         numeric,
  balance_weight        numeric,
  note                  text,
  actual_note            text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
BEGIN
  IF v_auth_user_id IS NULL OR NOT public.tgd_current_user_is_active() THEN
    RAISE EXCEPTION 'Active authenticated user required';
  END IF;

  SELECT p.id, p.role INTO v_profile
  FROM public.tgd_user_profiles p
  WHERE p.auth_user_id = v_auth_user_id AND p.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_profile.role NOT IN (
    'admin', 'accounting',
    'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  ) THEN
    RAISE EXCEPTION 'Insufficient role to view all customer stock balances';
  END IF;

  RETURN QUERY
  SELECT
    dr.customer_id,
    dl.id                                                         AS deposit_line_id,
    dl.deposit_request_id,
    dr.request_no,
    dl.lot_no,
    dl.customer_product_code,
    dl.product_name,
    dl.mfg_date,
    dl.exp_date,
    dl.temperature_type,
    COALESCE(dr.last_action_at, dr.expected_arrival_date)         AS received_at,
    COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)             AS received_boxes,
    COALESCE(dl.actual_weight, dl.expected_weight, 0)             AS received_weight,
    COALESCE(w.total_boxes,  0)                                   AS withdrawn_boxes,
    COALESCE(w.total_weight, 0)                                   AS withdrawn_weight,
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0))                              AS balance_boxes,
    GREATEST(0,
      COALESCE(dl.actual_weight, dl.expected_weight, 0)
      - COALESCE(w.total_weight, 0))                              AS balance_weight,
    dl.note                                                       AS note,
    dl.actual_note                                                AS actual_note
  FROM public.tgd_customer_deposit_request_lines dl
  JOIN public.tgd_customer_deposit_requests dr
    ON dr.id = dl.deposit_request_id
   AND dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.status      = 'COMPLETED'
     AND wr.customer_id = dr.customer_id
    WHERE
      -- A: direct link via source deposit request + lot
      (
        wl.source_customer_deposit_request_id = dl.deposit_request_id
        AND (
          wl.source_lot_no = dl.lot_no
          OR  wl.lot_no    = dl.lot_no
          OR (wl.source_lot_no IS NULL AND wl.lot_no IS NULL AND dl.lot_no IS NULL)
        )
      )
      OR
      -- B: no direct link — match by LOT; product_code is optional (NULL = any)
      (
        wl.source_customer_deposit_request_id IS NULL
        AND COALESCE(wl.lot_no, '') = COALESCE(dl.lot_no, '')
        AND (
          NULLIF(BTRIM(COALESCE(wl.customer_product_code, '')), '') IS NULL
          OR wl.customer_product_code = dl.customer_product_code
        )
      )
  ) w ON true
  WHERE
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0)
    ) > 0
  ORDER BY dr.customer_id, dr.last_action_at DESC, dl.line_no;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tgd_get_customer_stock_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tgd_get_all_customer_stock_balances() TO authenticated;
