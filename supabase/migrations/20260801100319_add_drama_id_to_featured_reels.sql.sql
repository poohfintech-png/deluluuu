/*
# Add drama_id to featured_reels table

The featured_reels table currently only supports featuring individual reels.
For the ReelShort-style drama experience, admins need to feature entire drama series.
- Add `drama_id uuid` column (nullable, references drama_series)
- Make `reel_id` nullable (since we may feature a drama series instead of a single reel)
- Add a CHECK constraint to ensure at least one of reel_id or drama_id is set
- Add index on (section, position) for efficient section queries
*/

-- Make reel_id nullable (was NOT NULL) so we can feature drama series instead
ALTER TABLE featured_reels ALTER COLUMN reel_id DROP NOT NULL;

-- Add drama_id column
ALTER TABLE featured_reels ADD COLUMN IF NOT EXISTS drama_id uuid REFERENCES drama_series(id) ON DELETE CASCADE;

-- Add CHECK: at least one of reel_id or drama_id must be set
DO $$ BEGIN
  ALTER TABLE featured_reels ADD CONSTRAINT featured_reels_reel_or_drama
    CHECK (reel_id IS NOT NULL OR drama_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add index for section+position queries
CREATE INDEX IF NOT EXISTS idx_featured_reels_section_pos ON featured_reels(section, position);
