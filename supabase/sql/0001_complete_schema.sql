-- ============================================================================
-- Delulu — Complete Supabase Schema Migration
-- ============================================================================
-- This file captures the full database schema as it exists in the live
-- Supabase project. It is idempotent — safe to run on a fresh project.
--
-- Contents:
--   1. Utility functions (is_admin)
--   2. Tables (11 tables with primary keys, foreign keys, constraints)
--   3. Indexes
--   4. Row Level Security policies (per table, per CRUD verb)
--   5. Auth integration (trigger to auto-create profiles on signup)
--   6. Storage buckets (3 buckets with storage policies)
--   7. Realtime publication
--   8. Seed data (subscription plans)
-- ============================================================================

-- ============================================================================
-- 1. UTILITY FUNCTIONS
-- ============================================================================

-- is_admin(): returns true if the current authenticated user has role='admin'
-- Used by RLS policies throughout to gate admin-only operations.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- ---- profiles ----
-- Stores user profile data. id maps 1:1 to auth.users.id.
-- A trigger (on_auth_user_created) auto-inserts a row here on signup.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT 'Anonymous',
  avatar_url text,
  bio text,
  role text NOT NULL DEFAULT 'reader' CHECK (role IN ('admin','reader')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---- books ----
-- Books written by authors (admin users). status controls visibility.
CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_url text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- ---- chapters ----
-- Chapters within a book. content stores TipTap editor JSON.
-- order_index controls display ordering within a book.
CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  audio_url text,
  video_url text,
  is_free boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- ---- subscription_plans ----
-- Available subscription tiers. Seeded with monthly and yearly.
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name IN ('monthly','yearly')),
  price_inr integer NOT NULL,
  duration_days integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- ---- subscriptions ----
-- Reader subscription requests. Users submit UPI payment screenshots;
-- admins approve or reject. status tracks the workflow.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','expired')),
  payment_screenshot_url text,
  upi_ref_id text,
  start_date timestamptz,
  end_date timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ---- libraries ----
-- Reader's saved/bookmarked books.
CREATE TABLE IF NOT EXISTS public.libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;

-- ---- follows ----
-- Author follow relationships between users.
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- ---- chapter_likes ----
-- Likes on chapters. One like per user per chapter (unique constraint).
CREATE TABLE IF NOT EXISTS public.chapter_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);
ALTER TABLE public.chapter_likes ENABLE ROW LEVEL SECURITY;

-- ---- comments ----
-- Comments on chapters. Users can delete their own; admins can delete any.
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ---- reading_history ----
-- Tracks reading progress per user per chapter. progress is 0-100.
CREATE TABLE IF NOT EXISTS public.reading_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;

-- ---- listening_history ----
-- Tracks audio listening progress per user per chapter.
CREATE TABLE IF NOT EXISTS public.listening_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  last_listened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- chapters: lookup by book + ordering
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON public.chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_order ON public.chapters(book_id, order_index);

-- comments: lookup by chapter
CREATE INDEX IF NOT EXISTS idx_comments_chapter ON public.comments(chapter_id);

-- subscriptions: lookup by user and status
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ---- profiles ----
-- Public read; users can update their own profile.
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---- books ----
-- Published books are publicly readable; drafts only visible to admins.
-- Only admins can create, update, or delete books.
DROP POLICY IF EXISTS "books_select" ON public.books;
CREATE POLICY "books_select" ON public.books
  FOR SELECT TO anon, authenticated
  USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "books_insert_admin" ON public.books;
CREATE POLICY "books_insert_admin" ON public.books
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "books_update_admin" ON public.books;
CREATE POLICY "books_update_admin" ON public.books
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "books_delete_admin" ON public.books;
CREATE POLICY "books_delete_admin" ON public.books
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---- chapters ----
-- Published chapters are publicly readable; drafts only to admins.
-- Only admins can create, update, or delete chapters.
DROP POLICY IF EXISTS "chapters_select" ON public.chapters;
CREATE POLICY "chapters_select" ON public.chapters
  FOR SELECT TO anon, authenticated
  USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "chapters_insert_admin" ON public.chapters;
CREATE POLICY "chapters_insert_admin" ON public.chapters
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "chapters_update_admin" ON public.chapters;
CREATE POLICY "chapters_update_admin" ON public.chapters
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "chapters_delete_admin" ON public.chapters;
CREATE POLICY "chapters_delete_admin" ON public.chapters
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---- subscription_plans ----
-- Plans are publicly readable. Only admins can create or update.
DROP POLICY IF EXISTS "plans_select_all" ON public.subscription_plans;
CREATE POLICY "plans_select_all" ON public.subscription_plans
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "plans_insert_admin" ON public.subscription_plans;
CREATE POLICY "plans_insert_admin" ON public.subscription_plans
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "plans_update_admin" ON public.subscription_plans;
CREATE POLICY "plans_update_admin" ON public.subscription_plans
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- subscriptions ----
-- Users can see their own subscriptions; admins can see all.
-- Users can create their own; users and admins can update; only admins can delete.
DROP POLICY IF EXISTS "subs_select" ON public.subscriptions;
CREATE POLICY "subs_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "subs_insert_own" ON public.subscriptions;
CREATE POLICY "subs_insert_own" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subs_update_own_admin" ON public.subscriptions;
CREATE POLICY "subs_update_own_admin" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "subs_delete_admin" ON public.subscriptions;
CREATE POLICY "subs_delete_admin" ON public.subscriptions
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---- libraries ----
-- Users can only see, add, or remove books in their own library.
DROP POLICY IF EXISTS "lib_select_own" ON public.libraries;
CREATE POLICY "lib_select_own" ON public.libraries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lib_insert_own" ON public.libraries;
CREATE POLICY "lib_insert_own" ON public.libraries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lib_delete_own" ON public.libraries;
CREATE POLICY "lib_delete_own" ON public.libraries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- follows ----
-- Follow relationships are public. Users can follow and unfollow.
DROP POLICY IF EXISTS "follows_select_all" ON public.follows;
CREATE POLICY "follows_select_all" ON public.follows
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own" ON public.follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own" ON public.follows
  FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ---- chapter_likes ----
-- Likes are public. Users can like and unlike chapters.
DROP POLICY IF EXISTS "likes_select_all" ON public.chapter_likes;
CREATE POLICY "likes_select_all" ON public.chapter_likes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "likes_insert_own" ON public.chapter_likes;
CREATE POLICY "likes_insert_own" ON public.chapter_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete_own" ON public.chapter_likes;
CREATE POLICY "likes_delete_own" ON public.chapter_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- comments ----
-- Comments are public. Users can comment and delete their own; admins can delete any.
DROP POLICY IF EXISTS "comments_select_all" ON public.comments;
CREATE POLICY "comments_select_all" ON public.comments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own_admin" ON public.comments;
CREATE POLICY "comments_delete_own_admin" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ---- reading_history ----
-- Users can only access their own reading history.
DROP POLICY IF EXISTS "rh_select_own" ON public.reading_history;
CREATE POLICY "rh_select_own" ON public.reading_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rh_insert_own" ON public.reading_history;
CREATE POLICY "rh_insert_own" ON public.reading_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rh_update_own" ON public.reading_history;
CREATE POLICY "rh_update_own" ON public.reading_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rh_delete_own" ON public.reading_history;
CREATE POLICY "rh_delete_own" ON public.reading_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- listening_history ----
-- Users can only access their own listening history.
DROP POLICY IF EXISTS "lh_select_own" ON public.listening_history;
CREATE POLICY "lh_select_own" ON public.listening_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lh_insert_own" ON public.listening_history;
CREATE POLICY "lh_insert_own" ON public.listening_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lh_update_own" ON public.listening_history;
CREATE POLICY "lh_update_own" ON public.listening_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lh_delete_own" ON public.listening_history;
CREATE POLICY "lh_delete_own" ON public.listening_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 5. AUTH INTEGRATION
-- ============================================================================

-- Function: handle_new_user
-- Triggered after a new auth.users row is created (i.e., on signup).
-- Inserts a corresponding row into public.profiles with the user's email
-- and display_name from raw_user_meta_data (or email prefix as fallback).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'reader')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: on_auth_user_created
-- Fires AFTER INSERT on auth.users → calls handle_new_user()
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. STORAGE BUCKETS
-- ============================================================================

-- ---- covers bucket (public) ----
-- Book cover images. Public read, authenticated upload/update.
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "covers_public_read" ON storage.objects;
CREATE POLICY "covers_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers_auth_insert" ON storage.objects;
CREATE POLICY "covers_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers_auth_update" ON storage.objects;
CREATE POLICY "covers_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'covers') WITH CHECK (bucket_id = 'covers');

-- ---- payments bucket (public) ----
-- Payment screenshots. Public read (for admin dashboard display).
-- Insert restricted to authenticated users, with path-ownership check.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payments', 'payments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payments_select_own_admin" ON storage.objects;
CREATE POLICY "payments_select_own_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payments' AND (owner = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "payments_insert_own_path" ON storage.objects;
CREATE POLICY "payments_insert_own_path" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---- content-media bucket (public) ----
-- Chapter content images and uploaded media (audio/video/image).
-- Public read, authenticated insert, owner-only update/delete.
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-media', 'content-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "content_media_read" ON storage.objects;
CREATE POLICY "content_media_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'content-media');

DROP POLICY IF EXISTS "content_media_insert" ON storage.objects;
CREATE POLICY "content_media_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content-media');

DROP POLICY IF EXISTS "content_media_update_own" ON storage.objects;
CREATE POLICY "content_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'content-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'content-media');

DROP POLICY IF EXISTS "content_media_delete_own" ON storage.objects;
CREATE POLICY "content_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'content-media' AND owner = auth.uid());

-- ============================================================================
-- 7. REALTIME PUBLICATION
-- ============================================================================

-- Enable realtime on tables used for live updates in the admin dashboard
-- and reader-facing pages.
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chapters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ============================================================================
-- 8. SEED DATA
-- ============================================================================

-- Subscription plans: monthly and yearly tiers
INSERT INTO public.subscription_plans (name, price_inr, duration_days)
VALUES ('monthly', 299, 30), ('yearly', 2999, 365)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
