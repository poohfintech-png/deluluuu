/*
# Update chapters and reels SELECT policies to exclude soft-deleted items
*/

DROP POLICY IF EXISTS "chapters_select" ON chapters;
CREATE POLICY "chapters_select" ON chapters FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR public.is_admin()
  );

-- Also update reels if it has a select policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reels' AND policyname = 'reels_select') THEN
    EXECUTE 'DROP POLICY IF EXISTS "reels_select" ON reels';
    EXECUTE 'CREATE POLICY "reels_select" ON reels FOR SELECT
      TO anon, authenticated
      USING (
        (status = ''published'' AND deleted_at IS NULL)
        OR public.is_admin()
      )';
  END IF;
END $$;
