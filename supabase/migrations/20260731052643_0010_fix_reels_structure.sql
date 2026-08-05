/*
# Fix Reels Structure: Independent Drama Support + Genre FK + Created-By

1. Modified Tables
- `reels`:
  - Add `related_book_id` (nullable FK to books) — replaces `book_id`
  - Add `is_independent_drama` (boolean default false)
  - Add `genre_id` (nullable FK to genres) — replaces text `genre` column
  - Add `created_by` (nullable FK to profiles) — replaces `author_id` for admin tracking
  - Migrate data from `book_id` → `related_book_id`
  - Drop old `book_id` column and its FK constraint
- `coin_transactions`:
  - Add `reel_id` column (nullable FK to reels) alongside existing `reel_episode_id`

2. Security
- No policy changes needed — existing reels policies reference `author_id` which remains
- New columns are nullable so existing rows are unaffected

3. Notes
- `related_book_id` is nullable to support independent drama reels (no book required)
- `is_independent_drama` flag distinguishes the two reel types
- `genre_id` properly links to the genres table for the admin dropdown
- `created_by` tracks which admin/writer created the reel
- No data is lost: book_id values are copied to related_book_id before the old column is dropped
*/

-- ============================================================================
-- 1. ADD NEW COLUMNS TO reels
-- ============================================================================
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS related_book_id uuid;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS is_independent_drama boolean NOT NULL DEFAULT false;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS genre_id uuid;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS created_by uuid;

-- ============================================================================
-- 2. MIGRATE DATA: copy book_id → related_book_id, set is_independent_drama
-- ============================================================================
UPDATE public.reels
SET related_book_id = book_id
WHERE book_id IS NOT NULL AND related_book_id IS NULL;

UPDATE public.reels
SET is_independent_drama = true
WHERE book_id IS NULL;

-- ============================================================================
-- 3. ADD FK CONSTRAINTS FOR NEW COLUMNS
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reels_related_book_id_fkey' AND table_name = 'reels'
  ) THEN
    ALTER TABLE public.reels
      ADD CONSTRAINT reels_related_book_id_fkey
      FOREIGN KEY (related_book_id) REFERENCES public.books(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reels_genre_id_fkey' AND table_name = 'reels'
  ) THEN
    ALTER TABLE public.reels
      ADD CONSTRAINT reels_genre_id_fkey
      FOREIGN KEY (genre_id) REFERENCES public.genres(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reels_created_by_fkey' AND table_name = 'reels'
  ) THEN
    ALTER TABLE public.reels
      ADD CONSTRAINT reels_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. DROP OLD book_id FK CONSTRAINT AND COLUMN
-- ============================================================================
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_book_id_fkey;
ALTER TABLE public.reels DROP COLUMN IF EXISTS book_id;

-- ============================================================================
-- 5. ADD reel_id TO coin_transactions (alongside reel_episode_id)
-- ============================================================================
ALTER TABLE public.coin_transactions ADD COLUMN IF NOT EXISTS reel_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'coin_transactions_reel_id_fkey' AND table_name = 'coin_transactions'
  ) THEN
    ALTER TABLE public.coin_transactions
      ADD CONSTRAINT coin_transactions_reel_id_fkey
      FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. ADD INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_reels_related_book_id ON public.reels(related_book_id);
CREATE INDEX IF NOT EXISTS idx_reels_genre_id ON public.reels(genre_id);
CREATE INDEX IF NOT EXISTS idx_reels_independent ON public.reels(is_independent_drama);
