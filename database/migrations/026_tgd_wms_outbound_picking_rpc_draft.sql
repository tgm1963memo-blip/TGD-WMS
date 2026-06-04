-- 026_tgd_wms_outbound_picking_rpc_draft.sql
-- Outbound / Picking RPC draft only.
-- No post outbound RPC is created in this migration.
-- No stock movements, stock balance updates, stock-reducing triggers, or Production changes.

CREATE OR REPLACE FUNCTION tgd_rpc_create_outbound_draft(
  p_document_no text,
  p_customer_id uuid DEFAULT NULL,
  p_source_module text DEFAULT NULL,
  p_source_document_id uuid DEFAULT NULL,
  p_source_document_no text DEFAULT NULL,
  p_requested_ship_date date DEFAULT NULL
)
RETURNS tgd_outbound_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document tgd_outbound_documents%ROWTYPE;
BEGIN
  IF p_document_no IS NULL OR btrim(p_document_no) = '' THEN
    RAISE EXCEPTION 'document_no is required';
  END IF;

  INSERT INTO tgd_outbound_documents (
    document_no,
    status,
    customer_id,
    source_module,
    source_document_id,
    source_document_no,
    requested_ship_date,
    created_by
  )
  VALUES (
    btrim(p_document_no),
    'DRAFT',
    p_customer_id,
    p_source_module,
    p_source_document_id,
    p_source_document_no,
    p_requested_ship_date,
    auth.uid()
  )
  RETURNING * INTO v_document;

  RETURN v_document;
END;
$$;

CREATE OR REPLACE FUNCTION tgd_rpc_add_outbound_line(
  p_document_id uuid,
  p_product_id uuid,
  p_lot_id uuid DEFAULT NULL,
  p_requested_quantity numeric,
  p_requested_weight numeric DEFAULT 0
)
RETURNS tgd_outbound_lines
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document tgd_outbound_documents%ROWTYPE;
  v_line tgd_outbound_lines%ROWTYPE;
BEGIN
  SELECT *
  INTO v_document
  FROM tgd_outbound_documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbound document not found';
  END IF;

  IF v_document.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'outbound document must be DRAFT to add a line';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;

  IF p_requested_quantity IS NULL OR p_requested_quantity <= 0 THEN
    RAISE EXCEPTION 'requested_quantity must be greater than zero';
  END IF;

  IF p_requested_weight IS NULL OR p_requested_weight < 0 THEN
    RAISE EXCEPTION 'requested_weight must be zero or greater';
  END IF;

  INSERT INTO tgd_outbound_lines (
    document_id,
    product_id,
    lot_id,
    requested_quantity,
    requested_weight,
    status
  )
  VALUES (
    p_document_id,
    p_product_id,
    p_lot_id,
    p_requested_quantity,
    p_requested_weight,
    'OPEN'
  )
  RETURNING * INTO v_line;

  RETURN v_line;
END;
$$;

CREATE OR REPLACE FUNCTION tgd_rpc_reserve_outbound_stock(
  p_outbound_document_id uuid,
  p_outbound_line_id uuid,
  p_location_id uuid,
  p_reserved_quantity numeric,
  p_reserved_weight numeric DEFAULT 0
)
RETURNS tgd_outbound_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document tgd_outbound_documents%ROWTYPE;
  v_line tgd_outbound_lines%ROWTYPE;
  v_reservation tgd_outbound_reservations%ROWTYPE;
BEGIN
  SELECT *
  INTO v_document
  FROM tgd_outbound_documents
  WHERE id = p_outbound_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbound document not found';
  END IF;

  SELECT *
  INTO v_line
  FROM tgd_outbound_lines
  WHERE id = p_outbound_line_id
    AND document_id = p_outbound_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbound line not found for document';
  END IF;

  IF v_document.status NOT IN ('DRAFT', 'RESERVED') THEN
    RAISE EXCEPTION 'outbound document must be DRAFT or RESERVED to reserve stock';
  END IF;

  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'location_id is required';
  END IF;

  IF p_reserved_quantity IS NULL OR p_reserved_quantity <= 0 THEN
    RAISE EXCEPTION 'reserved_quantity must be greater than zero';
  END IF;

  IF p_reserved_weight IS NULL OR p_reserved_weight < 0 THEN
    RAISE EXCEPTION 'reserved_weight must be zero or greater';
  END IF;

  INSERT INTO tgd_outbound_reservations (
    outbound_document_id,
    outbound_line_id,
    customer_id,
    product_id,
    lot_id,
    location_id,
    reserved_quantity,
    reserved_weight,
    status,
    created_by
  )
  VALUES (
    p_outbound_document_id,
    p_outbound_line_id,
    v_document.customer_id,
    v_line.product_id,
    v_line.lot_id,
    p_location_id,
    p_reserved_quantity,
    p_reserved_weight,
    'ACTIVE',
    auth.uid()
  )
  RETURNING * INTO v_reservation;

  UPDATE tgd_outbound_lines
  SET status = 'RESERVED',
      updated_at = now()
  WHERE id = p_outbound_line_id;

  UPDATE tgd_outbound_documents
  SET status = 'RESERVED',
      updated_at = now()
  WHERE id = p_outbound_document_id;

  RETURN v_reservation;
END;
$$;

CREATE OR REPLACE FUNCTION tgd_rpc_release_outbound_reservation(
  p_reservation_id uuid
)
RETURNS tgd_outbound_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation tgd_outbound_reservations%ROWTYPE;
BEGIN
  SELECT *
  INTO v_reservation
  FROM tgd_outbound_reservations
  WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbound reservation not found';
  END IF;

  IF v_reservation.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'outbound reservation must be ACTIVE to release';
  END IF;

  UPDATE tgd_outbound_reservations
  SET status = 'RELEASED',
      released_by = auth.uid(),
      released_at = now(),
      updated_at = now()
  WHERE id = p_reservation_id
  RETURNING * INTO v_reservation;

  IF NOT EXISTS (
    SELECT 1
    FROM tgd_outbound_reservations
    WHERE outbound_line_id = v_reservation.outbound_line_id
      AND status = 'ACTIVE'
  ) THEN
    UPDATE tgd_outbound_lines
    SET status = 'OPEN',
        updated_at = now()
    WHERE id = v_reservation.outbound_line_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM tgd_outbound_reservations
    WHERE outbound_document_id = v_reservation.outbound_document_id
      AND status = 'ACTIVE'
  ) THEN
    UPDATE tgd_outbound_documents
    SET status = 'DRAFT',
        updated_at = now()
    WHERE id = v_reservation.outbound_document_id;
  END IF;

  RETURN v_reservation;
END;
$$;
