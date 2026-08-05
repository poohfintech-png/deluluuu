/*
# Storage bucket policies for covers and payment screenshots

1. `covers` bucket — public read, authenticated upload (admins will upload via service role or frontend with policy)
2. `payments` bucket — private; users upload own screenshots, admins read all

## Policies
- covers: public read, authenticated insert/update
- payments: authenticated insert (own path), authenticated select (own or admin)
*/

-- covers bucket already created. Add policies.
DROP POLICY IF EXISTS "covers_public_read" ON storage.objects;
CREATE POLICY "covers_public_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers_auth_insert" ON storage.objects;
CREATE POLICY "covers_auth_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers_auth_update" ON storage.objects;
CREATE POLICY "covers_auth_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'covers') WITH CHECK (bucket_id = 'covers');

-- payments bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('payments', 'payments', false) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "payments_insert_own" ON storage.objects;
CREATE POLICY "payments_insert_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'payments');

DROP POLICY IF EXISTS "payments_select_own_admin" ON storage.objects;
CREATE POLICY "payments_select_own_admin" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'payments' AND (
      owner = auth.uid() OR public.is_admin()
    )
  );
