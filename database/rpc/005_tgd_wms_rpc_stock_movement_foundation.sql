-- Prepared RPC Stock Movement Foundation – DO NOT APPLY TO PRODUCTION WITHOUT CONTROLLER APPROVAL
-- This file defines RPC functions for controlled stock movement writes.
-- No trigger statements are included; stock balance updates are deferred to Sprint 13H.
-- No real Supabase URL or privileged keys are referenced.

SET search_path = public;

/*
  Base function to create a stock movement entry.
  Performs authentication, profile validation, role checks, customer isolation, movement type validation,
  quantity checks, and inserts into tgd_stock_movements.
  Audit log insertion is a placeholder comment for future implementation.
*/
CREATE OR REPLACE FUNCTION public.tgd_rpc_create_stock_movement(
    p_movement_type text,
    p_customer_id uuid,
    p_quantity numeric,
    p_source_location_id uuid,
    p_target_location_id uuid,
    p_reference text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile record;
    v_allowed_roles text[] := ARRAY['admin','warehouse_manager','warehouse_staff'];
    v_allowed_movements text[] := ARRAY[
        'RECEIVE_CONFIRM',
        'PUTAWAY_CONFIRM',
        'TRANSFER_CONFIRM',
        'ADJUSTMENT_CONFIRM',
        'PICK_ALLOCATE',
        'PICK_CONFIRM',
        'DISPATCH_CONFIRM'
    ];
    v_new_movement_id uuid;
BEGIN
    -- 1. Auth check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated call – auth.uid() is null';
    END IF;

    -- 2. Active profile check
    SELECT * INTO v_profile
    FROM tgd_user_profiles WHERE auth_user_id = v_user_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active user profile not found for auth.uid() %', v_user_id;
    END IF;

    -- 3. Role check
    IF NOT v_profile.role_name = ANY(v_allowed_roles) THEN
        RAISE EXCEPTION 'User role % not authorized for stock movement', v_profile.role_name;
    END IF;

    -- 4. Movement type validation
    IF NOT p_movement_type = ANY(v_allowed_movements) THEN
        RAISE EXCEPTION 'Invalid movement_type %', p_movement_type;
    END IF;

    -- 5. Quantity validation (must be positive when applicable)
    IF p_quantity IS NOT NULL AND p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive';
    END IF;

    -- 6. Customer isolation check
    IF v_profile.customer_id IS NOT NULL THEN
        IF p_customer_id IS NULL OR p_customer_id <> v_profile.customer_id THEN
            RAISE EXCEPTION 'Customer isolation violation – movement customer_id must match profile customer_id';
        END IF;
    END IF;

    -- 7. Insert ledger entry
    INSERT INTO tgd_stock_movements (
        movement_id,
        movement_type,
        customer_id,
        quantity,
        source_location_id,
        target_location_id,
        reference,
        created_by,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_movement_type,
        p_customer_id,
        p_quantity,
        p_source_location_id,
        p_target_location_id,
        p_reference,
        v_user_id,
        now()
    ) RETURNING movement_id INTO v_new_movement_id;

    -- 8. Audit log placeholder (implemented in Sprint 13H) -- deferred stock-balance update will be handled later
    -- INSERT INTO tgd_audit_logs(action, performed_by, details, created_at)
    -- VALUES ('stock_movement_create', v_user_id, jsonb_build_object('movement_id', v_new_movement_id), now());

    RETURN v_new_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/* Wrapper functions for each movement type – they simply call the base function with a fixed movement_type constant */

CREATE OR REPLACE FUNCTION public.tgd_rpc_create_receive_movement(
    p_customer_id uuid,
    p_quantity numeric,
    p_source_location_id uuid,
    p_target_location_id uuid,
    p_reference text DEFAULT NULL
) RETURNS uuid AS $$
BEGIN
    RETURN tgd_rpc_create_stock_movement('RECEIVE_CONFIRM', p_customer_id, p_quantity, p_source_location_id, p_target_location_id, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.tgd_rpc_create_putaway_movement(
    p_customer_id uuid,
    p_quantity numeric,
    p_source_location_id uuid,
    p_target_location_id uuid,
    p_reference text DEFAULT NULL
) RETURNS uuid AS $$
BEGIN
    RETURN tgd_rpc_create_stock_movement('PUTAWAY_CONFIRM', p_customer_id, p_quantity, p_source_location_id, p_target_location_id, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.tgd_rpc_create_transfer_movement(
    p_customer_id uuid,
    p_quantity numeric,
    p_source_location_id uuid,
    p_target_location_id uuid,
    p_reference text DEFAULT NULL
) RETURNS uuid AS $$
BEGIN
    RETURN tgd_rpc_create_stock_movement('TRANSFER_CONFIRM', p_customer_id, p_quantity, p_source_location_id, p_target_location_id, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.tgd_rpc_create_adjustment_movement(
    p_customer_id uuid,
    p_quantity numeric,
    p_source_location_id uuid,
    p_target_location_id uuid,
    p_reference text DEFAULT NULL
) RETURNS uuid AS $$
BEGIN
    RETURN tgd_rpc_create_stock_movement('ADJUSTMENT_CONFIRM', p_customer_id, p_quantity, p_source_location_id, p_target_location_id, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.tgd_rpc_create_pick_allocate_movement(
    p_customer_id uuid,
    p_quantity numeric,
    p_source_location_id uuid,
    p_target_location_id uuid,
    p_reference text DEFAULT NULL
) RETURNS uuid AS $$
BEGIN
    RETURN tgd_rpc_create_stock_movement('PICK_ALLOCATE', p_customer_id, p_quantity, p_source_location_id, p_target_location_id, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.tgd_rpc_create_pick_confirm_movement(
    p_customer_id uuid,
    p_quantity numeric,
    p_source_location_id uuid,
    p_target_location_id uuid,
    p_reference text DEFAULT NULL
) RETURNS uuid AS $$
BEGIN
    RETURN tgd_rpc_create_stock_movement('PICK_CONFIRM', p_customer_id, p_quantity, p_source_location_id, p_target_location_id, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.tgd_rpc_create_dispatch_movement(
    p_customer_id uuid,
    p_quantity numeric,
    p_source_location_id uuid,
    p_target_location_id uuid,
    p_reference text DEFAULT NULL
) RETURNS uuid AS $$
BEGIN
    RETURN tgd_rpc_create_stock_movement('DISPATCH_CONFIRM', p_customer_id, p_quantity, p_source_location_id, p_target_location_id, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End of RPC Stock Movement Foundation
