-- Address book: label chip, default flag and landmark for the customer Addresses page.
-- label: home | work | other. Exactly one default per customer is kept by the app (one transaction).
ALTER TABLE addresses
  ADD COLUMN landmark   VARCHAR(120) NULL AFTER line2,
  ADD COLUMN label      VARCHAR(10)  NOT NULL DEFAULT 'home' AFTER pincode,
  ADD COLUMN is_default TINYINT(1)   NOT NULL DEFAULT 0 AFTER label,
  ADD COLUMN updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD KEY idx_addresses_customer_default (customer_id, is_default);

-- Existing books: the newest address becomes the default (matches what the overview showed).
UPDATE addresses a
  JOIN (SELECT customer_id, MAX(id) AS id FROM addresses GROUP BY customer_id) m ON m.id = a.id
  SET a.is_default = 1;
