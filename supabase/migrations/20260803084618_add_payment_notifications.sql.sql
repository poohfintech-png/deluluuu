/*
# Add notifications to payment approval/rejection functions

Updates the approve_payment_request and reject_payment_request functions to also
insert notifications for the user when their payment is approved or rejected.
*/

-- Update approve_payment_request to send notification
CREATE OR REPLACE FUNCTION approve_payment_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request payment_requests;
  v_plan membership_plans;
  v_end_date timestamptz;
  v_existing_membership user_memberships;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request FROM payment_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_request.status NOT IN ('submitted', 'under_review', 'pending') THEN
    RAISE EXCEPTION 'Request is not in a reviewable state';
  END IF;

  SELECT * INTO v_plan FROM membership_plans WHERE id = v_request.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  v_end_date := now() + (v_plan.duration_days || ' days')::interval;

  SELECT * INTO v_existing_membership FROM user_memberships
  WHERE user_id = v_request.user_id AND plan_id = v_request.plan_id AND status = 'active';

  IF FOUND THEN
    UPDATE user_memberships SET
      end_date = GREATEST(v_existing_membership.end_date, now()) + (v_plan.duration_days || ' days')::interval,
      plan_snapshot = v_request.plan_snapshot,
      entitlements = ARRAY(SELECT jsonb_array_elements_text(v_request.plan_snapshot->'benefits')),
      payment_request_id = p_request_id,
      updated_at = now()
    WHERE id = v_existing_membership.id;
  ELSE
    INSERT INTO user_memberships (
      user_id, plan_id, plan_snapshot, payment_request_id,
      entitlements, start_date, end_date, status
    ) VALUES (
      v_request.user_id, v_request.plan_id, v_request.plan_snapshot,
      p_request_id,
      ARRAY(SELECT jsonb_array_elements_text(v_request.plan_snapshot->'benefits')),
      now(), v_end_date, 'active'
    );
  END IF;

  UPDATE payment_requests SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment_approved', 'payment_request', p_request_id::text,
    jsonb_build_object('user_id', v_request.user_id, 'order_ref', v_request.order_ref));

  -- Notify user
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    v_request.user_id, 'success',
    'Membership Activated',
    'Your payment has been approved. You now have access to all premium content.',
    '/dashboard'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION approve_payment_request FROM anon;
GRANT EXECUTE ON FUNCTION approve_payment_request TO authenticated;

-- Update reject_payment_request to send notification
CREATE OR REPLACE FUNCTION reject_payment_request(p_request_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  UPDATE payment_requests SET
    status = 'rejected',
    rejection_reason = p_reason,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_request_id AND status IN ('submitted', 'under_review', 'pending')
  RETURNING user_id INTO v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not in a reviewable state';
  END IF;

  INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment_rejected', 'payment_request', p_request_id::text,
    jsonb_build_object('reason', p_reason));

  -- Notify user
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    v_user_id, 'error',
    'Payment Rejected',
    'Your payment request was rejected. Reason: ' || p_reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION reject_payment_request FROM anon;
GRANT EXECUTE ON FUNCTION reject_payment_request TO authenticated;

-- Update request_new_proof to send notification
CREATE OR REPLACE FUNCTION request_new_proof(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE payment_requests SET
    status = 'pending',
    screenshot_url = null,
    submitted_at = null,
    updated_at = now(),
    expires_at = now() + interval '24 hours'
  WHERE id = p_request_id AND status IN ('submitted', 'under_review')
  RETURNING user_id INTO v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not in a reviewable state';
  END IF;

  INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'new_proof_requested', 'payment_request', p_request_id::text);

  -- Notify user
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    v_user_id, 'info',
    'New Payment Proof Required',
    'Please upload a new payment screenshot for your subscription request.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION request_new_proof FROM anon;
GRANT EXECUTE ON FUNCTION request_new_proof TO authenticated;
