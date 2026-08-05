/*
# Fix create_payment_request: Set status='submitted' when screenshot is provided

The payment flow now creates the request only when the user submits proof.
When screenshot_url is provided, the status should be 'submitted' (not 'pending')
and submitted_at should be set.
*/

CREATE OR REPLACE FUNCTION create_payment_request(
  p_plan_id uuid,
  p_billing_region text,
  p_country text DEFAULT null,
  p_payment_method text DEFAULT 'upi',
  p_screenshot_url text DEFAULT null,
  p_transaction_id text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_order_ref text;
  v_plan membership_plans;
  v_amount integer;
  v_settings jsonb;
  v_status text;
BEGIN
  SELECT * INTO v_plan FROM membership_plans WHERE id = p_plan_id AND status = 'active' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or inactive';
  END IF;

  IF p_billing_region = 'international' AND v_plan.price_intl IS NOT NULL THEN
    v_amount := v_plan.price_intl;
  ELSE
    v_amount := v_plan.price_inr;
  END IF;

  SELECT jsonb_object_agg(setting_key, setting_value) INTO v_settings
  FROM payment_settings;

  v_order_ref := generate_order_ref();

  -- If screenshot is provided, this is a submission (not just a draft)
  IF p_screenshot_url IS NOT NULL THEN
    v_status := 'submitted';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO payment_requests (
    order_ref, user_id, plan_id, plan_version, plan_snapshot,
    amount, currency, billing_region, country,
    payment_method, transaction_id, screenshot_url,
    payment_settings_snapshot, status, submitted_at, expires_at
  ) VALUES (
    v_order_ref, auth.uid(), p_plan_id, v_plan.plan_version,
    jsonb_build_object(
      'name', v_plan.name,
      'description', v_plan.description,
      'short_description', v_plan.short_description,
      'price_inr', v_plan.price_inr,
      'price_intl', v_plan.price_intl,
      'duration_days', v_plan.duration_days,
      'benefits', v_plan.benefits,
      'plan_version', v_plan.plan_version
    ),
    v_amount, v_plan.currency, p_billing_region, p_country,
    p_payment_method, p_transaction_id, p_screenshot_url,
    v_settings, v_status,
    CASE WHEN p_screenshot_url IS NOT NULL THEN now() ELSE null END,
    now() + interval '24 hours'
  ) RETURNING id INTO v_id;

  -- Notify user
  INSERT INTO notifications (user_id, type, title, body, action_url)
  VALUES (
    auth.uid(), 'info',
    'Payment Request Submitted',
    'Your order reference is ' || v_order_ref || '. Your payment is now under review.',
    '/subscribe'
  );

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_payment_request FROM anon;
GRANT EXECUTE ON FUNCTION create_payment_request TO authenticated;

-- Remove the old update policy that allowed users to update their own requests
-- (no longer needed since the request is created with screenshot in one step)
DROP POLICY IF EXISTS "payment_requests_update_own_submit" ON payment_requests;

-- Keep a policy that allows users to cancel their own pending/submitted requests
DROP POLICY IF EXISTS "payment_requests_update_own" ON payment_requests;
CREATE POLICY "payment_requests_update_own" ON payment_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'submitted'))
  WITH CHECK (auth.uid() = user_id);
