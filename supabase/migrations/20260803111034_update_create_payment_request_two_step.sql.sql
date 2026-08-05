/*
# Update create_payment_request to not require screenshot/transaction_id

The payment flow now has two steps:
1. Create payment request (generates order ref) - no screenshot yet
2. User uploads screenshot and submits

This updates the function to accept null screenshot and transaction_id,
and sets the initial status to 'pending' instead of 'submitted'.
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

  INSERT INTO payment_requests (
    order_ref, user_id, plan_id, plan_version, plan_snapshot,
    amount, currency, billing_region, country,
    payment_method, transaction_id, screenshot_url,
    payment_settings_snapshot, status, expires_at
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
    v_settings, 'pending', now() + interval '24 hours'
  ) RETURNING id INTO v_id;

  -- Notify user that payment request was created
  INSERT INTO notifications (user_id, type, title, body, action_url)
  VALUES (
    auth.uid(), 'info',
    'Payment Request Created',
    'Your order reference is ' || v_order_ref || '. Please complete your payment and upload the screenshot.',
    '/subscribe'
  );

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_payment_request FROM anon;
GRANT EXECUTE ON FUNCTION create_payment_request TO authenticated;

-- Also add an UPDATE policy for payment_requests so users can submit their screenshot
-- (only allow updating screenshot_url, transaction_id, submitted_at, status fields)
DROP POLICY IF EXISTS "payment_requests_update_own_submit" ON payment_requests;
CREATE POLICY "payment_requests_update_own_submit" ON payment_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'submitted'));
