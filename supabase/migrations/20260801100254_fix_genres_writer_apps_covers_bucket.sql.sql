/*
# Fix genres columns, create writer_applications table, create covers bucket, add drama_series

## 1. Genres table — add missing columns
The frontend uses `description`, `icon`, and `sort_order` but the table only has `id, name, slug, created_at`.
- Add `description text` (nullable)
- Add `icon text` (nullable, for emoji icons)
- Add `sort_order integer` (default 0)

## 2. writer_applications table — create
The frontend inserts into `writer_applications` but the table does not exist.
Columns: id, user_id, name, username, email, about, writing_experience, genres (text[]),
previous_work_links (text[]), sample_writing_url, profile_picture_url, status,
review_notes, reviewed_by, reviewed_at, created_at, updated_at.
RLS: users can insert/view their own; admins can view/update all.

## 3. Storage bucket — create `covers`
AdminBooksPage uploads covers to bucket `covers` which does not exist.
Create a public bucket named `covers` with storage policies.

## 4. coin_transactions — add description column
ReelsPage inserts `description` into coin_transactions but the column doesn't exist.
Add `description text` (nullable).

## 5. drama_series table — create for ReelShort-style drama experience
Groups reel episodes into a drama series with poster, description, genre.
Columns: id, title, description, poster_url, genre_id, related_book_id, is_independent,
status, created_by, created_at, updated_at.
RLS: public read for published; admin/writer write.

## 6. reels — add drama_series_id column
Links individual reel episodes to a drama series.
*/

-- 1. Genres: add missing columns
ALTER TABLE genres ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE genres ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE genres ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. writer_applications table
CREATE TABLE IF NOT EXISTS writer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  username text NOT NULL,
  email text NOT NULL,
  about text,
  writing_experience text,
  genres text[] NOT NULL DEFAULT '{}',
  previous_work_links text[] NOT NULL DEFAULT '{}',
  sample_writing_url text,
  profile_picture_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  review_notes text,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE writer_applications ENABLE ROW LEVEL SECURITY;

-- Users can submit their own applications (INSERT)
DROP POLICY IF EXISTS "insert_own_writer_applications" ON writer_applications;
CREATE POLICY "insert_own_writer_applications" ON writer_applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can view their own applications (SELECT)
DROP POLICY IF EXISTS "select_own_writer_applications" ON writer_applications;
CREATE POLICY "select_own_writer_applications" ON writer_applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins can view all applications (SELECT)
DROP POLICY IF EXISTS "admin_select_all_writer_applications" ON writer_applications;
CREATE POLICY "admin_select_all_writer_applications" ON writer_applications FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update all applications (UPDATE)
DROP POLICY IF EXISTS "admin_update_all_writer_applications" ON writer_applications;
CREATE POLICY "admin_update_all_writer_applications" ON writer_applications FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Create covers storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for covers bucket (public read, authenticated upload)
DROP POLICY IF EXISTS "covers_public_read" ON storage.objects;
CREATE POLICY "covers_public_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers_auth_upload" ON storage.objects;
CREATE POLICY "covers_auth_upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers_auth_update" ON storage.objects;
CREATE POLICY "covers_auth_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'covers') WITH CHECK (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers_auth_delete" ON storage.objects;
CREATE POLICY "covers_auth_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'covers');

-- 4. coin_transactions: add description column
ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS description text;

-- 5. drama_series table
CREATE TABLE IF NOT EXISTS drama_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  poster_url text,
  genre_id uuid REFERENCES genres(id) ON DELETE SET NULL,
  related_book_id uuid REFERENCES books(id) ON DELETE SET NULL,
  is_independent boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE drama_series ENABLE ROW LEVEL SECURITY;

-- Public can read published drama series
DROP POLICY IF EXISTS "public_read_published_drama_series" ON drama_series;
CREATE POLICY "public_read_published_drama_series" ON drama_series FOR SELECT
  TO anon, authenticated USING (status = 'published');

-- Admins and writers can read all drama series
DROP POLICY IF EXISTS "staff_read_all_drama_series" ON drama_series;
CREATE POLICY "staff_read_all_drama_series" ON drama_series FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'writer'))
  );

-- Admins and writers can insert drama series
DROP POLICY IF EXISTS "staff_insert_drama_series" ON drama_series;
CREATE POLICY "staff_insert_drama_series" ON drama_series FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'writer'))
  );

-- Admins and writers can update drama series
DROP POLICY IF EXISTS "staff_update_drama_series" ON drama_series;
CREATE POLICY "staff_update_drama_series" ON drama_series FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'writer'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'writer'))
  );

-- Admins can delete drama series
DROP POLICY IF EXISTS "admin_delete_drama_series" ON drama_series;
CREATE POLICY "admin_delete_drama_series" ON drama_series FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. reels: add drama_series_id column
ALTER TABLE reels ADD COLUMN IF NOT EXISTS drama_series_id uuid REFERENCES drama_series(id) ON DELETE SET NULL;

-- Add index for drama_series lookups on reels
CREATE INDEX IF NOT EXISTS idx_reels_drama_series_id ON reels(drama_series_id) WHERE drama_series_id IS NOT NULL;

-- Add index for genres sort_order queries
CREATE INDEX IF NOT EXISTS idx_genres_sort_order ON genres(sort_order);
