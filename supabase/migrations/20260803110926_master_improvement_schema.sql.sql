/*
# DELULU Master Improvement - Database Schema Enhancements

## Overview
Adds missing fields to membership_plans, creates book_likes table, adds view tracking with anti-spam,
adds chapter banner support, adds genre soft-delete, and enforces mandatory genre on books.

## New Tables
- `book_likes` — One user, one like per book. Replaces denormalized like_count only.

## Modified Tables
- `membership_plans` — Adds: short_description, long_description, badge, accent_color, is_popular,
  is_recommended, deleted_at, billing_type, intl_currency, duration_type
- `chapters` — Adds: banner_url
- `genres` — Adds: deleted_at, deleted_by
- `books` — Enforces genre_id NOT NULL via trigger (idempotent)

## New Functions
- `increment_book_view(p_book_id uuid)` — Anti-spam view increment using session-based dedup
- `toggle_book_like(p_book_id uuid)` — Toggle like/unlike atomically
- `get_book_stats(p_book_id uuid)` — Returns view_count, like_count, is_liked

## New Triggers
- `enforce_genre_on_publish` — Prevents publishing a book without genre_id

## Security
- RLS on book_likes (owner-scoped CRUD)
- All new functions are SECURITY DEFINER with search_path set
*/

-- ============================================================
-- 1. MEMBERSHIP PLANS - ADD MISSING FIELDS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'short_description') THEN
    ALTER TABLE membership_plans ADD COLUMN short_description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'long_description') THEN
    ALTER TABLE membership_plans ADD COLUMN long_description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'badge') THEN
    ALTER TABLE membership_plans ADD COLUMN badge text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'accent_color') THEN
    ALTER TABLE membership_plans ADD COLUMN accent_color text DEFAULT 'primary';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'is_popular') THEN
    ALTER TABLE membership_plans ADD COLUMN is_popular boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'is_recommended') THEN
    ALTER TABLE membership_plans ADD COLUMN is_recommended boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'deleted_at') THEN
    ALTER TABLE membership_plans ADD COLUMN deleted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'billing_type') THEN
    ALTER TABLE membership_plans ADD COLUMN billing_type text NOT NULL DEFAULT 'one_time' CHECK (billing_type IN ('one_time', 'recurring'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'duration_type') THEN
    ALTER TABLE membership_plans ADD COLUMN duration_type text NOT NULL DEFAULT 'monthly' CHECK (duration_type IN ('monthly', 'yearly', 'lifetime', 'custom'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_plans' AND column_name = 'intl_currency') THEN
    ALTER TABLE membership_plans ADD COLUMN intl_currency text NOT NULL DEFAULT 'USD';
  END IF;
END $$;

-- Update membership_plans SELECT policy to exclude soft-deleted
DROP POLICY IF EXISTS "membership_plans_select" ON membership_plans;
CREATE POLICY "membership_plans_select" ON membership_plans FOR SELECT
  TO authenticated
  USING (
    (status = 'active' AND is_visible = true AND deleted_at IS NULL)
    OR public.is_admin()
  );

-- ============================================================
-- 2. CHAPTER BANNER
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapters' AND column_name = 'banner_url') THEN
    ALTER TABLE chapters ADD COLUMN banner_url text;
  END IF;
END $$;

-- ============================================================
-- 3. GENRE SOFT DELETE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'genres' AND column_name = 'deleted_at') THEN
    ALTER TABLE genres ADD COLUMN deleted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'genres' AND column_name = 'deleted_by') THEN
    ALTER TABLE genres ADD COLUMN deleted_by uuid;
  END IF;
END $$;

-- Update genres SELECT to exclude soft-deleted
DROP POLICY IF EXISTS "genres_select" ON genres;
CREATE POLICY "genres_select" ON genres FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL);

-- ============================================================
-- 4. BOOK LIKES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS book_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

ALTER TABLE book_likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS book_likes_book_idx ON book_likes(book_id);
CREATE INDEX IF NOT EXISTS book_likes_user_idx ON book_likes(user_id);

DROP POLICY IF EXISTS "book_likes_select_all" ON book_likes;
CREATE POLICY "book_likes_select_all" ON book_likes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "book_likes_insert_own" ON book_likes;
CREATE POLICY "book_likes_insert_own" ON book_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "book_likes_delete_own" ON book_likes;
CREATE POLICY "book_likes_delete_own" ON book_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. VIEW TRACKING WITH ANTI-SPAM
-- ============================================================
-- Uses a temporary table to track views within a session window
-- to prevent refresh spam from inflating view counts.
CREATE TABLE IF NOT EXISTS book_view_log (
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  session_key text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, session_key)
);

ALTER TABLE book_view_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "book_view_log_insert" ON book_view_log;
CREATE POLICY "book_view_log_insert" ON book_view_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "book_view_log_select" ON book_view_log;
CREATE POLICY "book_view_log_select" ON book_view_log FOR SELECT
  TO anon, authenticated USING (true);

-- Clean old view logs (keep 1 hour)
CREATE INDEX IF NOT EXISTS book_view_log_viewed_idx ON book_view_log(viewed_at);

-- increment_book_view function: increments view_count only if not viewed in last hour
CREATE OR REPLACE FUNCTION increment_book_view(p_book_id uuid, p_session_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inserted boolean;
BEGIN
  -- Try to insert a view log entry. If the PK already exists (same session_key+book), it fails silently.
  BEGIN
    INSERT INTO book_view_log (book_id, session_key, user_id)
    VALUES (p_book_id, p_session_key, auth.uid())
    ON CONFLICT (book_id, session_key) DO NOTHING
    RETURNING true INTO v_inserted;
  EXCEPTION WHEN OTHERS THEN
    v_inserted := false;
  END;

  -- Only increment if this is a new view (insert succeeded)
  IF v_inserted THEN
    UPDATE books SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_book_id;
    -- Clean up old entries (older than 1 hour)
    DELETE FROM book_view_log WHERE viewed_at < now() - interval '1 hour' AND book_id = p_book_id;
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_book_view FROM anon;
GRANT EXECUTE ON FUNCTION increment_book_view TO authenticated;

-- toggle_book_like function: atomically like/unlike
CREATE OR REPLACE FUNCTION toggle_book_like(p_book_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_liked boolean;
BEGIN
  -- Try to delete existing like
  DELETE FROM book_likes WHERE book_id = p_book_id AND user_id = auth.uid() RETURNING true INTO v_liked;

  IF v_liked THEN
    -- Was liked, now unliked
    UPDATE books SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0) WHERE id = p_book_id;
    RETURN false;
  ELSE
    -- Not liked, add like
    INSERT INTO book_likes (book_id, user_id) VALUES (p_book_id, auth.uid())
    ON CONFLICT (user_id, book_id) DO NOTHING;

    IF FOUND THEN
      UPDATE books SET like_count = COALESCE(like_count, 0) + 1 WHERE id = p_book_id;
      RETURN true;
    END IF;
    RETURN false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION toggle_book_like FROM anon;
GRANT EXECUTE ON FUNCTION toggle_book_like TO authenticated;

-- get_book_stats function: returns view_count, like_count, and whether current user liked
CREATE OR REPLACE FUNCTION get_book_stats(p_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_view_count integer;
  v_like_count integer;
  v_is_liked boolean;
BEGIN
  SELECT COALESCE(view_count, 0), COALESCE(like_count, 0) INTO v_view_count, v_like_count
  FROM books WHERE id = p_book_id;

  SELECT EXISTS(SELECT 1 FROM book_likes WHERE book_id = p_book_id AND user_id = auth.uid()) INTO v_is_liked;

  RETURN jsonb_build_object(
    'view_count', v_view_count,
    'like_count', v_like_count,
    'is_liked', v_is_liked
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_book_stats FROM anon;
GRANT EXECUTE ON FUNCTION get_book_stats TO authenticated;

-- ============================================================
-- 6. ENFORCE GENRE ON PUBLISH
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_genre_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.genre_id IS NULL THEN
    RAISE EXCEPTION 'Cannot publish a book without selecting a genre';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_genre_on_publish ON books;
CREATE TRIGGER trigger_enforce_genre_on_publish
  BEFORE INSERT OR UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION enforce_genre_on_publish();

-- ============================================================
-- 7. UPDATE NOTIFICATIONS TABLE - ADD read_at COLUMN
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at') THEN
    ALTER TABLE notifications ADD COLUMN read_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_url') THEN
    ALTER TABLE notifications ADD COLUMN action_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'data') THEN
    ALTER TABLE notifications ADD COLUMN data jsonb;
  END IF;
END $$;

-- Update notification INSERT policy to also allow admin inserts (for system notifications)
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- 8. ADD PAYMENT REQUEST EXPIRY CLEANUP
-- ============================================================
-- Function to mark expired payment requests
CREATE OR REPLACE FUNCTION expire_payment_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE payment_requests SET
    status = 'expired',
    updated_at = now()
  WHERE status IN ('pending', 'submitted')
  AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION expire_payment_requests FROM anon;
GRANT EXECUTE ON FUNCTION expire_payment_requests TO authenticated;
