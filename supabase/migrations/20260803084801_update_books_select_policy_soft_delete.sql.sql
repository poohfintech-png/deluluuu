/*
# Update books SELECT policy to exclude soft-deleted books

Updates the books_select RLS policy to exclude books with deleted_at IS NOT NULL
from public/reader queries. Admins can still see all books.
*/

DROP POLICY IF EXISTS "books_select" ON books;

CREATE POLICY "books_select" ON books FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR public.is_admin()
  );
