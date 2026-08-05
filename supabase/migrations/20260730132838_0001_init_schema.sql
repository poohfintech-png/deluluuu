/*
# Delulu — Core Schema

Full data model: profiles (admin/reader roles), books, chapters (jsonb content), subscription plans, subscriptions (UPI), libraries, follows, likes, comments, reading/listening history. RLS enabled on all tables with is_admin() helper. Auto profile creation on signup. Seeded plans.
*/

-- profiles
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
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- is_admin helper (after profiles exists)
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

-- books
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
DROP POLICY IF EXISTS "books_select" ON public.books;
CREATE POLICY "books_select" ON public.books FOR SELECT TO anon, authenticated USING (status = 'published' OR public.is_admin());
DROP POLICY IF EXISTS "books_insert_admin" ON public.books;
CREATE POLICY "books_insert_admin" ON public.books FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "books_update_admin" ON public.books;
CREATE POLICY "books_update_admin" ON public.books FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "books_delete_admin" ON public.books;
CREATE POLICY "books_delete_admin" ON public.books FOR DELETE TO authenticated USING (public.is_admin());

-- chapters
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
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON public.chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_order ON public.chapters(book_id, order_index);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chapters_select" ON public.chapters;
CREATE POLICY "chapters_select" ON public.chapters FOR SELECT TO anon, authenticated USING (status = 'published' OR public.is_admin());
DROP POLICY IF EXISTS "chapters_insert_admin" ON public.chapters;
CREATE POLICY "chapters_insert_admin" ON public.chapters FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "chapters_update_admin" ON public.chapters;
CREATE POLICY "chapters_update_admin" ON public.chapters FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "chapters_delete_admin" ON public.chapters;
CREATE POLICY "chapters_delete_admin" ON public.chapters FOR DELETE TO authenticated USING (public.is_admin());

-- subscription_plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name IN ('monthly','yearly')),
  price_inr integer NOT NULL,
  duration_days integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select_all" ON public.subscription_plans;
CREATE POLICY "plans_select_all" ON public.subscription_plans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "plans_insert_admin" ON public.subscription_plans;
CREATE POLICY "plans_insert_admin" ON public.subscription_plans FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "plans_update_admin" ON public.subscription_plans;
CREATE POLICY "plans_update_admin" ON public.subscription_plans FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- subscriptions
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
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_select" ON public.subscriptions;
CREATE POLICY "subs_select" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "subs_insert_own" ON public.subscriptions;
CREATE POLICY "subs_insert_own" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "subs_update_own_admin" ON public.subscriptions;
CREATE POLICY "subs_update_own_admin" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "subs_delete_admin" ON public.subscriptions;
CREATE POLICY "subs_delete_admin" ON public.subscriptions FOR DELETE TO authenticated USING (public.is_admin());

-- libraries
CREATE TABLE IF NOT EXISTS public.libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lib_select_own" ON public.libraries;
CREATE POLICY "lib_select_own" ON public.libraries FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "lib_insert_own" ON public.libraries;
CREATE POLICY "lib_insert_own" ON public.libraries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "lib_delete_own" ON public.libraries;
CREATE POLICY "lib_delete_own" ON public.libraries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- follows
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select_all" ON public.follows;
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- chapter_likes
CREATE TABLE IF NOT EXISTS public.chapter_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);
ALTER TABLE public.chapter_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_select_all" ON public.chapter_likes;
CREATE POLICY "likes_select_all" ON public.chapter_likes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "likes_insert_own" ON public.chapter_likes;
CREATE POLICY "likes_insert_own" ON public.chapter_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes_delete_own" ON public.chapter_likes;
CREATE POLICY "likes_delete_own" ON public.chapter_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- comments
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_chapter ON public.comments(chapter_id);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select_all" ON public.comments;
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_delete_own_admin" ON public.comments;
CREATE POLICY "comments_delete_own_admin" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- reading_history
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
DROP POLICY IF EXISTS "rh_select_own" ON public.reading_history;
CREATE POLICY "rh_select_own" ON public.reading_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "rh_insert_own" ON public.reading_history;
CREATE POLICY "rh_insert_own" ON public.reading_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rh_update_own" ON public.reading_history;
CREATE POLICY "rh_update_own" ON public.reading_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rh_delete_own" ON public.reading_history;
CREATE POLICY "rh_delete_own" ON public.reading_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- listening_history
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
DROP POLICY IF EXISTS "lh_select_own" ON public.listening_history;
CREATE POLICY "lh_select_own" ON public.listening_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "lh_insert_own" ON public.listening_history;
CREATE POLICY "lh_insert_own" ON public.listening_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "lh_update_own" ON public.listening_history;
CREATE POLICY "lh_update_own" ON public.listening_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "lh_delete_own" ON public.listening_history;
CREATE POLICY "lh_delete_own" ON public.listening_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on signup
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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed plans
INSERT INTO public.subscription_plans (name, price_inr, duration_days)
VALUES ('monthly', 299, 30), ('yearly', 2999, 365)
ON CONFLICT (name) DO NOTHING;
