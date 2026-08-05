/*
# Fix payments storage policy

The original insert policy didn't verify path ownership.
Replace with a policy that checks the path starts with the user's ID.
*/

DROP POLICY IF EXISTS payments_insert ON storage.objects;
DROP POLICY IF EXISTS "payments_insert" ON storage.objects;

CREATE POLICY "payments_insert_own_path" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
