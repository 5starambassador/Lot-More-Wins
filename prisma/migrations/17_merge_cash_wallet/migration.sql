-- One wallet: UPI payouts end and every cash reward balance moves into the wallet (points ledger),
-- converted at the Super Admin points-to-rupees ratio (10 points = ₹1 when settings were never saved).
-- The cash ledger and payouts stay in the database as history; nothing reads them for balances any more.

-- 1. Pending payouts were never paid: cancel them, so their amount is part of the balance moved below.
UPDATE "payouts"
SET "status" = 'CANCELLED',
    "failure_note" = 'UPI payouts ended; the amount moved into the partner wallet',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "status" = 'PENDING';

-- 2. Each partner's cash balance (purchase + referral credits minus paid payouts) becomes one
--    wallet entry that never expires.
WITH ratio AS (
    SELECT COALESCE(
        (SELECT "points_ratio_points" / NULLIF("points_ratio_rupees", 0) FROM "program_settings" WHERE "id" = 'GLOBAL'),
        10
    ) AS points_per_rupee
),
balances AS (
    SELECT "partner_id",
           SUM(CASE WHEN "type" = 'PAYOUT' THEN -"amount" ELSE "amount" END) AS rupees
    FROM "cash_reward_entries"
    WHERE "partner_id" IS NOT NULL
    GROUP BY "partner_id"
)
INSERT INTO "points_entries" ("id", "type", "points", "redeemed_points", "partner_id", "created_at")
SELECT gen_random_uuid()::text, 'CASH_WALLET_MERGE', ROUND(b.rupees * r.points_per_rupee, 2), 0, b."partner_id", CURRENT_TIMESTAMP
FROM balances b CROSS JOIN ratio r
WHERE ROUND(b.rupees * r.points_per_rupee, 2) > 0;

-- 3. Cash reward held for referred customers who have not registered yet: held the same way as their
--    points, and claimed into their wallet when they register with that mobile.
WITH ratio AS (
    SELECT COALESCE(
        (SELECT "points_ratio_points" / NULLIF("points_ratio_rupees", 0) FROM "program_settings" WHERE "id" = 'GLOBAL'),
        10
    ) AS points_per_rupee
),
held AS (
    SELECT "customer_id", SUM("amount") AS rupees
    FROM "cash_reward_entries"
    WHERE "partner_id" IS NULL AND "customer_id" IS NOT NULL AND "type" <> 'PAYOUT'
    GROUP BY "customer_id"
)
INSERT INTO "points_entries" ("id", "type", "points", "redeemed_points", "customer_id", "created_at")
SELECT gen_random_uuid()::text, 'CASH_WALLET_MERGE', ROUND(h.rupees * r.points_per_rupee, 2), 0, h."customer_id", CURRENT_TIMESTAMP
FROM held h CROSS JOIN ratio r
WHERE ROUND(h.rupees * r.points_per_rupee, 2) > 0;

-- 4. No more weekly UPI payouts.
UPDATE "program_settings" SET "weekly_payout_enabled" = false;
