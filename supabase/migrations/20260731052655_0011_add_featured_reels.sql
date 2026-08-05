/*
# Add Featured Reels Table for Admin-Controlled Reel Sections

1. New Tables
- `featured_reels` — admin-curated reel placements by section (featured, trending, popular, new_reels)

2. Security
- Public read for featured_reels
- Admin-only for insert/update/delete

3. Notes
- Mirrors the existing featured_books table pattern
- Allows admin to control which reels appear in homepage sections
- No automatic selection — only admin-curated content appears
*/

CREATE TABLE IF NOT EXISTS public.featured_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT 'featured' CHECK (section IN ('featured','trending','popular','new_reels')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reel_id, section)
);
ALTER TABLE public.featured_reels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_featured_reels_section ON public.featured_reels(section, position);

DROP POLICY IF EXISTS "featured_reels_select_all" ON public.featured_reels;
CREATE POLICY "featured_reels_select_all" ON public.featured_reels
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "featured_reels_insert_admin" ON public.featured_reels;
CREATE POLICY "featured_reels_insert_admin" ON public.featured_reels
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "featured_reels_update_admin" ON public.featured_reels;
CREATE POLICY "featured_reels_update_admin" ON public.featured_reels
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "featured_reels_delete_admin" ON public.featured_reels;
CREATE POLICY "featured_reels_delete_admin" ON public.featured_reels
  FOR DELETE TO authenticated USING (public.is_admin());
