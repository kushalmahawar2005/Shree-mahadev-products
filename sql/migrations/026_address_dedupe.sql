-- Every order used to add its address to the book again. Keep one row per
-- (customer, pincode, phone, street ignoring case/spaces/punctuation): the default one if any, else the newest.
DELETE a FROM addresses a
JOIN (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY customer_id, TRIM(pincode), RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10),
                        LOWER(REGEXP_REPLACE(CONCAT(line1, IFNULL(line2, '')), '[^[:alnum:]]', ''))
           ORDER BY is_default DESC, id DESC
         ) AS rn
    FROM addresses
) d ON d.id = a.id
WHERE d.rn > 1;

-- Anyone left without a default gets their newest address as default.
UPDATE addresses a
JOIN (
  SELECT customer_id, MAX(id) AS id FROM addresses GROUP BY customer_id
  HAVING SUM(is_default) = 0
) m ON m.id = a.id
SET a.is_default = 1;
