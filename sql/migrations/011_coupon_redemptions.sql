ALTER TABLE coupons
  MODIFY kind VARCHAR(20) NOT NULL,
  ADD COLUMN per_phone_limit INT UNSIGNED NULL AFTER usage_limit;

CREATE TABLE coupon_redemptions (
  coupon_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  phone VARCHAR(10) NOT NULL,
  amount INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (coupon_id, order_id),
  KEY idx_coupon_redemptions_phone (coupon_id, phone),
  CONSTRAINT fk_coupon_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_redemptions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE coupon_targets (
  coupon_id INT UNSIGNED NOT NULL,
  kind VARCHAR(12) NOT NULL,
  handle VARCHAR(100) NOT NULL,
  PRIMARY KEY (coupon_id, kind, handle),
  CONSTRAINT fk_coupon_targets_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
