-- ============================================
-- Platform Feature Control System
-- ============================================

-- 1. feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  feature_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('disabled', 'coming_soon', 'enabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Public can read feature flags (needed to check if features are visible)
DROP POLICY IF EXISTS "public_read_feature_flags" ON feature_flags;
CREATE POLICY "public_read_feature_flags" ON feature_flags FOR SELECT
  TO anon, authenticated USING (true);

-- Only admins can insert/update/delete
DROP POLICY IF EXISTS "admin_insert_feature_flags" ON feature_flags;
CREATE POLICY "admin_insert_feature_flags" ON feature_flags FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_feature_flags" ON feature_flags;
CREATE POLICY "admin_update_feature_flags" ON feature_flags FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_feature_flags" ON feature_flags;
CREATE POLICY "admin_delete_feature_flags" ON feature_flags FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. feature_dependencies table
CREATE TABLE IF NOT EXISTS feature_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL,
  required_feature_key text NOT NULL,
  dependency_type text NOT NULL DEFAULT 'requires'
    CHECK (dependency_type IN ('requires', 'optional', 'dependent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feature_key, required_feature_key)
);

ALTER TABLE feature_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_feature_dependencies" ON feature_dependencies;
CREATE POLICY "public_read_feature_dependencies" ON feature_dependencies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_feature_dependencies" ON feature_dependencies;
CREATE POLICY "admin_write_feature_dependencies" ON feature_dependencies FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. payment_mode setting (stored as a feature_flag with special key)
-- We'll use feature_flags with key 'payment_mode' but with different status values
-- Actually, let's use a separate settings table for payment_mode to keep it clean

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_platform_settings" ON platform_settings;
CREATE POLICY "public_read_platform_settings" ON platform_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_platform_settings" ON platform_settings;
CREATE POLICY "admin_write_platform_settings" ON platform_settings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- Seed initial feature flags
-- ============================================

INSERT INTO feature_flags (feature_key, feature_name, description, status) VALUES
  -- Monetization
  ('coins_system', 'Coins System', 'Virtual coins for unlocking premium content', 'enabled'),
  ('premium_chapters', 'Premium Chapters', 'Writers can mark chapters as premium', 'enabled'),
  ('writer_earnings', 'Writer Earnings', 'Writers earn revenue from their content', 'enabled'),
  ('subscriptions', 'Subscriptions', 'Monthly and yearly subscription plans', 'enabled'),
  ('payment_system', 'Payment System', 'Process payments for subscriptions and coins', 'enabled'),
  -- Content Types
  ('reels', 'Reels', 'Short-form video episodes and mini dramas', 'enabled'),
  ('audiobooks', 'Audiobooks', 'Audio book listening experience', 'coming_soon'),
  -- Community
  ('comments', 'Comments', 'Readers can comment on chapters and reels', 'enabled'),
  ('ratings', 'Ratings', 'Star ratings on content', 'enabled'),
  ('reviews', 'Reviews', 'Long-form reviews on books', 'enabled'),
  ('messaging', 'Messaging', 'Direct messages between users', 'disabled'),
  -- AI Features
  ('ai_writer_tools', 'AI Writer Tools', 'AI-assisted writing tools for authors', 'disabled'),
  ('ai_cover_generator', 'AI Cover Generator', 'Generate book covers with AI', 'disabled')
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================
-- Seed payment_mode setting
-- ============================================

INSERT INTO platform_settings (setting_key, setting_value) VALUES
  ('payment_mode', 'manual_payment')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- Seed feature dependencies
-- ============================================

INSERT INTO feature_dependencies (feature_key, required_feature_key, dependency_type) VALUES
  -- Coins System is master
  ('premium_chapters', 'coins_system', 'requires'),
  ('writer_earnings', 'coins_system', 'requires'),
  ('subscriptions', 'payment_system', 'requires'),
  -- Payment System is master
  ('subscriptions', 'payment_system', 'requires'),
  -- Reels is master
  ('reel_uploads', 'reels', 'requires'),
  ('reel_comments', 'reels', 'requires'),
  ('reel_likes', 'reels', 'requires'),
  ('reel_monetization', 'reels', 'requires'),
  ('reel_creator_rewards', 'reels', 'requires'),
  -- Audiobooks is master
  ('premium_audiobooks', 'audiobooks', 'requires'),
  ('audiobook_purchases', 'audiobooks', 'requires'),
  ('audiobook_subscriptions', 'audiobooks', 'requires'),
  ('audiobook_creator_revenue', 'audiobooks', 'requires'),
  -- AI Features master (using ai_writer_tools as master per spec)
  ('ai_cover_generator', 'ai_writer_tools', 'requires')
ON CONFLICT (feature_key, required_feature_key) DO NOTHING;

-- ============================================
-- Auto-sync function: when a master feature is disabled,
-- cascade-disable all dependents
-- ============================================

CREATE OR REPLACE FUNCTION disable_feature_dependents(p_feature_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dep_record RECORD;
BEGIN
  FOR dep_record IN
    SELECT feature_key FROM feature_dependencies
    WHERE required_feature_key = p_feature_key AND dependency_type = 'requires'
  LOOP
    UPDATE feature_flags SET status = 'disabled', updated_at = now()
    WHERE feature_key = dep_record.feature_key AND status != 'disabled';
    
    -- Recursively disable dependents of dependents
    PERFORM disable_feature_dependents(dep_record.feature_key);
  END LOOP;
END;
$$;

-- ============================================
-- Trigger: auto-disable dependents when a feature is disabled
-- ============================================

CREATE OR REPLACE FUNCTION handle_feature_flag_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'disabled' AND OLD.status != 'disabled' THEN
    PERFORM disable_feature_dependents(NEW.feature_key);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_feature_flag_cascade_disable ON feature_flags;
CREATE TRIGGER trigger_feature_flag_cascade_disable
  AFTER UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION handle_feature_flag_update();
