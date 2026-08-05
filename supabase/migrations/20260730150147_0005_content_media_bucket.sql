/*
# Content media bucket + storage policies

Dedicated bucket for chapter content images (separate from book covers).
Public read so readers can see images in chapters.
Authenticated users can upload (admin-only enforced via RLS on chapters).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-media', 'content-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "content_media_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'content-media');

-- Authenticated insert
CREATE POLICY "content_media_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-media');

-- Owner can update/delete
CREATE POLICY "content_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'content-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'content-media');

CREATE POLICY "content_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'content-media' AND owner = auth.uid());
