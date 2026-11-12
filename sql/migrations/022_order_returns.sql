-- Shopper return requests (one per order). Items = JSON [{variantKey, qty}].
-- status: requested | approved | rejected | received | refunded
CREATE TABLE order_returns (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     INT UNSIGNED NOT NULL UNIQUE,
  customer_id  INT UNSIGNED NOT NULL,
  items        JSON         NOT NULL,
  reason       VARCHAR(60)  NOT NULL,
  note         VARCHAR(500) NULL,
  status       VARCHAR(12)  NOT NULL DEFAULT 'requested',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_order_returns_customer (customer_id),
  CONSTRAINT fk_order_returns_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
