/*
# Membership System Redesign + Security Hardening

## Overview
Replaces the simple subscription_plans/subscriptions system with a flexible, versioned membership architecture
that supports entitlements, plan snapshots, payment requests with order references, and admin-configurable
payment settings. Also adds admin activity logging, login history, soft-delete infrastructure, and maintenance mode.

## New Tables

### 1. membership_plans
Replaces subscription_plans. Supports multiple plans with flexible benefits, pricing, duration, display order, visibility, and versioning.
- id (uuid PK)
- name (text, not null)
- description (text, nullable)
- price_inr (integer, not null) — price in INR (paise)
- price_intl (integer, nullable) — international price in cents
- currency (text, default 'INR')
- duration_days (integer, not null)
- benefits (text[], default '{}') — list of entitlement keys (e.g. 'premium_books')
- display_order (integer, default 0)
- status (text: 'active'|'disabled'|'archived', default 'active')
- is_visible (boolean, default true) — whether readers can see/purchase
- plan_version (integer, default 1) — incremented on each edit
- created_at, updated_at (timestamptz)
- created_by (uuid, FK→profiles)

### 2. payment_requests
Replaces subscriptions table. Each purchase generates a unique order reference and stores a full snapshot.
- id (uuid PK)
- order_ref (text, unique) — e.g. 'SUB-8F7A9P2K'
- user_id (uuid, FK→profiles, default auth.uid())
- plan_id (uuid, FK→membership_plans)
- plan_version (integer) — snapshot of plan version at purchase time
- plan_snapshot (jsonb) — full snapshot: name, price, duration, benefits, version
- amount (integer, not null) — amount in paise/cents
- currency (text, default 'INR')
- billing_region (text: 'india'|'international')
- country (text, nullable)
- payment_method (text: 'upi'|'paypal'|'gateway'|'other')
- transaction_id (text, nullable)
- screenshot_url (text, nullable)
- payment_settings_snapshot (jsonb, nullable) — UPI ID, PayPal email, etc. at time of request
- status (text: 'pending'|'submitted'|'under_review'|'approved'|'rejected'|'expired'|'cancelled')
- rejection_reason (text, nullable)
- admin_notes (text, nullable)
- reviewed_by (uuid, nullable, FK→profiles)
- reviewed_at (timestamptz, nullable)
- expires_at (timestamptz) — default 24 hours from creation
- created_at, updated_at, submitted_at (timestamptz)

### 3. user_memberships
Active membership records linked to approved payment requests. Replaces the 'active' status in subscriptions.
- id (uuid PK)
- user_id (uuid, FK→profiles, default auth.uid())
- plan_id (uuid, FK→membership_plans)
- plan_snapshot (jsonb) — frozen plan details
- payment_request_id (uuid, FK→payment_requests)
- entitlements (text[]) — benefits at time of activation
- start_date (timestamptz, not null)
- end_date (timestamptz, not null)
- status (text: 'active'|'expired'|'cancelled')
- created_at, updated_at (timestamptz)
- Unique(user_id, plan_id, status) WHERE status = 'active' — prevents duplicate active memberships

### 4. payment_settings
Admin-configurable payment information. Key-value structure.
- id (uuid PK)
- setting_key (text, unique)
- setting_value (text)
- setting_group (text: 'upi'|'paypal'|'general'|'currency')
- updated_by (uuid, nullable, FK→profiles)
- updated_at (timestamptz)

### 5. admin_activity_log
Records admin actions for audit trail.
- id (uuid PK)
- admin_id (uuid, FK→profiles)
- action (text) — e.g. 'payment_approved', 'plan_created', 'book_deleted'
- entity_type (text, nullable)
- entity_id (text, nullable)
- details (jsonb, nullable)
- created_at (timestamptz)

### 6. admin_login_history
Records admin login attempts.
- id (uuid PK)
- user_id (uuid, nullable, FK→profiles)
- email (text, nullable)
- user_agent (text, nullable)
- ip_address (text, nullable)
- success (boolean)
- created_at (timestamptz)

## Modified Tables

### books, chapters, reels
Add `deleted_at` (timestamptz, nullable) and `deleted_by` (uuid, nullable) for soft-delete support.

### profiles
Revoke UPDATE on role, coins, is_suspended, password_changed_at from authenticated.
Add columns via ALTER (idempotent).

## Security

### RLS Policies
All new tables get RLS with appropriate ownership/admin scoping.

### SECURITY DEFINER Functions
1. approve_payment_request(p_request_id uuid) — admin-only, approves a payment request and creates a user_membership
2. reject_payment_request(p_request_id uuid, p_reason text) — admin-only, rejects with mandatory reason
3. request_new_proof(p_request_id uuid) — admin-only, resets to pending for new screenshot
4. create_payment_request(...) — user-facing, creates request with snapshot + order ref
5. admin_log_action(p_action text, p_entity_type text, p_entity_id text, p_details jsonb) — admin-only audit logging
6. set_membership_expired() — scheduled, marks expired memberships

### Column-level privileges
- profiles: REVOKE UPDATE on role, coins, is_suspended, password_changed_at from authenticated
- subscriptions: REVOKE UPDATE from authenticated (admin-only via function)
*/

-- ============================================================
-- 1. MEMBERSHIP PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_inr integer NOT NULL DEFAULT 0,
  price_intl integer,
  currency text NOT NULL DEFAULT 'INR',
  duration_days integer NOT NULL DEFAULT 30,
  benefits text[] NOT NULL DEFAULT ARRAY['premium_books']::text[],
  display_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived')),
  is_visible boolean NOT NULL DEFAULT true,
  plan_version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membership_plans_select" ON membership_plans;
CREATE POLICY "membership_plans_select" ON membership_plans FOR SELECT
  TO authenticated
  USING (status = 'active' AND is_visible = true OR public.is_admin());

DROP POLICY IF EXISTS "membership_plans_insert_admin" ON membership_plans;
CREATE POLICY "membership_plans_insert_admin" ON membership_plans FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "membership_plans_update_admin" ON membership_plans;
CREATE POLICY "membership_plans_update_admin" ON membership_plans FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "membership_plans_delete_admin" ON membership_plans;
CREATE POLICY "membership_plans_delete_admin" ON membership_plans FOR DELETE
  TO authenticated USING (public.is_admin());

-- Seed default plan from existing subscription_plans data
INSERT INTO membership_plans (name, description, price_inr, duration_days, benefits, display_order, status, is_visible, created_by)
SELECT 'DELULU Premium', 'Unlock all premium books', 99, 30, ARRAY['premium_books'], 0, 'active', true, null
WHERE NOT EXISTS (SELECT 1 FROM membership_plans LIMIT 1);

INSERT INTO membership_plans (name, description, price_inr, duration_days, benefits, display_order, status, is_visible, created_by)
SELECT 'DELULU Premium Annual', 'Unlock all premium books — best value', 999, 365, ARRAY['premium_books'], 1, 'active', true, null
WHERE NOT EXISTS (SELECT 1 FROM membership_plans WHERE duration_days = 365 LIMIT 1);

-- ============================================================
-- 2. PAYMENT REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref text UNIQUE NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES membership_plans(id),
  plan_version integer NOT NULL,
  plan_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  billing_region text NOT NULL DEFAULT 'india' CHECK (billing_region IN ('india', 'international')),
  country text,
  payment_method text NOT NULL DEFAULT 'upi' CHECK (payment_method IN ('upi', 'paypal', 'gateway', 'other')),
  transaction_id text,
  screenshot_url text,
  payment_settings_snapshot jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'expired', 'cancelled')),
  rejection_reason text,
  admin_notes text,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payment_requests_user_idx ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS payment_requests_status_idx ON payment_requests(status);
CREATE INDEX IF NOT EXISTS payment_requests_order_ref_idx ON payment_requests(order_ref);

DROP POLICY IF EXISTS "payment_requests_select_own_admin" ON payment_requests;
CREATE POLICY "payment_requests_select_own_admin" ON payment_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "payment_requests_insert_own" ON payment_requests;
CREATE POLICY "payment_requests_insert_own" ON payment_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy: users cannot modify payment requests after creation.
-- All status changes go through SECURITY DEFINER functions (admin-only).

-- ============================================================
-- 3. USER MEMBERSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES membership_plans(id),
  plan_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_request_id uuid REFERENCES payment_requests(id),
  entitlements text[] NOT NULL DEFAULT ARRAY[]::text[],
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS user_memberships_unique_active_idx
  ON user_memberships (user_id, plan_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS user_memberships_user_idx ON user_memberships(user_id);
CREATE INDEX IF NOT EXISTS user_memberships_status_idx ON user_memberships(status);

DROP POLICY IF EXISTS "user_memberships_select_own_admin" ON user_memberships;
CREATE POLICY "user_memberships_select_own_admin" ON user_memberships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- No INSERT/UPDATE/DELETE from client — all through SECURITY DEFINER functions

-- ============================================================
-- 4. PAYMENT SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text,
  setting_group text NOT NULL DEFAULT 'general' CHECK (setting_group IN ('upi', 'paypal', 'general', 'currency')),
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_settings_select_all" ON payment_settings;
CREATE POLICY "payment_settings_select_all" ON payment_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "payment_settings_update_admin" ON payment_settings;
CREATE POLICY "payment_settings_update_admin" ON payment_settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payment_settings_insert_admin" ON payment_settings;
CREATE POLICY "payment_settings_insert_admin" ON payment_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payment_settings_delete_admin" ON payment_settings;
CREATE POLICY "payment_settings_delete_admin" ON payment_settings FOR DELETE
  TO authenticated USING (public.is_admin());

-- Seed default payment settings
INSERT INTO payment_settings (setting_key, setting_value, setting_group)
VALUES
  ('upi_id', 'delulu@upi', 'upi'),
  ('upi_qr_url', '', 'upi'),
  ('business_name', 'DELULU', 'upi'),
  ('paypal_email', '', 'paypal'),
  ('paypal_me_link', '', 'paypal'),
  ('paypal_qr_url', '', 'paypal'),
  ('payment_instructions', 'Pay to the UPI ID above and upload the screenshot.', 'general'),
  ('support_email', 'support@delulu.com', 'general'),
  ('payment_notes', '', 'general'),
  ('intl_currency', 'USD', 'currency'),
  ('intl_price_label', '$2.99', 'currency')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 5. ADMIN ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_activity_log_admin_idx ON admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS admin_activity_log_created_idx ON admin_activity_log(created_at DESC);

DROP POLICY IF EXISTS "admin_activity_log_select_admin" ON admin_activity_log;
CREATE POLICY "admin_activity_log_select_admin" ON admin_activity_log FOR SELECT
  TO authenticated USING (public.is_admin());

-- INSERT only through SECURITY DEFINER function

-- ============================================================
-- 6. ADMIN LOGIN HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text,
  user_agent text,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_login_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_login_history_created_idx ON admin_login_history(created_at DESC);

DROP POLICY IF EXISTS "admin_login_history_select_admin" ON admin_login_history;
CREATE POLICY "admin_login_history_select_admin" ON admin_login_history FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_login_history_insert_own" ON admin_login_history;
CREATE POLICY "admin_login_history_insert_own" ON admin_login_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- 7. SOFT DELETE COLUMNS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'deleted_at') THEN
    ALTER TABLE books ADD COLUMN deleted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'deleted_by') THEN
    ALTER TABLE books ADD COLUMN deleted_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapters' AND column_name = 'deleted_at') THEN
    ALTER TABLE chapters ADD COLUMN deleted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapters' AND column_name = 'deleted_by') THEN
    ALTER TABLE chapters ADD COLUMN deleted_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reels' AND column_name = 'deleted_at') THEN
    ALTER TABLE reels ADD COLUMN deleted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reels' AND column_name = 'deleted_by') THEN
    ALTER TABLE reels ADD COLUMN deleted_by uuid;
  END IF;
END $$;

-- ============================================================
-- 8. SECURITY DEFINER FUNCTIONS
-- ============================================================

-- Generate unique order reference
CREATE OR REPLACE FUNCTION generate_order_ref()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_exists boolean;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
BEGIN
  LOOP
    v_ref := 'SUB-';
    FOR i IN 1..8 LOOP
      v_ref := v_ref || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM payment_requests WHERE order_ref = v_ref) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_ref;
    END IF;
  END LOOP;
END;
$$;

-- Create payment request with snapshot
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
  v_settings_row record;
BEGIN
  SELECT * INTO v_plan FROM membership_plans WHERE id = p_plan_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or inactive';
  END IF;

  -- Determine amount based on billing region
  IF p_billing_region = 'international' AND v_plan.price_intl IS NOT NULL THEN
    v_amount := v_plan.price_intl;
  ELSE
    v_amount := v_plan.price_inr;
  END IF;

  -- Snapshot payment settings
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
      'price_inr', v_plan.price_inr,
      'price_intl', v_plan.price_intl,
      'duration_days', v_plan.duration_days,
      'benefits', v_plan.benefits,
      'plan_version', v_plan.plan_version
    ),
    v_amount, v_plan.currency, p_billing_region, p_country,
    p_payment_method, p_transaction_id, p_screenshot_url,
    v_settings, 'submitted', now() + interval '24 hours'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_payment_request FROM anon;
GRANT EXECUTE ON FUNCTION create_payment_request TO authenticated;

-- Approve payment request (admin-only)
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
  -- Verify caller is admin
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

  -- Get plan from snapshot
  SELECT * INTO v_plan FROM membership_plans WHERE id = v_request.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  v_end_date := now() + (v_plan.duration_days || ' days')::interval;

  -- Check for existing active membership for same plan
  SELECT * INTO v_existing_membership FROM user_memberships
  WHERE user_id = v_request.user_id AND plan_id = v_request.plan_id AND status = 'active';

  IF FOUND THEN
    -- Extend existing membership
    UPDATE user_memberships SET
      end_date = GREATEST(v_existing_membership.end_date, now()) + (v_plan.duration_days || ' days')::interval,
      plan_snapshot = v_request.plan_snapshot,
      entitlements = v_request.plan_snapshot->>'benefits',
      payment_request_id = p_request_id,
      updated_at = now()
    WHERE id = v_existing_membership.id;
  ELSE
    -- Create new membership
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

  -- Update payment request
  UPDATE payment_requests SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  -- Log the action
  INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment_approved', 'payment_request', p_request_id::text,
    jsonb_build_object('user_id', v_request.user_id, 'order_ref', v_request.order_ref));
END;
$$;

REVOKE EXECUTE ON FUNCTION approve_payment_request FROM anon;
GRANT EXECUTE ON FUNCTION approve_payment_request TO authenticated;

-- Reject payment request (admin-only, reason required)
CREATE OR REPLACE FUNCTION reject_payment_request(p_request_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
  WHERE id = p_request_id AND status IN ('submitted', 'under_review', 'pending');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not in a reviewable state';
  END IF;

  INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment_rejected', 'payment_request', p_request_id::text,
    jsonb_build_object('reason', p_reason));
END;
$$;

REVOKE EXECUTE ON FUNCTION reject_payment_request FROM anon;
GRANT EXECUTE ON FUNCTION reject_payment_request TO authenticated;

-- Request new proof (admin-only, resets to pending)
CREATE OR REPLACE FUNCTION request_new_proof(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
  WHERE id = p_request_id AND status IN ('submitted', 'under_review');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not in a reviewable state';
  END IF;

  INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'new_proof_requested', 'payment_request', p_request_id::text);
END;
$$;

REVOKE EXECUTE ON FUNCTION request_new_proof FROM anon;
GRANT EXECUTE ON FUNCTION request_new_proof TO authenticated;

-- Admin log action function
CREATE OR REPLACE FUNCTION admin_log_action(
  p_action text,
  p_entity_type text DEFAULT null,
  p_entity_id text DEFAULT null,
  p_details jsonb DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_details);
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_log_action FROM anon;
GRANT EXECUTE ON FUNCTION admin_log_action TO authenticated;

-- Mark expired memberships
CREATE OR REPLACE FUNCTION expire_memberships()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE user_memberships SET
    status = 'expired',
    updated_at = now()
  WHERE status = 'active' AND end_date < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION expire_memberships FROM anon;
GRANT EXECUTE ON FUNCTION expire_memberships TO authenticated;

-- Check if user has a specific entitlement
CREATE OR REPLACE FUNCTION has_entitlement(p_user_id uuid, p_entitlement text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_memberships
    WHERE user_id = p_user_id
    AND status = 'active'
    AND end_date > now()
    AND (p_entitlement = ANY (entitlements) OR 'all_access' = ANY (entitlements))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION has_entitlement FROM anon;
GRANT EXECUTE ON FUNCTION has_entitlement TO authenticated;

-- ============================================================
-- 9. COLUMN-LEVEL SECURITY ON PROFILES
-- ============================================================
-- Revoke UPDATE on sensitive columns from authenticated users
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, bio, username) ON profiles TO authenticated;

-- ============================================================
-- 10. FIX SUBSCRIPTIONS TABLE POLICY
-- ============================================================
-- Remove the dangerous UPDATE policy that allowed self-approval
DROP POLICY IF EXISTS "subscriptions_update_own_admin" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;

-- Only admin can update subscriptions now (for backward compat)
CREATE POLICY "subscriptions_update_admin" ON subscriptions FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 11. ADD NOTIFICATIONS TABLE (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 12. MAINTENANCE MODE SETTING
-- ============================================================
INSERT INTO platform_settings (setting_key, setting_value)
VALUES ('maintenance_mode', 'false')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 13. PANIC SWITCH FEATURE FLAGS
-- ============================================================
INSERT INTO feature_flags (feature_key, feature_name, description, status)
VALUES
  ('registration', 'Registration', 'Allow new user sign-ups', 'enabled'),
  ('writer_applications', 'Writer Applications', 'Allow writer application submissions', 'enabled'),
  ('uploads', 'Uploads', 'Allow file uploads', 'enabled')
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================================
-- 14. REALTIME ON NEW TABLES
-- ============================================================
ALTER TABLE payment_requests REPLICA IDENTITY FULL;
ALTER TABLE user_memberships REPLICA IDENTITY FULL;
ALTER TABLE membership_plans REPLICA IDENTITY FULL;
