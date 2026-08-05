/*
# Add username column to profiles table

## Changes
1. Add `username` column (text, nullable) to `profiles` table
2. Add unique index on `username` (partial — only where not null)
3. Allow users to update their own username (existing update policy covers this)

## Notes
- The TypeScript type already has `username: string | null` but the DB column was missing
- Unique index is partial so multiple NULL values are allowed (standard SQL behavior)
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON profiles (username)
  WHERE username IS NOT NULL;
