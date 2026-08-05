/*
# Platform Expansion: Complete Reels, Coins, Unlock System

1. Modified Tables
- `reels` — add episode_number, bunny_video_url, thumbnail_url, duration, is_premium, coin_unlock_price, view_count
- `profiles` — add is_suspended, password_changed_at (coins column already exists)
- `books` — add is_featured, is_trending (genre, view_count already exist)
- `genres` — add slug column

2. New Tables
- `unlocked_content` — tracks which reels a user has unlocked with coins
- `featured_books` — admin-curated homepage featured book placements by section

3. Security
- RLS on all new tables
- Public read for featured_books
- Owner-scoped for unlocked_content
- Admin-only for featured_books management

4. Notes
- Videos hosted on Bunny.net — only URLs stored in database
- Coins are a virtual currency (profiles.coins) for unlocking premium reels
- No mock data inserted — app starts empty
*/

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO reels
-- ============================================================================
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS episode_number integer NOT NULL DEFAULT 1;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS bunny_video_url text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS duration text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS coin_unlock_price integer NOT NULL DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reels_book_id ON public.reels(book_id);
CREATE INDEX IF NOT EXISTS idx_reels_status ON public.reels(status);
CREATE INDEX IF NOT EXISTS idx_reels_episode ON public.reels(book_id, episode_number);

-- ============================================================================
-- 2. ADD MISSING COLUMNS TO profiles
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

-- ============================================================================
-- 3. ADD MISSING COLUMNS TO books
-- ============================================================================
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS is_trending boolean NOT NULL DEFAULT false;

-- ============================================================================
-- 4. ADD slug TO genres
-- ============================================================================
ALTER TABLE public.genres ADD COLUMN IF NOT EXISTS slug text;

-- ============================================================================
-- 5. UNLOCKED CONTENT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.unlocked_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  coins_spent integer NOT NULL DEFAULT 0,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, reel_id)
);
ALTER TABLE public.unlocked_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unlocked_select_own" ON public.unlocked_content;
CREATE POLICY "unlocked_select_own" ON public.unlocked_content
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "unlocked_insert_own" ON public.unlocked_content;
CREATE POLICY "unlocked_insert_own" ON public.unlocked_content
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 6. FEATURED BOOKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.featured_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT 'featured' CHECK (section IN ('featured','trending','popular','new_releases','recommended')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_id, section)
);
ALTER TABLE public.featured_books ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_featured_section ON public.featured_books(section, position);

DROP POLICY IF EXISTS "featured_select_all" ON public.featured_books;
CREATE POLICY "featured_select_all" ON public.featured_books
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "featured_insert_admin" ON public.featured_books;
CREATE POLICY "featured_insert_admin" ON public.featured_books
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "featured_update_admin" ON public.featured_books;
CREATE POLICY "featured_update_admin" ON public.featured_books
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "featured_delete_admin" ON public.featured_books;
CREATE POLICY "featured_delete_admin" ON public.featured_books
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 7. ADD is_writer() FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_writer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','writer')
  );
$$;

-- ============================================================================
-- 8. ADD REALTIME FOR NEW TABLES
-- ============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.unlocked_content;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.featured_books;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
