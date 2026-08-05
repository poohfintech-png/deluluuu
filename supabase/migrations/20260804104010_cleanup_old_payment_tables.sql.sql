/*
# Payment System Cleanup — Remove old subscription tables and test data

This migration:
1. Deletes abandoned payment_requests (pending, no screenshot, never submitted)
2. Deletes all rows from old subscriptions table
3. Deletes all rows from old subscription_plans table
4. Drops old subscriptions and subscription_plans tables
5. Removes associated RLS policies

The active payment system uses: payment_requests, membership_plans, user_memberships, payment_settings.
No code references the old tables after the AdminDashboardPage migration.
*/

-- Step 1: Delete abandoned payment requests (from the bug)
DELETE FROM payment_requests 
WHERE status = 'pending' 
  AND submitted_at IS NULL 
  AND screenshot_url IS NULL;

-- Step 2: Delete all rows from old subscriptions table
DELETE FROM subscriptions;

-- Step 3: Delete all rows from old subscription_plans table
DELETE FROM subscription_plans;

-- Step 4: Drop old tables (CASCADE removes dependent policies/constraints)
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- Verify: no remaining references to old tables
-- (RLS policies are dropped automatically with CASCADE)
