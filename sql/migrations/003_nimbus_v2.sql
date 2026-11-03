-- NimbusPost v2: courier ids are 24-char ids; keep provider order id + delivery ids for webhook de-dupe.
ALTER TABLE orders MODIFY courier_id VARCHAR(40) NULL;
ALTER TABLE shipments ADD COLUMN pickup_requested TINYINT(1) NOT NULL DEFAULT 0 AFTER tracking_url,
  ADD COLUMN charged INT UNSIGNED NULL AFTER pickup_requested;
ALTER TABLE webhook_logs ADD COLUMN delivery_id VARCHAR(80) NULL AFTER ref, ADD UNIQUE KEY uq_webhook_delivery (source, delivery_id);
