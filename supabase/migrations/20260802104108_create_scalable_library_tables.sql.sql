/*
# Create scalable user library and viewing history tables

## Changes
1. Create `user_library` table — a content-type-agnostic library supporting books, audiobooks, and dramas
2. Create `viewing_history` table — a unified watching/listening history for dramas and audiobooks
3. Enable RLS with ownership-scoped policies

## Tables

### user_library
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, defaults to auth.uid())
- `content_type` (text: 'book', 'audiobook', 'drama')
- `content_id` (uuid — references books, reels, or audiobooks depending on content_type)
- `status` (text: 'saved', 'completed', 'in_progress')
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- Unique constraint on (user_id, content_type, content_id)

### viewing_history
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, defaults to auth.uid())
- `content_type` (text: 'drama', 'audiobook')
- `content_id` (uuid — references reels or audiobooks)
- `episode_id` (uuid, nullable — for drama episodes)
- `progress` (integer — percentage for drama, seconds for audiobook)
- `last_watched_at` (timestamptz)
- `created_at` (timestamptz)
- Unique constraint on (user_id, content_type, content_id, episode_id)

## Security
- RLS enabled on both tables
- Users can only CRUD their own rows
*/

-- user_library
CREATE TABLE IF NOT EXISTS user_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('book', 'audiobook', 'drama')),
  content_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'completed', 'in_progress')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS user_library_unique_idx
  ON user_library (user_id, content_type, content_id);

DROP POLICY IF EXISTS "user_library_select_own" ON user_library;
CREATE POLICY "user_library_select_own" ON user_library FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_library_insert_own" ON user_library;
CREATE POLICY "user_library_insert_own" ON user_library FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_library_update_own" ON user_library;
CREATE POLICY "user_library_update_own" ON user_library FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_library_delete_own" ON user_library;
CREATE POLICY "user_library_delete_own" ON user_library FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- viewing_history
CREATE TABLE IF NOT EXISTS viewing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('drama', 'audiobook')),
  content_id uuid NOT NULL,
  episode_id uuid,
  progress integer NOT NULL DEFAULT 0,
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE viewing_history ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS viewing_history_unique_idx
  ON viewing_history (user_id, content_type, content_id, COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'));

DROP POLICY IF EXISTS "viewing_history_select_own" ON viewing_history;
CREATE POLICY "viewing_history_select_own" ON viewing_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "viewing_history_insert_own" ON viewing_history;
CREATE POLICY "viewing_history_insert_own" ON viewing_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "viewing_history_update_own" ON viewing_history;
CREATE POLICY "viewing_history_update_own" ON viewing_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "viewing_history_delete_own" ON viewing_history;
CREATE POLICY "viewing_history_delete_own" ON viewing_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
