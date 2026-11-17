-- Money-safety flag: something unexpected happened on this order (extra/late payment, refund or
-- shipment API outcome unknown, cancel request on a paid order). Shown as a banner on the admin
-- order page until an admin resolves it. NULL = nothing to look at.
ALTER TABLE orders
  ADD COLUMN attention    VARCHAR(500) NULL AFTER status,
  ADD COLUMN attention_at DATETIME     NULL AFTER attention;
