-- Launch cleanup, 21 Nov 2026 (owner's decision): remove every test order and customer account from the
-- LIVE store before launch, put stock taken by test orders back, remove the ₹1 "test" product, and restart
-- numbering (first real order SMP1001, first GST invoice 000001).
--
-- Runs only on the live database (u892494227_smp). Anywhere else @live is 0: the backup tables are created
-- empty and nothing is deleted.
-- Everything removed is first copied into backup_20261121_* tables in the same database. Drop those once
-- the owner confirms nothing is missing.
-- Kept on purpose: reviews (their order link becomes empty), bulk inquiries, leads, chat logs, admin users,
-- products, prices, settings, coupons (only their use counts reset).

SET @live = (DATABASE() = 'u892494227_smp');

-- 1. Backups (DDL, outside the transaction).
CREATE TABLE IF NOT EXISTS backup_20261121_orders AS SELECT * FROM orders WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_order_items AS SELECT * FROM order_items WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_order_events AS SELECT * FROM order_events WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_payments AS SELECT * FROM payments WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_refunds AS SELECT * FROM refunds WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_shipments AS SELECT * FROM shipments WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_invoices AS SELECT * FROM invoices WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_credit_notes AS SELECT * FROM credit_notes WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_customers AS SELECT * FROM customers WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_addresses AS SELECT * FROM addresses WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_carts AS SELECT * FROM carts WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_support_tickets AS SELECT * FROM support_tickets WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_order_returns AS SELECT * FROM order_returns WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_inventory_log AS SELECT * FROM inventory_log WHERE @live = 1;
CREATE TABLE IF NOT EXISTS backup_20261121_test_products AS SELECT * FROM products WHERE @live = 1 AND LOWER(TRIM(title)) = 'test';
CREATE TABLE IF NOT EXISTS backup_20261121_test_variants AS
  SELECT v.* FROM product_variants v JOIN products p ON p.id = v.product_id WHERE @live = 1 AND LOWER(TRIM(p.title)) = 'test';

START TRANSACTION;

-- 2. Stock: give back what test orders took (net of their own releases / restocks), tracked sizes only.
UPDATE product_variants v
JOIN (SELECT variant_key, -SUM(delta) AS back FROM inventory_log WHERE order_id IS NOT NULL GROUP BY variant_key) x
  ON x.variant_key = v.variant_key
SET v.stock_qty = v.stock_qty + x.back
WHERE @live = 1 AND v.stock_qty IS NOT NULL AND x.back <> 0;

INSERT INTO inventory_log (variant_key, delta, stock_after, reason, order_id, note, actor)
SELECT x.variant_key, x.back, v.stock_qty, 'correction', NULL, 'Test orders removed before launch: stock returned', 'system'
FROM (SELECT variant_key, -SUM(delta) AS back FROM inventory_log WHERE order_id IS NOT NULL GROUP BY variant_key) x
JOIN product_variants v ON v.variant_key = x.variant_key
WHERE @live = 1 AND v.stock_qty IS NOT NULL AND x.back <> 0;

DELETE FROM inventory_log WHERE @live = 1 AND order_id IS NOT NULL;

-- 3. Orders. Cascades remove items, events, payments + refunds, invoices + credit notes, shipments + their
--    events, stock holds, returns, coupon uses and order emails.
DELETE FROM orders WHERE @live = 1;
DELETE FROM refund_otps WHERE @live = 1;
DELETE FROM marketing_outbox WHERE @live = 1;
DELETE FROM whatsapp_outbox WHERE @live = 1;
DELETE FROM email_outbox WHERE @live = 1;
DELETE FROM webhook_logs WHERE @live = 1;
DELETE FROM support_tickets WHERE @live = 1;
DELETE FROM carts WHERE @live = 1;
UPDATE coupons SET used_count = 0 WHERE @live = 1;

-- 4. Customer accounts (cascades: addresses, sessions, consents, account OTPs) and login codes.
DELETE FROM customers WHERE @live = 1;
DELETE FROM otp_codes WHERE @live = 1;
DELETE FROM email_otps WHERE @live = 1;
DELETE FROM chat_guest_otps WHERE @live = 1;
DELETE FROM rate_limits WHERE @live = 1;

-- 5. The ₹1 test product (variants and collection links cascade).
DELETE pi FROM product_images pi JOIN products p ON p.handle = pi.product_handle WHERE @live = 1 AND LOWER(TRIM(p.title)) = 'test';
DELETE FROM products WHERE @live = 1 AND LOWER(TRIM(title)) = 'test';

-- 6. Numbering: next GST invoice / credit note is 000001.
DELETE FROM invoice_sequences WHERE @live = 1;
DELETE FROM credit_note_sequences WHERE @live = 1;

COMMIT;

-- 7. Order numbers come from the id (SMP + 1000 + id): an empty table restarts at 1 → SMP1001.
--    On a non-empty table (any other database) these are no-ops: MySQL keeps max(id) + 1.
ALTER TABLE orders AUTO_INCREMENT = 1;
ALTER TABLE customers AUTO_INCREMENT = 1;
ALTER TABLE payments AUTO_INCREMENT = 1;
ALTER TABLE invoices AUTO_INCREMENT = 1;
ALTER TABLE shipments AUTO_INCREMENT = 1;
ALTER TABLE carts AUTO_INCREMENT = 1;
