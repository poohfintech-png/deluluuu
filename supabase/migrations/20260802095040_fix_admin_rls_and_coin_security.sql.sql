/*
# Fix admin permissions and secure coin mutations

## Changes
1. Allow admins to update profiles (needed for writer approval role upgrade)
2. Secure coin_transactions so users can only insert their own
3. Secure unlocked_content so users can only insert their own
*/

-- 1. Admin can update any profile (for writer approval role upgrade)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2. Users can only insert their own coin transactions
DROP POLICY IF EXISTS "coin_tx_insert_own" ON coin_transactions;
CREATE POLICY "coin_tx_insert_own" ON coin_transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "coin_tx_select_own" ON coin_transactions;
CREATE POLICY "coin_tx_select_own" ON coin_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- 3. Users can only insert their own unlocked content
DROP POLICY IF EXISTS "unlocked_insert_own" ON unlocked_content;
CREATE POLICY "unlocked_insert_own" ON unlocked_content FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "unlocked_select_own" ON unlocked_content;
CREATE POLICY "unlocked_select_own" ON unlocked_content FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
