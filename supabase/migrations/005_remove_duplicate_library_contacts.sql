-- Remove duplicate library contacts (same email, campaign_id = null)
-- Keep only the first occurrence (by id)

-- First, identify duplicates
-- Then delete all but the first one for each email/user combination

DELETE FROM contacts
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, LOWER(email) 
        ORDER BY id ASC
      ) as row_num
    FROM contacts
    WHERE campaign_id IS NULL
  ) duplicates
  WHERE row_num > 1
);

-- Verify no duplicates remain
-- This query should return 0 rows if no duplicates exist
SELECT 
  user_id, 
  LOWER(email) as email_lower, 
  COUNT(*) as count
FROM contacts
WHERE campaign_id IS NULL
GROUP BY user_id, LOWER(email)
HAVING COUNT(*) > 1;

